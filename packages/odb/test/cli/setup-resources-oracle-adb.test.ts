import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  environment: 'dev',
  values: new Map<string, Map<string, string>>(),
  prompts: vi.fn<(questions: unknown) => Promise<Record<string, string>>>(),
  randomBytes: vi.fn<(size: number) => Buffer>(),
  set: vi.fn<(key: string, value: string) => void>(),
  info: vi.fn<(message: string) => void>(),
  addService: vi.fn<(service: unknown) => void>(),
}))

vi.mock('node:crypto', () => ({ randomBytes: state.randomBytes }))
vi.mock('../../../cli/node_modules/prompts/index.js', () => ({ default: state.prompts }))
vi.mock('../../../cli/src/adapters/environment-store.js', () => ({
  EnvironmentStore: class {
    getCurrent() {
      return { projectName: 'example', envDir: state.environment }
    }
  },
}))
vi.mock('../../../cli/src/adapters/config-store.js', () => ({
  availablePlatforms: [{ title: 'Local', value: 'local-podman' }],
  ConfigStore: class {
    getPlatforms() {
      return ['local-podman']
    }
    getConfig() {
      return { services: [] }
    }
    addService = state.addService
  },
}))
vi.mock('../../../cli/src/adapters/podman-client.js', () => ({
  PodmanClient: class {
    getContainers() {
      return []
    }
    getContainerPorts() {
      return []
    }
  },
}))
vi.mock('../../../cli/src/adapters/oci-client.js', () => ({
  OciClient: vi.fn<(path: string, profile: string) => void>(),
}))
vi.mock('../../../cli/src/adapters/secrets-store.js', () => ({
  SecretsStore: class {
    get(key: string) {
      return state.values.get(state.environment)?.get(key)
    }
    set(key: string, value: string) {
      state.set(key, value)
      let values = state.values.get(state.environment)
      if (!values) {
        values = new Map()
        state.values.set(state.environment, values)
      }
      values.set(key, value)
    }
  },
}))
vi.mock('../../../cli/src/shared/logger.js', () => ({
  logger: {
    info: state.info,
    warn: vi.fn<(message: string) => void>(),
    lf: vi.fn<() => void>(),
  },
}))

import { runSetupOracleAdb } from '../../../cli/src/app/setup-resources-oracle-adb.js'

const credentials = {
  adminPassword: 'test-admin-password',
  walletPassword: 'test-wallet-password',
  schemaUsername: 'APP',
  schemaPassword: 'test-schema-password',
  appUsername: 'admin@example.com',
  appPassword: 'test-app-password',
}
const preparePrompts = () => {
  state.prompts
    .mockResolvedValueOnce({ dbName: 'example-adb' })
    .mockResolvedValueOnce({ listenerPort: '1522', ordsPort: '8443' })
    .mockResolvedValueOnce(credentials)
}

describe('database setup Settings fallback key', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.environment = 'dev'
    state.values.clear()
    state.randomBytes.mockReturnValue(Buffer.alloc(32, 0xab))
  })

  it('generates a 32-byte hexadecimal key and persists it without logging it', async () => {
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.randomBytes).toHaveBeenCalledExactlyOnceWith(32)
    const key = state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')
    expect(key).toMatch(/^[0-9a-f]{64}$/)
    expect(state.set).toHaveBeenCalledWith('ODBVUE_APP_MASTER_KEY', key)
    for (const [name, value] of [
      ['ODBVUE_ADB_ADMIN_PASSWORD', credentials.adminPassword],
      ['ODBVUE_ADB_WALLET_PASSWORD', credentials.walletPassword],
      ['ODBVUE_ADB_SCHEMA_USERNAME', credentials.schemaUsername],
      ['ODBVUE_ADB_SCHEMA_PASSWORD', credentials.schemaPassword],
      ['ODBVUE_APP_ADMIN_USERNAME', credentials.appUsername],
      ['ODBVUE_APP_ADMIN_PASSWORD', credentials.appPassword],
    ]) {
      expect(state.set).toHaveBeenCalledWith(name, value)
    }
    expect(state.info.mock.calls.flat().join('\n')).not.toContain(key)
  })

  it('preserves an existing key verbatim on repeated setup', async () => {
    const key = 'AB'.repeat(32)
    state.values.set('dev', new Map([['ODBVUE_APP_MASTER_KEY', key]]))
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.randomBytes).not.toHaveBeenCalled()
    expect(state.set.mock.calls.some(([name]) => name === 'ODBVUE_APP_MASTER_KEY')).toBe(false)
    expect(state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')).toBe(key)
  })

  it('does not rotate a generated key on the next setup run', async () => {
    preparePrompts()
    await runSetupOracleAdb()
    const key = state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.randomBytes).toHaveBeenCalledTimes(1)
    expect(state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')).toBe(key)
  })

  it('generates independent keys for separate environments', async () => {
    state.randomBytes
      .mockReturnValueOnce(Buffer.alloc(32, 0xab))
      .mockReturnValueOnce(Buffer.alloc(32, 0xcd))
    preparePrompts()
    await runSetupOracleAdb()
    state.environment = 'test'
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')).not.toBe(
      state.values.get('test')?.get('ODBVUE_APP_MASTER_KEY'),
    )
    expect(state.randomBytes).toHaveBeenCalledTimes(2)
  })

  it('treats an empty key as unconfigured', async () => {
    state.values.set('dev', new Map([['ODBVUE_APP_MASTER_KEY', '']]))
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.randomBytes).toHaveBeenCalledExactlyOnceWith(32)
  })

  it.each(['short', 'g'.repeat(64), 'a'.repeat(63), 'a'.repeat(65)])(
    'rejects an invalid existing key without changing configuration or credentials',
    async (key) => {
      state.values.set('dev', new Map([['ODBVUE_APP_MASTER_KEY', key]]))
      await expect(runSetupOracleAdb()).rejects.toThrow('64 hexadecimal')
      expect(state.randomBytes).not.toHaveBeenCalled()
      expect(state.prompts).not.toHaveBeenCalled()
      expect(state.addService).not.toHaveBeenCalled()
      expect(state.set).not.toHaveBeenCalled()
      expect(state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')).toBe(key)
    },
  )

  it('does not generate a key or overwrite credentials after incomplete prompts', async () => {
    state.prompts
      .mockResolvedValueOnce({ dbName: 'example-adb' })
      .mockResolvedValueOnce({ listenerPort: '1522', ordsPort: '8443' })
      .mockResolvedValueOnce({})
    await expect(runSetupOracleAdb()).rejects.toThrow('credential setup was incomplete')
    expect(state.randomBytes).not.toHaveBeenCalled()
    expect(state.set).not.toHaveBeenCalled()
  })
})
