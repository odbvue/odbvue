import type { RouteRecordRaw } from 'vue-router'
import type { OdbVuePageMeta, OdbVueRoutePage } from './types.js'
import { resolveNavigationMeta, resolvePageTitle } from './metadata.js'

export interface OdbVuePageManifestEntry {
  name?: string | symbol
  path: string
  module?: string
  parent?: string
  level: number
  children: string[]
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

function collectPages(
  routes: RouteRecordRaw[],
  parentPath = '',
  parent?: string,
  level = 0,
): OdbVuePageManifestEntry[] {
  return routes.flatMap((route) => {
    const path = joinRoutePath(parentPath, route.path)
    const meta = (route.meta ?? {}) as OdbVuePageMeta
    const pageLevel = route.path === '' ? Math.max(0, level - 1) : level
    const page: OdbVuePageManifestEntry = {
      name: route.name,
      path,
      module: meta.module,
      parent,
      level: pageLevel,
      children: (route.children ?? []).map((child) => joinRoutePath(path, child.path)),
      meta,
      route,
    }
    return [page, ...collectPages(route.children ?? [], path, path, level + 1)]
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
    parent: page.parent,
    level: page.level,
    children: page.children,
    route: page.route,
    meta: page.meta,
    title: resolvePageTitle(page.meta, page.path),
    navigation: resolveNavigationMeta(page.meta),
  }
}
