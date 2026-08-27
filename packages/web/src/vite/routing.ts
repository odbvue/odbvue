import { readFile } from 'node:fs/promises'
import { relative, resolve } from 'node:path'
import matter from 'gray-matter'

const metaCache = new Map<string, Record<string, unknown>>()
const modulesDirectory = resolve(process.cwd(), 'src/modules')

export function moduleFromComponent(component?: string): string | undefined {
  if (!component) return undefined
  const [moduleName] = relative(modulesDirectory, component).split(/[/\\]/)
  return moduleName && moduleName !== '..' ? moduleName : undefined
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
