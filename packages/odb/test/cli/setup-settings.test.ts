import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'
import { Command } from '../../../cli/node_modules/commander/esm.mjs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OdbExecutor, OracleExecuteResult } from '../../src/execution/executor.js'

type PromptQuestion = {
  name: string
  type: string
  initial?: string | number | boolean
  validate?: (value: number | string) => boolean | string
}

const require = createRequire(import.meta.url)
const NumberPrompt: new (options: {
  message: string
  initial?: string | number | boolean
  validate?: PromptQuestion['validate']
  stdin: PassThrough
  stdout: PassThrough
}) => {
  value: number | string
  error: boolean
  done: boolean
  submit(): Promise<void>
  close(): void
} = require('../../../cli/node_modules/prompts/lib/elements/number.js')

const state = vi.hoisted(() => ({
  readFile: vi.fn<(path: string, encoding: string) => Promise<string>>(),
  prompts:
    vi.fn<
      (
        questions: PromptQuestion[],
        options: { onCancel: () => void },
      ) => Promise<Record<string, unknown>>
    >(),
  config: vi.fn<(silent: boolean) => { user: string }>(),
  schema: 'APP',
  apiUrl: 'https://api.example.com/ords/app/',
  connection: {
    execute:
      vi.fn<(sql: string, bindings?: Record<string, unknown>) => Promise<OracleExecuteResult>>(),
    commit: vi.fn<() => Promise<void>>(),
    rollback: vi.fn<() => Promise<void>>(),
    close: vi.fn<() => Promise<void>>(),
  },
  info: vi.fn<(message: string) => void>(),
  success: vi.fn<(message: string) => void>(),
  warn: vi.fn<(message: string) => void>(),
  connected: vi.fn<(config: unknown) => void>(),
  fatal: vi.fn<(error: unknown) => void>(),
}))

vi.mock('node:fs/promises', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:fs/promises')>()),
  readFile: state.readFile,
}))
vi.mock('../../../cli/node_modules/prompts/index.js', () => ({ default: state.prompts }))
vi.mock('../../../cli/src/app/db-exec.js', () => ({ buildConnectionConfig: state.config }))
vi.mock('../../../cli/src/app/setup-environment.js', () => ({
  runSetupEnvironment: vi.fn<() => Promise<void>>(),
}))
vi.mock('../../../cli/src/app/setup-platforms.js', () => ({
  runSetupPlatforms: vi.fn<() => Promise<void>>(),
}))
vi.mock('../../../cli/src/app/setup-resources-oracle-adb.js', () => ({
  runSetupOracleAdb: vi.fn<() => Promise<void>>(),
}))
vi.mock('../../../cli/src/app/infra-up.js', () => ({ runInfraUp: vi.fn<() => Promise<void>>() }))
vi.mock('../../../cli/src/app/db-up.js', () => ({
  runDbUp: vi.fn<(target?: string) => Promise<void>>(),
}))
vi.mock('../../../cli/src/adapters/secrets-store.js', () => ({
  SecretsStore: class {
    get() {
      return state.schema
    }
  },
}))
vi.mock('../../../cli/src/adapters/config-store.js', () => ({
  ConfigStore: class {
    getConfig() {
      return { runtime: { apiUrl: state.apiUrl } }
    }
  },
}))
vi.mock('../../../cli/src/shared/logger.js', () => ({
  logger: { info: state.info, success: state.success, warn: state.warn, fatal: state.fatal },
}))
vi.mock('@odbvue/odb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/index.js')>()
  const { OdbExecutor } = await import('../../src/execution/executor.js')
  return {
    ...actual,
    withConnection: async (
      config: unknown,
      action: (connection: unknown, executor: OdbExecutor) => Promise<unknown>,
    ) => {
      state.connected(config)
      try {
        return await action(state.connection, new OdbExecutor(state.connection))
      } finally {
        await state.connection.close()
      }
    },
  }
})

import { deriveGoogleRedirectUri, runSetupSettings } from '../../../cli/src/app/setup-settings.js'
import { registerSetupSettingsCommand } from '../../../cli/src/commands/setup-settings.js'
import { registerSetupCommand } from '../../../cli/src/commands/setup.js'

const settings = {
  host: 'smtp.example.com',
  port: 587,
  username: "user'example",
  password: "password'with:bind",
  from_addr: 'admin@odbvue.com',
  from_name: 'Odbvue Admin',
  auth_jwt_issuer: 'odbvue',
  auth_jwt_expiration_seconds: 900,
  app_public_url: 'http://localhost:5173/',
  auth_google_enabled: false,
}
const bindings = {
  host: settings.host,
  port: settings.port,
  username: settings.username,
  password: settings.password,
  from_addr: settings.from_addr,
  from_name: settings.from_name,
  auth_jwt_issuer: settings.auth_jwt_issuer,
  port_value: '587',
  jwt_secret: expect.stringMatching(/^[0-9a-f]{64}$/),
  jwt_expiration: '900',
  app_public_url: settings.app_public_url,
  google_enabled: 'N',
}

describe('CLI SMTP, JWT, and application URL settings setup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.schema = 'APP'
    state.apiUrl = 'https://api.example.com/ords/app/'
    state.prompts.mockImplementation(async (questions) => {
      const answers: Record<string, unknown> = settings
      return Object.fromEntries(questions.map(({ name }) => [name, answers[name]]))
    })
    state.config.mockReturnValue({ user: 'ADMIN' })
    state.connection.execute.mockResolvedValue({})
  })

  it('prompts with the requested defaults and masks the password', async () => {
    await runSetupSettings()
    const [questions] = state.prompts.mock.calls[0]!
    expect(questions.map((question: { name: string }) => question.name)).toEqual([
      'auth_google_enabled',
      'host',
      'port',
      'username',
      'password',
      'from_addr',
      'from_name',
      'auth_jwt_issuer',
      'app_public_url',
      'auth_jwt_expiration_seconds',
    ])
    expect(questions).toContainEqual(expect.objectContaining({ name: 'port', initial: 587 }))
    expect(questions).toContainEqual(
      expect.objectContaining({ name: 'app_public_url', initial: 'http://localhost:5173/' }),
    )
    expect(questions).toContainEqual(
      expect.objectContaining({ name: 'password', type: 'password' }),
    )
    expect(questions).toContainEqual(
      expect.objectContaining({
        name: 'from_addr',
        initial: 'admin@odbvue.com',
      }),
    )
    expect(questions).toContainEqual(
      expect.objectContaining({
        name: 'from_name',
        initial: 'Odbvue Admin',
      }),
    )
    expect(
      questions.find((question: { name: string }) => question.name === 'host'),
    ).not.toHaveProperty('initial')
  })

  it('applies a complete file with mixed-case keys without prompting', async () => {
    state.readFile.mockResolvedValue(
      JSON.stringify({
        smtp_host: settings.host,
        SMTP_PORT: settings.port,
        Smtp_Username: settings.username,
        smtp_PASSWORD: settings.password,
        SMTP_FROM_ADDR: settings.from_addr,
        smtp_from_name: settings.from_name,
        Auth_Jwt_Issuer: settings.auth_jwt_issuer,
        AUTH_JWT_EXPIRATION_SECONDS: settings.auth_jwt_expiration_seconds,
        App_Public_Url: settings.app_public_url,
        AUTH_GOOGLE_ENABLED: false,
      }),
    )
    await expect(runSetupSettings('settings.json')).resolves.toBe(true)
    expect(state.readFile).toHaveBeenCalledWith('settings.json', 'utf-8')
    expect(state.prompts).not.toHaveBeenCalled()
    expect(state.connection.execute.mock.calls[0]![1]).toEqual(bindings)
    expect(state.connection.commit).toHaveBeenCalledTimes(1)
  })

  it('uses supplied values and prompts only for missing values', async () => {
    state.readFile.mockResolvedValue(
      JSON.stringify({ smtp_host: 'mail.example.com', smtp_port: 2525 }),
    )
    const { host: _host, port: _port, ...missing } = settings
    state.prompts.mockResolvedValue(missing)
    await expect(runSetupSettings('settings.json')).resolves.toBe(true)
    expect(state.prompts.mock.calls[0]![0].map((question) => question.name)).toEqual([
      'auth_google_enabled',
      'username',
      'password',
      'from_addr',
      'from_name',
      'auth_jwt_issuer',
      'app_public_url',
      'auth_jwt_expiration_seconds',
    ])
    expect(state.connection.execute.mock.calls[0]![1]).toMatchObject({
      username: missing.username,
      password: missing.password,
      from_addr: missing.from_addr,
      from_name: missing.from_name,
      auth_jwt_issuer: missing.auth_jwt_issuer,
      jwt_expiration: '900',
      host: 'mail.example.com',
      port: 2525,
      port_value: '2525',
    })
  })

  it.each([
    ['null', 'must contain a JSON object'],
    ['[]', 'must contain a JSON object'],
    ['"settings"', 'must contain a JSON object'],
    ['{"smtp_port":"587"}', 'Invalid setting: smtp_port'],
    ['{"smtp_host":null}', 'Invalid setting: smtp_host'],
    ['{"smtp_password":""}', 'Invalid setting: smtp_password'],
    ['{"smtp_port":0}', 'Invalid setting: smtp_port'],
    ['{"smtp_hots":"mail.example.com"}', 'Unknown setting key'],
    ['{"smtp_port":587,"SMTP_PORT":2525}', 'Duplicate setting key'],
    ['{"host":"mail.example.com"}', 'Unknown setting key'],
    ['{"auth_jwt_secret":""}', 'Invalid setting: auth_jwt_secret'],
    ['{"auth_jwt_secret":"   "}', 'Invalid setting: auth_jwt_secret'],
    ['{"auth_jwt_secret":null}', 'Invalid setting: auth_jwt_secret'],
    ['{"auth_jwt_issuer":"bad issuer"}', 'Invalid setting: auth_jwt_issuer'],
    ['{"auth_jwt_expiration_seconds":"900"}', 'Invalid setting: auth_jwt_expiration_seconds'],
    ['{"auth_jwt_expiration_seconds":86401}', 'Invalid setting: auth_jwt_expiration_seconds'],
    ['{"auth_jwt_expiration":900}', 'Unknown setting key'],
    ['{"app_public_url":null}', 'Invalid setting: app_public_url'],
    ['{"app_public_url":""}', 'Invalid setting: app_public_url'],
    ['{"app_public_url":"javascript:alert(1)"}', 'Invalid setting: app_public_url'],
    ['{"app_public_url":"https://example.com/?next=evil"}', 'Invalid setting: app_public_url'],
    [
      '{"app_public_url":"http://localhost:5173/","APP_PUBLIC_URL":"https://example.com/"}',
      'Duplicate setting key',
    ],
  ])('rejects an invalid file before prompting or connecting: %s', async (json, message) => {
    state.readFile.mockResolvedValue(json)
    await expect(runSetupSettings('settings.json')).rejects.toThrow(message)
    expect(state.prompts).not.toHaveBeenCalled()
    expect(state.connected).not.toHaveBeenCalled()
    expect(state.success).not.toHaveBeenCalled()
  })

  it('surfaces malformed JSON and file read errors without connecting', async () => {
    state.readFile.mockResolvedValue('{')
    await expect(runSetupSettings('settings.json')).rejects.toBeInstanceOf(SyntaxError)
    const error = new Error('File not found')
    state.readFile.mockRejectedValue(error)
    await expect(runSetupSettings('missing.json')).rejects.toBe(error)
    expect(state.prompts).not.toHaveBeenCalled()
    expect(state.connected).not.toHaveBeenCalled()
  })

  it('does not apply file values when a missing-value prompt is cancelled', async () => {
    state.readFile.mockResolvedValue('{"smtp_port":2525}')
    state.prompts.mockImplementation(async (_questions, options) => {
      options.onCancel()
      return {}
    })
    await expect(runSetupSettings('settings.json')).resolves.toBe(false)
    expect(state.connected).not.toHaveBeenCalled()
    expect(state.info).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
  })

  it.each(['setup-settings', 'ss'])('accepts the optional file argument via %s', async (name) => {
    state.readFile.mockResolvedValue('{"smtp_port":587}')
    const program = new Command()
    registerSetupSettingsCommand(program)
    await program.parseAsync([name, 'settings.json'], { from: 'user' })
    expect(state.readFile).toHaveBeenCalledWith('settings.json', 'utf-8')
    expect(state.connection.commit).toHaveBeenCalledTimes(1)
    expect(state.fatal).not.toHaveBeenCalled()
  })

  it('writes bound SMTP, JWT, and application URL values and updates the configured schema ACL in one transaction', async () => {
    state.schema = ' app '
    await expect(runSetupSettings()).resolves.toBe(true)
    const [sql, actualBindings] = state.connection.execute.mock.calls[0]!
    expect(actualBindings).toEqual(bindings)
    for (const [id, bind] of [
      ['SMTP_HOST', 'host'],
      ['SMTP_PORT', 'port_value'],
      ['SMTP_USERNAME', 'username'],
      ['SMTP_PASSWORD', 'password'],
      ['SMTP_FROM_ADDR', 'from_addr'],
      ['SMTP_FROM_NAME', 'from_name'],
      ['AUTH_JWT_SECRET', 'jwt_secret'],
      ['AUTH_JWT_ISSUER', 'auth_jwt_issuer'],
      ['AUTH_JWT_EXPIRATION_SECONDS', 'jwt_expiration'],
      ['APP_PUBLIC_URL', 'app_public_url'],
      ['AUTH_GOOGLE_ENABLED', 'google_enabled'],
    ]) {
      expect(sql).toContain(`APP.odb_settings.write('${id}', :${bind}, NULL)`)
    }
    expect(sql).toContain('APP.odb_acl.add_smtp(:host, :port)')
    expect(sql).not.toContain('DECLARE')
    expect(sql).not.toContain('SELECT')
    expect(sql).not.toContain('odb_settings.read')
    expect(sql).not.toContain('odb_acl.remove_smtp')
    expect(sql).not.toContain('rotate_jwt_secret')
    expect(sql).not.toContain('DBMS_NETWORK_ACL_ADMIN')
    expect(sql).not.toContain('dba_host_aces')
    expect(sql).not.toContain(settings.password)
    expect(sql).not.toContain(settings.username)
    expect(sql).not.toContain(settings.app_public_url)
    expect(state.connection.execute).toHaveBeenCalledTimes(1)
    expect(state.connection.commit).toHaveBeenCalledTimes(1)
    expect(state.connection.rollback).not.toHaveBeenCalled()
    expect(state.connection.close).toHaveBeenCalledTimes(1)
    expect(state.success).toHaveBeenCalledTimes(1)
    expect(state.warn).not.toHaveBeenCalled()
  })

  it('accepts Enter on the real number prompt without typing the displayed default', async () => {
    state.prompts.mockImplementation(async (questions) => {
      const portQuestion = questions.find((question) => question.name === 'port')!
      const stdin = new PassThrough()
      const stdout = new PassThrough()
      const prompt = new NumberPrompt({
        message: 'SMTP port',
        initial: portQuestion.initial,
        validate: portQuestion.validate,
        stdin,
        stdout,
      })
      try {
        expect(prompt.value).toBe('')
        await prompt.submit()
        expect(prompt.error).toBe(false)
        expect(prompt.done).toBe(true)
        expect(prompt.value).toBe(587)
        return { ...settings, port: prompt.value }
      } finally {
        prompt.close()
        stdin.destroy()
        stdout.destroy()
      }
    })
    await expect(runSetupSettings()).resolves.toBe(true)
    expect(state.connection.execute.mock.calls[0]![1]).toMatchObject({
      port: 587,
      port_value: '587',
    })
  })

  it('rolls back and surfaces an ACL or settings error without reporting success', async () => {
    const error = new Error('ACL update failed')
    state.connection.execute.mockRejectedValue(error)
    await expect(runSetupSettings()).rejects.toBe(error)
    expect(state.connection.rollback).toHaveBeenCalledTimes(1)
    expect(state.connection.commit).not.toHaveBeenCalled()
    expect(state.connection.close).toHaveBeenCalledTimes(1)
    expect(state.success).not.toHaveBeenCalled()
  })

  it('does not connect or change anything when a prompt is cancelled', async () => {
    state.prompts.mockImplementation(async (_questions, options) => {
      options.onCancel()
      return { host: settings.host }
    })
    await expect(runSetupSettings()).resolves.toBe(false)
    expect(state.config).not.toHaveBeenCalled()
    expect(state.connected).not.toHaveBeenCalled()
    expect(state.info).toHaveBeenCalledWith(expect.stringContaining('cancelled'))
    expect(state.success).not.toHaveBeenCalled()
  })

  it.each([
    { host: '' },
    { host: '*.example.com' },
    { host: 'https://smtp.example.com' },
    { port: 0 },
    { port: 65536 },
    { port: 587.5 },
    { username: '' },
    { password: '' },
    { from_addr: 'invalid' },
    { from_addr: 'a@example.com\r\nBcc: b@example.com' },
    { from_name: '' },
    { from_name: 'Admin\nInjected' },
    { app_public_url: 'example.com' },
    { app_public_url: 'https://example.com/#token=x' },
    { app_public_url: 'https://user:password@example.com/' },
    { app_public_url: 'https://example.com/ bad' },
    { app_public_url: 'https://example.com/<bad>' },
    { app_public_url: 'https://example.com/a&b' },
    { app_public_url: 'https:\\\\example.com' },
    { app_public_url: 'https://example.com/\u0000' },
    { app_public_url: 'https://example.com/' + 'a'.repeat(2000) },
  ])('rejects invalid settings before connecting: %j', async (invalid) => {
    state.prompts.mockResolvedValue({ ...settings, ...invalid })
    await expect(runSetupSettings()).rejects.toThrow('Invalid settings')
    expect(state.connected).not.toHaveBeenCalled()
  })

  it('rejects an unsafe schema identifier before connecting', async () => {
    state.schema = "APP'; DROP USER APP"
    await expect(runSetupSettings()).rejects.toThrow('A valid schema username is required')
    expect(state.connected).not.toHaveBeenCalled()
  })

  it.each([1, 65535])('accepts the port boundary %i', async (port) => {
    state.prompts.mockResolvedValue({ ...settings, port })
    await expect(runSetupSettings()).resolves.toBe(true)
    expect(state.connection.execute.mock.calls[0]![1]).toMatchObject({
      port,
      port_value: String(port),
    })
  })
  it('accepts an explicit key only as a bind variable and never logs it', async () => {
    const secret = 'aF'.repeat(32)
    state.readFile.mockResolvedValue(
      JSON.stringify({
        SMTP_HOST: settings.host,
        SMTP_PORT: settings.port,
        SMTP_USERNAME: settings.username,
        SMTP_PASSWORD: settings.password,
        SMTP_FROM_ADDR: settings.from_addr,
        SMTP_FROM_NAME: settings.from_name,
        AUTH_JWT_ISSUER: settings.auth_jwt_issuer,
        AUTH_JWT_EXPIRATION_SECONDS: settings.auth_jwt_expiration_seconds,
        AUTH_JWT_SECRET: secret,
        APP_PUBLIC_URL: settings.app_public_url,
        AUTH_GOOGLE_ENABLED: false,
      }),
    )
    await runSetupSettings('settings.json')
    expect(state.prompts).not.toHaveBeenCalled()
    const [sql, values] = state.connection.execute.mock.calls[0]!
    expect(values).toMatchObject({ jwt_secret: secret })
    expect(sql).not.toContain(secret)
    expect(
      JSON.stringify([
        ...state.info.mock.calls,
        ...state.success.mock.calls,
        ...state.warn.mock.calls,
      ]),
    ).not.toContain(secret)
  })

  it('normalizes short file text to a deterministic SHA-256 key without logging the text', async () => {
    state.readFile.mockResolvedValue('{"auth_jwt_secret":"abc"}')
    await runSetupSettings('settings.json')
    const [sql, values] = state.connection.execute.mock.calls[0]!
    expect(values).toMatchObject({
      jwt_secret: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    })
    expect(sql).not.toContain("'abc'")
    expect(state.warn).not.toHaveBeenCalled()
    expect(
      JSON.stringify([
        ...state.info.mock.calls,
        ...state.success.mock.calls,
        ...state.warn.mock.calls,
      ]),
    ).not.toContain('abc')
    await runSetupSettings('settings.json')
    expect(state.connection.execute.mock.calls[1]![1]).toEqual(values)
  })

  it('generates a new random key for each setup when no secret is supplied', async () => {
    await runSetupSettings()
    await runSetupSettings()
    const first = state.connection.execute.mock.calls[0]![1]?.jwt_secret
    const second = state.connection.execute.mock.calls[1]![1]?.jwt_secret
    expect(first).toMatch(/^[0-9a-f]{64}$/)
    expect(second).toMatch(/^[0-9a-f]{64}$/)
    expect(second).not.toBe(first)
    expect(state.warn).not.toHaveBeenCalled()
  })

  it('supports ov setup settings with a file', async () => {
    state.readFile.mockResolvedValue('{"auth_jwt_expiration_seconds":900}')
    const program = new Command()
    registerSetupCommand(program)
    await program.parseAsync(['setup', 'settings', 'settings.json'], {
      from: 'user',
    })
    expect(state.readFile).toHaveBeenCalledWith('settings.json', 'utf-8')
    expect(state.connection.commit).toHaveBeenCalledOnce()
    expect(state.fatal).not.toHaveBeenCalled()
  })

  it('prompts only for the application URL when importing an existing complete SMTP/JWT file', async () => {
    const { app_public_url, ...existing } = settings
    state.readFile.mockResolvedValue(
      JSON.stringify(
        Object.fromEntries(
          Object.entries(existing).map(([key, value]) => [
            key.startsWith('auth_') ? key : `smtp_${key}`,
            value,
          ]),
        ),
      ),
    )
    state.prompts.mockResolvedValue({ app_public_url })
    await expect(runSetupSettings('settings.json')).resolves.toBe(true)
    expect(state.prompts.mock.calls[0]![0].map((question) => question.name)).toEqual([
      'app_public_url',
    ])
    expect(state.connection.execute.mock.calls[0]![1]?.app_public_url).toBe(app_public_url)
  })

  it.each(['http://localhost:5173/', 'https://app.example.com/', 'https://example.com/odbvue'])(
    'accepts a valid application base URL: %s',
    async (app_public_url) => {
      state.prompts.mockResolvedValue({ ...settings, app_public_url })
      await runSetupSettings()
      expect(state.connection.execute.mock.calls[0]![1]?.app_public_url).toBe(app_public_url)
    },
  )

  it('does not expose JWT rotation options', () => {
    const program = new Command()
    registerSetupCommand(program)
    registerSetupSettingsCommand(program)
    for (const command of program.commands) {
      expect(command.helpInformation()).not.toContain('--rotate-jwt-secret')
    }
  })

  it.each([1, 86400])('accepts JWT expiration boundary %i', async (seconds) => {
    state.prompts.mockResolvedValue({ ...settings, auth_jwt_expiration_seconds: seconds })
    await runSetupSettings()
    expect(state.connection.execute.mock.calls[0]![1]).toMatchObject({
      jwt_expiration: String(seconds),
    })
  })

  it.each([
    { auth_jwt_issuer: '' },
    { auth_jwt_issuer: 'bad\nissuer' },
    { auth_jwt_expiration_seconds: 0 },
    { auth_jwt_expiration_seconds: 86401 },
    { auth_jwt_expiration_seconds: 1.5 },
  ])('rejects invalid prompted JWT configuration before connecting', async (invalid) => {
    state.prompts.mockResolvedValue({ ...settings, ...invalid })
    await expect(runSetupSettings()).rejects.toThrow('Invalid settings')
    expect(state.connected).not.toHaveBeenCalled()
  })

  describe('Google authorization code configuration', () => {
    const google = {
      auth_google_enabled: true,
      auth_google_client_id:
        '1072025622820-jodheg6ka328ga1rgueo0u65q856hmfo.apps.googleusercontent.com',
      auth_google_client_secret: "secret'with:bind",
    }

    it('asks whether to enable Google even when absent from a complete legacy file', async () => {
      const { auth_google_enabled: _enabled, ...legacy } = settings
      state.readFile.mockResolvedValue(
        JSON.stringify(
          Object.fromEntries(
            Object.entries(legacy).map(([key, value]) => [
              key.startsWith('auth_') || key === 'app_public_url' ? key : `smtp_${key}`,
              value,
            ]),
          ),
        ),
      )
      state.prompts.mockResolvedValue({ auth_google_enabled: false })
      await runSetupSettings('settings.json')
      expect(state.prompts.mock.calls[0]![0]).toEqual([
        expect.objectContaining({ name: 'auth_google_enabled', type: 'confirm', initial: false }),
      ])
      expect(state.connection.execute.mock.calls[0]![0]).not.toContain('AUTH_GOOGLE_CLIENT_SECRET')
    })

    it('prompts only for missing enabled configuration and masks the client secret', async () => {
      state.readFile.mockResolvedValue(
        JSON.stringify({
          AUTH_GOOGLE_ENABLED: 'Y',
          GOOGLE_CLIENT_ID: google.auth_google_client_id,
        }),
      )
      state.prompts.mockResolvedValueOnce(settings).mockResolvedValueOnce(google)
      await runSetupSettings('settings.json')
      const questions = state.prompts.mock.calls[1]![0]
      expect(questions.map(({ name }) => name)).toEqual(['auth_google_client_secret'])
      expect(questions).toContainEqual(
        expect.objectContaining({ name: 'auth_google_client_secret', type: 'password' }),
      )
    })

    it.each(['AUTH_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID'])(
      'accepts case-insensitive client ID alias %s without implicitly enabling Google',
      async (alias) => {
        state.readFile.mockResolvedValue(
          JSON.stringify({ [alias.toLowerCase()]: google.auth_google_client_id }),
        )
        await runSetupSettings('settings.json')
        expect(state.prompts).toHaveBeenCalledTimes(1)
        const [sql, values] = state.connection.execute.mock.calls[0]!
        expect(values?.google_enabled).toBe('N')
        expect(sql).not.toContain('AUTH_GOOGLE_CLIENT_SECRET')
        expect(sql).not.toContain('add_http')
        expect(values).not.toHaveProperty('auth_google_client_id')
      },
    )

    it.each([true, 'Y'])(
      'persists enabled=%s with bound secret metadata and exact HTTPS ACLs',
      async (enabled) => {
        state.readFile.mockResolvedValue(
          JSON.stringify({ ...google, auth_google_enabled: enabled }),
        )
        await runSetupSettings('settings.json')
        const [sql, values] = state.connection.execute.mock.calls[0]!
        expect(values).toMatchObject({
          google_enabled: 'Y',
          auth_google_client_id: google.auth_google_client_id,
          auth_google_client_secret: google.auth_google_client_secret,
          auth_google_redirect_uri: 'http://localhost:5173/api/auth/google/callback',
          auth_google_link_redirect_uri: 'http://localhost:5173/api/auth/google/link/callback',
          google_secret_meta: '{"secret":"Y"}',
        })
        expect(sql).toContain(
          "APP.odb_settings.write('AUTH_GOOGLE_CLIENT_SECRET', :auth_google_client_secret, :google_secret_meta)",
        )
        expect(sql).toContain(
          "APP.odb_settings.write('AUTH_GOOGLE_REDIRECT_URI', :auth_google_redirect_uri, NULL)",
        )
        expect(sql).toContain(
          "APP.odb_settings.write('AUTH_GOOGLE_LINK_REDIRECT_URI', :auth_google_link_redirect_uri, NULL)",
        )
        expect(sql).toContain("APP.odb_acl.add_http('www.googleapis.com', 443)")
        expect(sql).toContain("APP.odb_acl.add_http('oauth2.googleapis.com', 443)")
        expect(sql.match(/odb_acl\.add_http/g)).toHaveLength(2)
        expect(sql).not.toContain('WALLET')
        expect(values).not.toHaveProperty('auth_google_wallet_path')
        expect(sql).not.toContain(google.auth_google_client_secret)
        expect(JSON.stringify(state.success.mock.calls)).not.toContain(
          google.auth_google_client_secret,
        )
        expect(state.connection.commit).toHaveBeenCalledOnce()
      },
    )

    it.each([false, 'N'])(
      'preserves existing Google credentials when disabled=%s',
      async (enabled) => {
        state.readFile.mockResolvedValue(
          JSON.stringify({ ...google, auth_google_enabled: enabled }),
        )
        await runSetupSettings('settings.json')
        const [sql, values] = state.connection.execute.mock.calls[0]!
        expect(values?.google_enabled).toBe('N')
        expect(values).not.toHaveProperty('auth_google_client_secret')
        expect(sql).not.toContain('AUTH_GOOGLE_CLIENT_SECRET')
        expect(sql).not.toContain('add_http')
      },
    )

    it.each([
      ['AUTH_GOOGLE_ENABLED', 'true'],
      ['AUTH_GOOGLE_ENABLED', 'yes'],
      ['AUTH_GOOGLE_ENABLED', 1],
      ['AUTH_GOOGLE_CLIENT_ID', 'not-a-client-id'],
      ['AUTH_GOOGLE_CLIENT_SECRET', ''],
      ['AUTH_GOOGLE_REDIRECT_URI', 'http://api.example.com/callback'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'http://localhost.evil.com/callback'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'http://127.1/callback'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'https://*.example.com/callback'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'https://api.example.com/{callback}'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'https://api.example.com/callback?next=evil'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'https://api.example.com/callback#fragment'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'https://user:pass@api.example.com/callback'],
      ['AUTH_GOOGLE_REDIRECT_URI', 'https://api.example.com/callback%0a'],
    ])('rejects invalid file setting %s=%j before prompting or connecting', async (key, value) => {
      state.readFile.mockResolvedValue(JSON.stringify({ [key]: value }))
      await expect(runSetupSettings('settings.json')).rejects.toThrow(
        key === 'AUTH_GOOGLE_REDIRECT_URI' ? 'derived automatically' : 'Invalid setting',
      )
      expect(state.prompts).not.toHaveBeenCalled()
      expect(state.connected).not.toHaveBeenCalled()
    })

    it.each(['GOOGLE_CLIENT_ID', 'VITE_GOOGLE_CLIENT_ID', 'auth_google_client_id'])(
      'rejects duplicate client ID alias %s',
      async (alias) => {
        state.readFile.mockResolvedValue(
          JSON.stringify({
            AUTH_GOOGLE_CLIENT_ID: google.auth_google_client_id,
            [alias]: google.auth_google_client_id,
          }),
        )
        await expect(runSetupSettings('settings.json')).rejects.toThrow('Duplicate setting key')
        expect(state.connected).not.toHaveBeenCalled()
      },
    )

    it.each([
      ['https://app.example.com/', 'https://api.example.com/ords/app/auth/google/callback'],
      ['http://localhost:8080/', 'http://localhost:8080/api/auth/google/callback'],
      ['http://127.0.0.1:8080/', 'http://127.0.0.1:8080/api/auth/google/callback'],
      ['http://[::1]:8080/', 'http://[::1]:8080/api/auth/google/callback'],
    ])(
      'derives the callback for %s without deployment-specific options',
      async (appUrl, redirect) => {
        state.readFile.mockResolvedValue(
          JSON.stringify({
            ...google,
            app_public_url: appUrl,
          }),
        )
        await runSetupSettings('settings.json')
        expect(state.connection.execute.mock.calls[0]![1]).toMatchObject({
          auth_google_redirect_uri: redirect,
          auth_google_link_redirect_uri: redirect.replace(/\/callback$/, '/link/callback'),
        })
        expect(state.info).toHaveBeenCalledWith(
          `Register this Google OAuth redirect URI: ${redirect}`,
        )
        expect(state.info).toHaveBeenCalledWith(
          `Register this Google OAuth linking redirect URI: ${redirect.replace(/\/callback$/, '/link/callback')}`,
        )
      },
    )

    it('rejects the removed wallet option before prompting or connecting', async () => {
      state.readFile.mockResolvedValue(JSON.stringify({ AUTH_GOOGLE_WALLET_PATH: 'file:/wallet' }))
      await expect(runSetupSettings('settings.json')).rejects.toThrow('Unknown setting key')
      expect(state.prompts).not.toHaveBeenCalled()
      expect(state.connected).not.toHaveBeenCalled()
    })

    it.each([
      'auth_google_redirect_uri',
      'AUTH_GOOGLE_REDIRECT_URI',
      'auth_google_link_redirect_uri',
      'AUTH_GOOGLE_LINK_REDIRECT_URI',
    ])('rejects a manually configured callback %s with migration guidance', async (key) => {
      state.readFile.mockResolvedValue(
        JSON.stringify({ [key]: 'https://api.example.com/callback' }),
      )
      await expect(runSetupSettings('settings.json')).rejects.toThrow('derived automatically')
      expect(state.prompts).not.toHaveBeenCalled()
      expect(state.connected).not.toHaveBeenCalled()
    })

    it('does not write a callback when Google is disabled', async () => {
      await runSetupSettings()
      expect(state.connection.execute.mock.calls[0]![0]).not.toContain('AUTH_GOOGLE_REDIRECT_URI')
      expect(state.connection.execute.mock.calls[0]![0]).not.toContain(
        'AUTH_GOOGLE_LINK_REDIRECT_URI',
      )
    })

    it('fails before connecting when production has no configured runtime API URL', async () => {
      state.apiUrl = ''
      state.readFile.mockResolvedValue(
        JSON.stringify({ ...google, app_public_url: 'https://app.example.com/' }),
      )
      await expect(runSetupSettings('settings.json')).rejects.toThrow('runtime.apiUrl')
      expect(state.connected).not.toHaveBeenCalled()
    })

    it.each([
      'http://api.example.com/ords/app/',
      'https://api.example.com/ords/app/?next=evil',
      'https://api.example.com/ords/app/#fragment',
      'https://user:password@api.example.com/',
      'https://api.example.com/%0a',
    ])('rejects an unsafe production API URL %s before connecting', async (apiUrl) => {
      state.apiUrl = apiUrl
      state.readFile.mockResolvedValue(
        JSON.stringify({ ...google, app_public_url: 'https://app.example.com/' }),
      )
      await expect(runSetupSettings('settings.json')).rejects.toThrow('valid HTTPS Google callback')
      expect(state.connected).not.toHaveBeenCalled()
    })

    it('cancels enabled follow-up prompts without connecting', async () => {
      state.prompts.mockResolvedValueOnce({ ...settings, auth_google_enabled: true })
      state.prompts.mockImplementationOnce(async (_questions, options) => {
        options.onCancel()
        return {}
      })
      await expect(runSetupSettings()).resolves.toBe(false)
      expect(state.connected).not.toHaveBeenCalled()
    })

    it('offers only the public client ID as an initial value when enabling interactively', async () => {
      state.prompts.mockResolvedValueOnce({ ...settings, auth_google_enabled: true })
      state.prompts.mockResolvedValueOnce(google)
      await runSetupSettings()
      expect(state.prompts.mock.calls[1]![0].map(({ name }) => name)).toEqual([
        'auth_google_client_id',
        'auth_google_client_secret',
      ])
      expect(state.prompts.mock.calls[1]![0]).toContainEqual(
        expect.objectContaining({
          name: 'auth_google_client_id',
          initial: google.auth_google_client_id,
        }),
      )
      expect(
        state.prompts.mock.calls[1]![0].find(({ name }) => name === 'auth_google_client_secret'),
      ).not.toHaveProperty('initial')
    })

    it('rejects invalid prompted Google values before connecting', async () => {
      state.prompts.mockResolvedValueOnce({ ...settings, auth_google_enabled: true })
      state.prompts.mockResolvedValueOnce({ ...google, auth_google_client_secret: '' })
      await expect(runSetupSettings()).rejects.toThrow('Invalid settings')
      expect(state.connected).not.toHaveBeenCalled()
    })

    it('documents the server-only secret and enabled/alias contract in command help', () => {
      const program = new Command()
      registerSetupSettingsCommand(program)
      let help = ''
      program.commands[0]!.configureOutput({
        writeOut: (text) => {
          help += text
        },
      }).outputHelp()
      expect(help).toContain('AUTH_GOOGLE_ENABLED accepts "Y"/"N" or true/false')
      expect(help).toContain('VITE_GOOGLE_CLIENT_ID')
      expect(help).toContain('redirect URI is derived automatically')
      expect(help).toContain('Never store the client secret in frontend config')
    })
  })

  describe('Google callback URL derivation', () => {
    it.each<[string, string | undefined, string]>([
      ['http://localhost:5173', undefined, 'http://localhost:5173/api/auth/google/callback'],
      [
        'http://localhost:5173///',
        'https://ignored.example.com/',
        'http://localhost:5173/api/auth/google/callback',
      ],
      [
        'https://app.example.com/',
        'https://api.example.com/ords/app///',
        'https://api.example.com/ords/app/auth/google/callback',
      ],
      [
        'https://app.example.com/',
        'https://app.example.com/api/',
        'https://app.example.com/api/auth/google/callback',
      ],
    ])('normalizes %s with API base %s to %s', (appUrl, apiUrl, expected) => {
      expect(deriveGoogleRedirectUri(appUrl, apiUrl)).toBe(expected)
    })

    it.each([
      'http://app.example.com/',
      'http://localhost.evil.com/',
      'http://127.1/',
      'https://*.example.com/',
      'https://app.example.com/{base}',
      'https://app.example.com/%0a',
    ])('rejects unsafe application URL %s', (appUrl) => {
      expect(() => deriveGoogleRedirectUri(appUrl, state.apiUrl)).toThrow('APP_PUBLIC_URL')
    })
  })
})
