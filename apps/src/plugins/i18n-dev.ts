import { promises as fs } from 'node:fs'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'

const i18nLocales = ['en', 'fr', 'de']
const i18nRefreshInterval = 30000 // 30 seconds by default

type I18nCache = {
  module?: string
  locale: string
  key: string
  value: string
}

export function i18nDevPlugin(): Plugin {
  const i18nCache: I18nCache[] = []
  let timer: NodeJS.Timeout | null = null

  async function dumpI18nData() {
    if (i18nCache.length === 0) return

    try {
      const modules = [...[''], ...Array.from(new Set(i18nCache.map((item) => item.module)))]
      const locales = i18nLocales

      const fileGroups = new Map<string, I18nCache[]>()
      for (const module of modules) {
        for (const locale of locales) {
          const filePath = path.resolve(
            process.cwd(),
            'src',
            'i18n',
            module || '',
            `${locale}.json`,
          )
          if (!fileGroups.has(filePath)) {
            fileGroups.set(filePath, [])
          }
          const items = i18nCache.filter((item) => item.module === module && item.locale === locale)
          for (const item of items) {
            fileGroups.get(filePath)!.push(item)
          }
        }
      }

      for (const [filePath, items] of fileGroups.entries()) {
        const fileExists = await fs
          .stat(filePath)
          .then(() => true)
          .catch(() => false)

        if (!fileExists) {
          await fs.mkdir(path.dirname(filePath), { recursive: true })
          await fs.writeFile(filePath, '{}')
        }

        const data = await fs.readFile(filePath, 'utf-8')
        const jsonData = JSON.parse(data || '{}')
        let hasChanges = false

        for (const item of items) {
          if (!jsonData[item.key]) {
            jsonData[item.key] = item.value
            hasChanges = true
          }
        }

        if (hasChanges) {
          await fs.writeFile(filePath, JSON.stringify(jsonData, null, 2))
          const displayPath = path.relative(process.cwd(), filePath)
          console.log(`🌐 [i18n] Updated file: ${displayPath} with ${items.length} translations`)
        }
      }

      i18nCache.length = 0
    } catch (error) {
      console.error('❌ Error processing i18n dump:', error)
    }
  }

  return {
    name: 'i18n-dev-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use('/i18n-add', (req, res) => {
        if (req.method === 'POST') {
          let body = ''

          req.on('data', (chunk) => {
            body += chunk
          })

          req.on('end', () => {
            try {
              const data = JSON.parse(body)
              const referer = req.headers.referer || 'unknown'
              const module = referer.split('/')[3] || ''

              const item = i18nCache.find(
                (item) =>
                  item.module === module &&
                  item.key === data.data.key &&
                  item.locale === data.data.locale,
              )
              if (!item) {
                i18nCache.push({
                  module,
                  locale: data.data.locale,
                  key: data.data.key,
                  value: data.data.key
                    .split('.')
                    .join(' ')
                    .replace(/^./, (c: string) => c.toUpperCase()),
                })
              }
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ status: 'ok', received: data }))
            } catch (err) {
              console.error('❌ Failed to parse JSON:', err)
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ error: 'Invalid JSON' }))
            }
          })
        } else {
          res.writeHead(405, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'Method Not Allowed' }))
        }
      })

      server.middlewares.use('/i18n-status', (req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ status: 'ok', cache: i18nCache }))
      })

      timer = setInterval(() => {
        dumpI18nData().catch((error) => {
          console.error('❌ Error in timed i18n dump:', error)
        })
      }, i18nRefreshInterval)

      server.httpServer?.on('close', () => {
        if (timer) {
          clearInterval(timer)
          timer = null
        }
      })
    },
  }
}
