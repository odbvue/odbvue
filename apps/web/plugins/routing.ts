import { readFile } from 'node:fs/promises'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { isAbsolute, relative, resolve } from 'node:path'
import matter from 'gray-matter'

const metaCache = new Map<string, Record<string, unknown>>()
const modulesDirectory = resolve(process.cwd(), 'src/modules')

export function discoverPageFolders(root = process.cwd()) {
  const modulesRoot = resolve(root, 'src/modules')
  return [
    'src/app/pages',
    ...readdirSync(modulesRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .filter((entry) => {
        const pages = resolve(modulesRoot, entry.name, 'pages')
        return existsSync(pages) && statSync(pages).isDirectory()
      })
      .map((entry) => ({
        src: `src/modules/${entry.name}/pages`,
        path: `${entry.name}/`,
      })),
  ]
}

export function moduleFromComponent(component?: string): string | undefined {
  if (!component) return undefined
  const modulePath = relative(modulesDirectory, component)
  if (isAbsolute(modulePath) || modulePath.startsWith('..')) return undefined
  const [moduleName, folder] = modulePath.split(/[/\\]/)
  return folder === 'pages' ? moduleName : undefined
}

export async function extractMetaFromMarkdown(filePath: string) {
  if (metaCache.has(filePath)) return metaCache.get(filePath)!
  try {
    const content = await readFile(filePath, 'utf-8')
    const { data } = matter(content)
    metaCache.set(filePath, data)
    return data
  } catch (error) {
    console.warn(`[vue-router] Failed to extract meta from ${filePath}`, error)
    return {}
  }
}
