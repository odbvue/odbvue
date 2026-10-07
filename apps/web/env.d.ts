/// <reference types="vite/client" />

declare module 'virtual:odbvue-i18n-inventory' {
  const inventory: {
    app: Record<string, number>
    modules: Record<string, Record<string, number>>
  }
  export default inventory
}

declare module 'virtual:odbvue-pages' {
  import type { PageManifest } from '@/app/router/api'
  import type { RouteRecordRaw } from 'vue-router'

  export const manifest: PageManifest
  export const pages: PageManifest['pages']
  export const routes: RouteRecordRaw[]
}
