import path from 'node:path'
import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import type { Plugin, ResolvedConfig } from 'vite'

const require = createRequire(import.meta.url)

const resolveOpenApiCli = (): string => {
  const packagePath = require.resolve('openapi-typescript/package.json')
  const pkg = JSON.parse(readFileSync(packagePath, 'utf8')) as {
    bin?: Record<string, string>
  }
  const binPath = pkg.bin?.['openapi-typescript']
  if (!binPath) throw new Error('openapi-typescript does not declare its CLI binary')
  return path.join(path.dirname(packagePath), binPath)
}

export function openapiPlugin(options: { source: string; dest: string }): Plugin {
  let config: ResolvedConfig
  let generating = false
  let pending = false

  const generate = async () => {
    if (generating) {
      pending = true
      return
    }
    generating = true
    const source = path.resolve(config.root, options.source)
    const dest = path.resolve(config.root, options.dest)
    if (!existsSync(source)) {
      throw new Error(`OpenAPI manifest not found: ${source}. Run a database migration first.`)
    }
    const cli = resolveOpenApiCli()

    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, [cli, source, '-o', dest], { stdio: 'inherit' })
      child.on('error', reject)
      child.on('exit', (code) =>
        code === 0 ? resolve() : reject(new Error(`OpenAPI generation failed (${code})`)),
      )
    })

    generating = false
    if (pending) {
      pending = false
      await generate()
    }
  }

  return {
    name: 'openapi',
    configResolved(resolved) {
      config = resolved
    },
    configureServer(server) {
      const source = path.resolve(config.root, options.source)
      server.watcher.add(source)
      server.watcher.on('add', (file) => file === source && generate().catch(console.error))
      server.watcher.on('change', (file) => file === source && generate().catch(console.error))
    },
  }
}
