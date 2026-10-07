import type { RouteRecordNormalized } from 'vue-router'
import type { OdbVueNavigationMeta, OdbVuePageMeta, OdbVueRoutePage } from './types.js'

export function resolvePageTitle(meta: OdbVuePageMeta, path: string): string {
  if (meta.title) return meta.title
  return (
    path
      .split('/')
      .filter(Boolean)
      .at(-1)
      ?.split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ') || ''
  )
}

export function getPageMeta(route: RouteRecordNormalized): OdbVuePageMeta {
  return route.meta
}

export function getNavigationMeta(meta: OdbVuePageMeta): false | OdbVueNavigationMeta {
  return resolveNavigationMeta(meta)
}

export function resolveNavigationMeta(meta: OdbVuePageMeta): false | OdbVueNavigationMeta {
  if (meta.navigation === false || meta.hidden || meta.visibility === 'never') return false
  return meta.navigation || { icon: meta.icon, order: meta.order }
}

export function toRoutePage(route: RouteRecordNormalized): OdbVueRoutePage {
  const meta = getPageMeta(route)
  return {
    name: route.name,
    path: route.path,
    module: meta.module,
    level: route.path === '/' ? 0 : route.path.split('/').length - 1,
    children: route.children?.map((child) => child.path) ?? [],
    route,
    meta,
    title: resolvePageTitle(meta, route.path),
    navigation: resolveNavigationMeta(meta),
  }
}
