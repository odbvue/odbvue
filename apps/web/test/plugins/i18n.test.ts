// @vitest-environment node

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { createServer, type ViteDevServer } from 'vite'
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
          headers: { 'Content-Type': 'application/json' },
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
})
