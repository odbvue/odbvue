import type { Plugin } from 'vite'

const pagesVirtualModuleId = 'virtual:odbvue-pages'
const resolvedPagesVirtualModuleId = `\0${pagesVirtualModuleId}`

/** Publishes OdbVue's generated route tree and canonical page manifest. */
export function odbVuePagesPlugin(): Plugin {
  return {
    name: 'odbvue:pages',
    resolveId(id) {
      return id === pagesVirtualModuleId ? resolvedPagesVirtualModuleId : undefined
    },
    load(id) {
      if (id !== resolvedPagesVirtualModuleId) return undefined
      return [
        "import { createOdbVuePageManifest } from '@odbvue/web'",
        "import { routes as generatedRoutes } from 'vue-router/auto-routes'",
        'export const manifest = createOdbVuePageManifest(generatedRoutes)',
        'export const routes = manifest.routes',
        'export const pages = manifest.pages',
      ].join('\n')
    },
  }
}
