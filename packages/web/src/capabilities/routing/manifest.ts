import type { RouteRecordRaw } from 'vue-router'
import type { OdbVuePageMeta, OdbVueRoutePage } from './types.js'

export interface OdbVuePageManifestEntry {
  name?: string | symbol
  path: string
  module?: string
  meta: OdbVuePageMeta
  route: RouteRecordRaw
}

export interface OdbVuePageManifest {
  routes: RouteRecordRaw[]
  pages: OdbVuePageManifestEntry[]
}

function joinRoutePath(parentPath: string, path: string): string {
  if (path.startsWith('/')) return path || '/'
  if (!parentPath || parentPath === '/') return `/${path}`.replace(/\/$/, '') || '/'
  return `${parentPath.replace(/\/$/, '')}/${path}`.replace(/\/$/, '') || '/'
}

function collectPages(routes: RouteRecordRaw[], parentPath = ''): OdbVuePageManifestEntry[] {
  return routes.flatMap((route) => {
    const path = joinRoutePath(parentPath, route.path)
    const meta = (route.meta ?? {}) as OdbVuePageMeta
    const page: OdbVuePageManifestEntry = {
      name: route.name,
      path,
      module: meta.module,
      meta,
      route,
    }
    return [page, ...collectPages(route.children ?? [], path)]
  })
}

/** Creates the canonical OdbVue page registry from generated route records. */
export function createOdbVuePageManifest(routes: RouteRecordRaw[]): OdbVuePageManifest {
  return { routes, pages: collectPages(routes) }
}

/** Converts a manifest entry into the runtime page representation. */
export function toManifestPage(page: OdbVuePageManifestEntry): OdbVueRoutePage {
  return {
    name: page.name,
    path: page.path,
    module: page.module,
    route: page.route,
    meta: page.meta,
    title:
      page.meta.title ||
      page.path
        .split('/')
        .filter(Boolean)
        .at(-1)
        ?.split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ') ||
      '',
    navigation:
      page.meta.navigation === false || page.meta.hidden || page.meta.visibility === 'never'
        ? false
        : (page.meta.navigation ?? { icon: page.meta.icon, order: page.meta.order }),
  }
}
