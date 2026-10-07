import { readFileSync, readdirSync } from 'node:fs'
import { dirname, extname, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve('src')

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return ['.ts', '.vue'].includes(extname(path)) ? [path] : []
  })
}

describe('application and capability source boundaries', () => {
  it('keeps only shell responsibilities under app', () => {
    expect(readdirSync(resolve(sourceRoot, 'app')).toSorted()).toEqual([
      'App.vue',
      'i18n',
      'layouts',
      'pages',
      'router.ts',
    ])
  })

  it.each([
    ['capabilities', ['app', 'modules']],
    ['modules', ['app']],
    ['components', ['app', 'modules']],
  ])('keeps %s independent of forbidden source boundaries', (directory, forbidden) => {
    for (const file of sourceFiles(resolve(sourceRoot, directory))) {
      const source = readFileSync(file, 'utf-8')
      for (const match of source.matchAll(/(?:from\s*|import\s*\()\s*['"]([^'"]+)['"]/g)) {
        const specifier = match[1]!
        const dependency = specifier.startsWith('@/')
          ? resolve(sourceRoot, specifier.slice(2))
          : specifier.startsWith('.')
            ? resolve(dirname(file), specifier)
            : undefined
        if (!dependency) continue
        for (const boundary of forbidden) {
          const root = resolve(sourceRoot, boundary)
          expect(
            dependency === root || dependency.startsWith(`${root}${sep}`),
            `${file} imports ${specifier}`,
          ).toBe(false)
        }
      }
    }
  })
})
