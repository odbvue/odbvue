import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sourceDir = resolve(rootDir, 'src/packages')
const targetDir = resolve(rootDir, 'dist/packages')
const assetExtensions = new Set(['.pkb', '.pks'])

function copyAssets(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const sourcePath = resolve(dir, entry.name)

    if (entry.isDirectory()) {
      copyAssets(sourcePath)
      continue
    }

    if (!entry.isFile() || !assetExtensions.has(extname(entry.name))) continue

    const targetPath = resolve(targetDir, relative(sourceDir, sourcePath))
    mkdirSync(dirname(targetPath), { recursive: true })
    copyFileSync(sourcePath, targetPath)
  }
}

copyAssets(sourceDir)
