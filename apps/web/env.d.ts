/// <reference types="vite/client" />

declare module 'virtual:odbvue-i18n-inventory' {
  const inventory: {
    app: Record<string, number>
    modules: Record<string, Record<string, number>>
  }
  export default inventory
}

declare module 'virtual:odbvue-pages' {
  import type { OdbVuePageManifest } from '@odbvue/web'
  import type { RouteRecordRaw } from 'vue-router'

  export const manifest: OdbVuePageManifest
  export const pages: OdbVuePageManifest['pages']
  export const routes: RouteRecordRaw[]
}
