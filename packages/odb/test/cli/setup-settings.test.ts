import { createRequire } from 'node:module'
import { PassThrough } from 'node:stream'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { OdbExecutor, OracleExecuteResult } from '../../src/execution/executor.js'

type PromptQuestion = {
  name: string
  type: string
  initial?: string | number
  validate?: (value: number | string) => boolean | string
}

const require = createRequire(import.meta.url)
const NumberPrompt: new (options: {
  message: string
  initial?: string | number
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
  prompts:
    vi.fn<
      (
        questions: PromptQuestion[],
        options: { onCancel: () => void },
      ) => Promise<Record<string, unknown>>
    >(),
  config: vi.fn<(silent: boolean) => { user: string }>(),
  schema: 'APP',
  connection: {
    execute:
      vi.fn<(sql: string, bindings?: Record<string, unknown>) => Promise<OracleExecuteResult>>(),
    commit: vi.fn<() => Promise<void>>(),
    rollback: vi.fn<() => Promise<void>>(),
    close: vi.fn<() => Promise<void>>(),
  },
  info: vi.fn<(message: string) => void>(),
  success: vi.fn<(message: string) => void>(),
  connected: vi.fn<(config: unknown) => void>(),
}))

vi.mock('../../../cli/node_modules/prompts/index.js', () => ({ default: state.prompts }))
vi.mock('../../../cli/src/app/db-exec.js', () => ({ buildConnectionConfig: state.config }))
vi.mock('../../../cli/src/adapters/secrets-store.js', () => ({
  SecretsStore: class {
    get() {
      return state.schema
    }
  },
}))
vi.mock('../../../cli/src/shared/logger.js', () => ({
  logger: { info: state.info, success: state.success },
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

import { runSetupSettings } from '../../../cli/src/app/setup-settings.js'

const settings = {
  host: 'smtp.example.com',
  port: 587,
  username: "user'example",
  password: "password'with:bind",
  from_addr: 'admin@odbvue.com',
  from_name: 'Odbvue Admin',
}

describe('CLI SMTP settings setup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    state.schema = 'APP'
    state.prompts.mockResolvedValue({ ...settings })
    state.config.mockReturnValue({ user: 'ADMIN' })
    state.connection.execute.mockResolvedValue({})
  })

  it('prompts with the requested defaults and masks the password', async () => {
    await runSetupSettings()
    const [questions] = state.prompts.mock.calls[0]!
    expect(questions.map((question: { name: string }) => question.name)).toEqual([
      'host',
      'port',
      'username',
      'password',
      'from_addr',
      'from_name',
    ])
    expect(questions).toContainEqual(expect.objectContaining({ name: 'port', initial: 587 }))
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

  it('writes six bound values and updates the configured schema ACL in one transaction', async () => {
    state.schema = ' app '
    await expect(runSetupSettings()).resolves.toBe(true)
    const [sql, bindings] = state.connection.execute.mock.calls[0]!
    expect(bindings).toEqual({ ...settings, port_value: '587', schema: 'APP' })
    for (const [id, bind] of [
      ['SMTP_HOST', 'host'],
      ['SMTP_PORT', 'port_value'],
      ['SMTP_USERNAME', 'username'],
      ['SMTP_PASSWORD', 'password'],
      ['SMTP_FROM_ADDR', 'from_addr'],
      ['SMTP_FROM_NAME', 'from_name'],
    ]) {
      expect(sql).toContain(`APP.odb_settings.write('${id}', :${bind}, NULL)`)
    }
    expect(sql).toContain(
      'DBMS_NETWORK_ACL_ADMIN.APPEND_HOST_ACE(host => :host, lower_port => :port, upper_port => :port',
    )
    expect(sql).toContain("privilege_list => XS$NAME_LIST('smtp'), principal_name => :schema")
    expect(sql).toContain('IF l_old_host <> :host OR l_old_port <> :port THEN')
    expect(sql).toContain('FROM dba_host_aces')
    expect(sql).toContain(
      "AND principal = :schema AND lower(privilege) = 'smtp' AND grant_type = 'GRANT'",
    )
    expect(sql).toContain('IF l_count > 0 THEN')
    expect(sql).toContain(
      'DBMS_NETWORK_ACL_ADMIN.REMOVE_HOST_ACE(host => l_old_host, lower_port => l_old_port, upper_port => l_old_port',
    )
    expect(sql).not.toContain(settings.password)
    expect(sql).not.toContain(settings.username)
    expect(state.connection.execute).toHaveBeenCalledTimes(1)
    expect(state.connection.commit).toHaveBeenCalledTimes(1)
    expect(state.connection.rollback).not.toHaveBeenCalled()
    expect(state.connection.close).toHaveBeenCalledTimes(1)
    expect(state.success).toHaveBeenCalledTimes(1)
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
  ])('rejects invalid settings before connecting: %j', async (invalid) => {
    state.prompts.mockResolvedValue({ ...settings, ...invalid })
    await expect(runSetupSettings()).rejects.toThrow('Invalid SMTP settings')
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
})
