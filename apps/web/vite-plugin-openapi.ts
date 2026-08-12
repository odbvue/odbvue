import path from 'node:path'
import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import type { Plugin, ResolvedConfig } from 'vite'

const require = createRequire(import.meta.url)

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
    const cli = require.resolve('openapi-typescript/bin/cli.js')

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
