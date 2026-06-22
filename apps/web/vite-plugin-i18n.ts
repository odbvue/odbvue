import { existsSync, statSync } from 'node:fs'
import * as fs from 'node:fs/promises'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

type I18nScope = { type: 'shared' } | { type: 'page'; pageDir: string }
type I18nCacheKey = `${string}:${string}:${string}` // scope:locale:key
type I18nCache = Map<I18nCacheKey, { scope: I18nScope; locale: string; key: string; value: string }>

function isDirectory(filePath: string): boolean {
  try {
    return statSync(filePath).isDirectory()
  } catch {
    return false
  }
}

function resolveI18nScopeFromPathname(pathname: string): I18nScope {
  const normalizedPath = pathname.replace(/\/+$/, '')

  if (!normalizedPath || normalizedPath === '/') {
    return { type: 'shared' }
  }

  const relativeRoutePath = normalizedPath.replace(/^\//, '')
  const pagesRoot = path.resolve(process.cwd(), 'src', 'pages')
  const pageDir = path.resolve(pagesRoot, relativeRoutePath)

  if (isDirectory(pageDir)) {
    return { type: 'page', pageDir }
  }

  return { type: 'page', pageDir }
}

function getScopeKey(scope: I18nScope): string {
  return scope.type === 'shared'
    ? 'shared'
    : path.relative(process.cwd(), scope.pageDir).replaceAll('\\', '/')
}

function getI18nPath(scope: I18nScope, locale: string, i18nDir: string): string {
  if (scope.type === 'page') {
    return path.resolve(scope.pageDir, i18nDir, `${locale}.json`)
  }

  return path.resolve(process.cwd(), 'src', i18nDir, `${locale}.json`)
}

export function i18nDevPlugin(
  options: {
    locales?: string[]
    dumpInterval?: number
    flushDelay?: number
    i18nDir?: string
  } = {},
): Plugin {
  const { locales = ['en'], dumpInterval = 300_000, flushDelay = 500, i18nDir = 'i18n' } = options
  const supportedLocales = new Set(locales)
  const i18nCache: I18nCache = new Map()
  let timer: NodeJS.Timeout | null = null
  let flushTimer: NodeJS.Timeout | null = null

  function scheduleDump() {
    if (flushTimer) clearTimeout(flushTimer)
    flushTimer = setTimeout(() => {
      flushTimer = null
      dumpI18nData().catch(console.error)
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
        if (!existsSync(dir)) {
          await fs.mkdir(dir, { recursive: true })
        }

        const fileExists = existsSync(filePath)
        const currentData: Record<string, string> = fileExists
          ? JSON.parse(await fs.readFile(filePath, 'utf-8'))
          : {}

        const missingEntries = Object.fromEntries(
          Object.entries(translations).filter(([key]) => currentData[key] === undefined),
        )
        const hasChanges = Object.keys(missingEntries).length > 0

        if (hasChanges) {
          const merged = { ...currentData, ...missingEntries }
          const tempPath = `${filePath}.tmp`
          await fs.writeFile(tempPath, JSON.stringify(merged, null, 2))
          await fs.rename(tempPath, filePath)
          console.log(`✅ [i18n] Updated: ${path.relative(process.cwd(), filePath)}`)
        }
      }),
    )

    i18nCache.clear()
  }

  return {
    name: 'i18n-dev-plugin',
    configureServer(server: ViteDevServer) {
      // Middleware to add translations
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
            const url = new URL(referer, `http://${req.headers.host}`)
            const scope = resolveI18nScopeFromPathname(url.pathname)

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
          } catch (err) {
            console.error('❌ [i18n] Error:', err)
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Invalid request' }))
          }
        })().catch(next)
      })

      // Status endpoint
      server.middlewares.use('/i18n-status', (req, res) => {
        res.setHeader('Content-Type', 'application/json')
        res.end(
          JSON.stringify({
            status: 'ok',
            pending: i18nCache.size,
            cache: Array.from(i18nCache.values()),
          }),
        )
      })

      // Periodic dump
      timer = setInterval(() => dumpI18nData().catch(console.error), dumpInterval)

      // Cleanup
      server.httpServer?.on('close', () => {
        if (timer) clearInterval(timer)
        if (flushTimer) clearTimeout(flushTimer)
        dumpI18nData().catch(console.error) // Flush on shutdown
      })
    },
  }
}
