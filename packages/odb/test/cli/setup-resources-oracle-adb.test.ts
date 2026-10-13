import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  environment: 'dev',
  values: new Map<string, Map<string, string>>(),
  prompts: vi.fn<(questions: unknown) => Promise<Record<string, string>>>(),
  set: vi.fn<(key: string, value: string) => void>(),
  info: vi.fn<(message: string) => void>(),
  addService: vi.fn<(service: unknown) => void>(),
}))

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

describe('database setup credentials', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.environment = 'dev'
    state.values.clear()
  })

  it('persists credentials without creating a Settings master key', async () => {
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.values.get('dev')?.has('ODBVUE_APP_MASTER_KEY')).toBe(false)
    expect(state.set).toHaveBeenCalledTimes(6)
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
    expect(state.info.mock.calls.flat().join('\n')).not.toContain('fallback key')
  })

  it.each(['AB'.repeat(32), 'obsolete-key', ''])(
    'ignores an existing retired key %s',
    async (key) => {
      state.values.set('dev', new Map([['ODBVUE_APP_MASTER_KEY', key]]))
      preparePrompts()
      await runSetupOracleAdb()
      expect(state.set.mock.calls.some(([name]) => name === 'ODBVUE_APP_MASTER_KEY')).toBe(false)
      expect(state.values.get('dev')?.get('ODBVUE_APP_MASTER_KEY')).toBe(key)
    },
  )

  it('does not create a master key on repeated setup', async () => {
    preparePrompts()
    await runSetupOracleAdb()
    preparePrompts()
    await runSetupOracleAdb()
    expect(state.values.get('dev')?.has('ODBVUE_APP_MASTER_KEY')).toBe(false)
    expect(state.set).toHaveBeenCalledTimes(12)
  })

  it('keeps credential setup isolated to each environment without generating keys', async () => {
    preparePrompts()
    await runSetupOracleAdb()
    state.environment = 'test'
    preparePrompts()
    await runSetupOracleAdb()
    for (const environment of ['dev', 'test']) {
      expect(state.values.get(environment)?.get('ODBVUE_ADB_SCHEMA_USERNAME')).toBe('APP')
      expect(state.values.get(environment)?.has('ODBVUE_APP_MASTER_KEY')).toBe(false)
    }
  })

  it('does not overwrite credentials after incomplete prompts', async () => {
    state.prompts
      .mockResolvedValueOnce({ dbName: 'example-adb' })
      .mockResolvedValueOnce({ listenerPort: '1522', ordsPort: '8443' })
      .mockResolvedValueOnce({})
    await expect(runSetupOracleAdb()).rejects.toThrow('credential setup was incomplete')
    expect(state.set).not.toHaveBeenCalled()
  })
})
