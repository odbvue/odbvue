// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
import { createI18n } from 'vue-i18n'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { odbVueI18nPlugin } from '../../plugins/i18n'

let fixture: string | undefined
let server: ViteDevServer | undefined

afterEach(async () => {
  await server?.close()
  server = undefined
  vi.restoreAllMocks()
  if (fixture) rmSync(fixture, { recursive: true })
  fixture = undefined
})

function writeCatalog(path: string, messages: Record<string, unknown>) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(messages))
}

describe('application locale discovery and collection', () => {
  it.each(['i18n', 'translations'])(
    'discovers, inventories, and collects application messages in app/%s',
    async (appLocalesDir) => {
      fixture = mkdtempSync(join(tmpdir(), 'odbvue-i18n-'))
      const catalog = resolve(fixture, 'src', 'app', appLocalesDir, 'en.json')
      const pageCatalog = resolve(fixture, 'src', 'app', 'pages', 'login', 'i18n', 'en.json')
      mkdirSync(dirname(pageCatalog), { recursive: true })
      writeFileSync(resolve(fixture, 'src', 'app', 'pages', 'login.vue'), '<template />')
      writeCatalog(catalog, { greeting: 'Hello', auth: { login: 'Login' } })
      writeCatalog(resolve(fixture, 'src', 'modules', 'sandbox', 'i18n', 'en.json'), {
        sandbox: 'Sandbox',
      })
      writeCatalog(resolve(fixture, 'src', 'capabilities', 'ui', 'themes', 'themes.json'), {})
      vi.spyOn(process, 'cwd').mockReturnValue(fixture)
      server = await createServer({
        configFile: false,
        root: fixture,
        logLevel: 'silent',
        server: { host: '127.0.0.1', port: 0 },
        optimizeDeps: { noDiscovery: true },
        plugins: odbVueI18nPlugin({
          ...(appLocalesDir === 'i18n' ? {} : { appLocalesDir }),
          locales: ['en'],
          flushDelay: 1,
        }),
      })
      await server.listen()

      const result = await server.environments.client!.pluginContainer.load(
        '\0virtual:odbvue-i18n-inventory',
      )
      const code = typeof result === 'string' ? result : result?.code
      expect(code).toBe('export default {"app":{"en":2},"modules":{"sandbox":{"en":1}}}')

      const address = server.httpServer?.address()
      if (!address || typeof address === 'string') throw new Error('Missing Vite server address')
      const origin = `http://127.0.0.1:${address.port}`
      for (const [referer, path, key] of [
        ['/', catalog, 'app.new'],
        ['/login', pageCatalog, 'login.new'],
      ] as const) {
        const response = await fetch(`${origin}/i18n-add`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Connection: 'close' },
          body: JSON.stringify({
            referer: `${origin}${referer}`,
            data: { locale: 'en', key, value: 'New translation' },
          }),
        })
        expect(response.status).toBe(200)
        await vi.waitFor(() => {
          expect(JSON.parse(readFileSync(path, 'utf-8'))).toMatchObject({
            [key]: 'New translation',
          })
        })
      }
      expect(existsSync(resolve(fixture, 'src', 'app', 'locales'))).toBe(false)
    },
  )

  it('collects dynamic-route messages beside source pages and skips existing shared/module keys', async () => {
    fixture = mkdtempSync(join(tmpdir(), 'odbvue-i18n-'))
    const users = resolve(fixture, 'src', 'modules', 'admin', 'pages', 'users')
    mkdirSync(users, { recursive: true })
    writeFileSync(join(users, 'index.vue'), '<template />')
    writeFileSync(join(users, '[id].vue'), '<template />')
    for (const locale of ['en', 'de', 'fr']) {
      writeCatalog(resolve(fixture, 'src', 'app', 'i18n', `${locale}.json`), {
        'copy.to.clipboard': 'Copy',
        nested: { existing: 'Nested translation' },
      })
      writeCatalog(resolve(fixture, 'src', 'modules', 'admin', 'i18n', `${locale}.json`), {
        'admin.audit': 'Audit',
      })
    }
    vi.spyOn(process, 'cwd').mockReturnValue(fixture)
    server = await createServer({
      configFile: false,
      root: fixture,
      logLevel: 'silent',
      server: { host: '127.0.0.1', port: 0 },
      optimizeDeps: { noDiscovery: true },
      plugins: odbVueI18nPlugin({ flushDelay: 1 }),
    })
    await server.listen()
    const address = server.httpServer?.address()
    if (!address || typeof address === 'string') throw new Error('Missing Vite server address')
    const origin = `http://127.0.0.1:${address.port}`
    const userId = '60225ccbaa610087e0630205590a0424'
    for (const key of [
      'admin.audit',
      'copy.to.clipboard',
      'nested.existing',
      'admin.newActivity',
    ]) {
      const response = await fetch(`${origin}/i18n-add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          referer: `${origin}/admin/users/${userId}`,
          data: { locale: 'de', key, value: 'New activity message' },
        }),
      })
      expect(response.status).toBe(200)
    }
    await vi.waitFor(() => {
      for (const locale of ['en', 'de', 'fr']) {
        expect(JSON.parse(readFileSync(join(users, 'i18n', `${locale}.json`), 'utf-8'))).toEqual({
          'admin.newActivity': locale === 'de' ? 'New activity message' : 'admin.newActivity',
        })
      }
    })
    expect(existsSync(join(users, userId))).toBe(false)
  })

  it('translates audit and shared dialog labels from the actual merged application catalogs', async () => {
    server = await createServer({
      configFile: false,
      logLevel: 'silent',
      optimizeDeps: { noDiscovery: true },
      plugins: odbVueI18nPlugin(),
    })
    const { default: messages } = await server.ssrLoadModule('@intlify/unplugin-vue-i18n/messages')
    const i18n = createI18n({ legacy: false, messages })
    for (const locale of ['en', 'de', 'fr']) {
      const appMessages = JSON.parse(
        readFileSync(new URL(`../../src/app/i18n/${locale}.json`, import.meta.url), 'utf-8'),
      )
      const adminMessages = JSON.parse(
        readFileSync(
          new URL(`../../src/modules/admin/i18n/${locale}.json`, import.meta.url),
          'utf-8',
        ),
      )
      const sandboxMessages = JSON.parse(
        readFileSync(
          new URL(`../../src/modules/sandbox/i18n/${locale}.json`, import.meta.url),
          'utf-8',
        ),
      )
      for (const key of [
        'copy.to.clipboard',
        'close',
        'filter',
        'attributes',
        'errors.requestFailed',
        'errors.invalidFields',
      ]) {
        expect(i18n.global.t(key, {}, { locale })).toBe(appMessages[key])
        expect(i18n.global.t(key, {}, { locale })).not.toBe(key)
      }
      expect(i18n.global.t('admin.audit', {}, { locale })).toBe(adminMessages['admin.audit'])
      expect(i18n.global.t('admin.audit', {}, { locale })).not.toBe('admin.audit')
      for (const key of ['sandbox.scheduler', 'sandbox.schedulerDescription']) {
        expect(i18n.global.t(key, {}, { locale })).toBe(sandboxMessages[key])
        expect(i18n.global.t(key, {}, { locale })).not.toBe(key)
      }
      for (const key of [
        'admin.settingValidationError',
        'admin.settingTooLong',
        'admin.settingSecretRequired',
        'admin.jobAuditWarning',
        'errors.SETTINGS_REQUIRE_TRUSTED_SETUP',
        'errors.SETTING_NOT_FOUND',
      ]) {
        expect(i18n.global.t(key, {}, { locale })).toBe(adminMessages[key])
        expect(i18n.global.t(key, {}, { locale })).not.toBe(key)
      }
      expect(i18n.global.t('errors.requestFailedReference', { traceId: 'ref' }, { locale })).toBe(
        appMessages['errors.requestFailedReference'].replace('{traceId}', 'ref'),
      )
    }
  })
})
