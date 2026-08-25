import { existsSync, statSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import type { Plugin, PluginOption, ViteDevServer } from 'vite'

type I18nScope = { type: 'shared' } | { type: 'page'; pageDir: string }
type I18nCacheKey = `${string}:${string}:${string}`
type I18nCache = Map<I18nCacheKey, { scope: I18nScope; locale: string; key: string; value: string }>

export type OdbVueI18nViteOptions = {
  locales?: string[]
  dumpInterval?: number
  flushDelay?: number
  i18nDir?: string
  include?: string[]
}

function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory()
  } catch {
    return false
  }
}

function resolveI18nScopeFromPathname(pathname: string): I18nScope {
  const normalizedPath = pathname.replace(/\/+$/, '')
  if (!normalizedPath || normalizedPath === '/') return { type: 'shared' }

  const [moduleName, ...pageSegments] = normalizedPath.replace(/^\//, '').split('/')
  const moduleRoot = path.resolve(process.cwd(), 'src', 'modules', moduleName)
  if (isDirectory(moduleRoot)) {
    return {
      type: 'page',
      pageDir:
        pageSegments.length === 0 ? moduleRoot : path.resolve(moduleRoot, 'pages', ...pageSegments),
    }
  }

  const pagesRoot = path.resolve(process.cwd(), 'src', 'pages')
  const pageDir = path.resolve(pagesRoot, normalizedPath.replace(/^\//, ''))
  return isDirectory(pageDir) ? { type: 'page', pageDir } : { type: 'page', pageDir }
}

function getScopeKey(scope: I18nScope): string {
  return scope.type === 'shared'
    ? 'shared'
    : path.relative(process.cwd(), scope.pageDir).replaceAll('\\', '/')
}

function getI18nPath(scope: I18nScope, locale: string, i18nDir: string): string {
  return scope.type === 'page'
    ? path.resolve(scope.pageDir, i18nDir, `${locale}.json`)
    : path.resolve(process.cwd(), 'src', i18nDir, `${locale}.json`)
}

/** Adds OdbVue's generated-message and missing-key development plugins. */
export function odbVueI18nPlugin(options: OdbVueI18nViteOptions = {}): PluginOption[] {
  const {
    include = [
      'src/i18n/**',
      'src/pages/**/i18n/**',
      'src/modules/*/i18n/**',
      'src/modules/*/pages/**/i18n/**',
    ],
  } = options
  return [VueI18nPlugin({ include }), i18nDevPlugin(options)]
}

/** Records missing translations to the matching shared or page locale file in development. */
export function i18nDevPlugin(options: OdbVueI18nViteOptions = {}): Plugin {
  const {
    locales = ['en', 'fr', 'de'],
    dumpInterval = 300_000,
    flushDelay = 500,
    i18nDir = 'i18n',
  } = options
  const supportedLocales = new Set(locales)
  const i18nCache: I18nCache = new Map()
  let timer: NodeJS.Timeout | null = null
  let flushTimer: NodeJS.Timeout | null = null

  function scheduleDump() {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flushTimer = null
      void dumpI18nData()
    }, flushDelay)
  }

  async function dumpI18nData() {
    if (i18nCache.size === 0) return

    const fileGroups = new Map<string, Record<string, string>>()
    for (const [, item] of i18nCache) {
      const filePath = getI18nPath(item.scope, item.locale, i18nDir)
      if (!fileGroups.has(filePath)) fileGroups.set(filePath, {})
      fileGroups.get(filePath)![item.key] = item.value
    }

    await Promise.allSettled(
      Array.from(fileGroups.entries()).map(async ([filePath, translations]) => {
        const dir = path.dirname(filePath)
        if (!existsSync(dir)) await fs.mkdir(dir, { recursive: true })

        const currentData: Record<string, string> = existsSync(filePath)
          ? JSON.parse(await fs.readFile(filePath, 'utf-8'))
          : {}
        const missingEntries = Object.fromEntries(
          Object.entries(translations).filter(([key]) => currentData[key] === undefined),
        )

        if (Object.keys(missingEntries).length > 0) {
          const tempPath = `${filePath}.tmp`
          await fs.writeFile(
            tempPath,
            JSON.stringify({ ...currentData, ...missingEntries }, null, 2),
          )
          await fs.rename(tempPath, filePath)
          console.log(`✅ [i18n] Updated: ${path.relative(process.cwd(), filePath)}`)
        }
      }),
    )
    i18nCache.clear()
  }

  return {
    name: 'odbvue:i18n-dev',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/i18n-add', (req, res, next) => {
        void (async () => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            return res.end(JSON.stringify({ error: 'Method Not Allowed' }))
          }

          try {
            const body = await new Promise<string>((resolve, reject) => {
              let data = ''
              req.on('data', (chunk) => (data += chunk))
              req.on('end', () => resolve(data))
              req.on('error', reject)
            })
            const {
              data: { locale, key, value },
              referer: bodyReferer,
            } = JSON.parse(body)
            if (!supportedLocales.has(locale)) {
              res.statusCode = 400
              return res.end(JSON.stringify({ error: `Unsupported locale: ${locale}` }))
            }

            const referer = bodyReferer || req.headers.referer || '/'
            const scope = resolveI18nScopeFromPathname(
              new URL(referer, `http://${req.headers.host}`).pathname,
            )
            for (const targetLocale of supportedLocales) {
              const cacheKey: I18nCacheKey = `${getScopeKey(scope)}:${targetLocale}:${key}`
              if (!i18nCache.has(cacheKey)) {
                i18nCache.set(cacheKey, {
                  scope,
                  locale: targetLocale,
                  key,
                  value: targetLocale === locale ? value || key : key,
                })
              }
            }
            scheduleDump()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ status: 'ok' }))
          } catch (error) {
            console.error('❌ [i18n] Error:', error)
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid request' }))
          }
        })().catch(next)
      })

      server.middlewares.use('/i18n-status', (_req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            status: 'ok',
            pending: i18nCache.size,
            cache: Array.from(i18nCache.values()),
          }),
        )
      })

      timer = setInterval(() => void dumpI18nData(), dumpInterval)
      server.httpServer?.on('close', () => {
        if (timer) clearInterval(timer)
        if (flushTimer) clearTimeout(flushTimer)
        void dumpI18nData()
      })
    },
  }
}
