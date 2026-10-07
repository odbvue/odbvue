import type { RouteRecordNormalized } from 'vue-router'
import type { NavigationMeta, PageMeta, RoutePage } from './types.js'
import { appConfig } from '../config'

export function updatePageTitle(meta: PageMeta, appTitle = appConfig.title || 'OdbVue'): void {
  document.title = meta.title ? `${appTitle} - ${meta.title}` : appTitle
}

export function resolvePageTitle(meta: PageMeta, path: string): string {
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

export function getPageMeta(route: RouteRecordNormalized): PageMeta {
  return route.meta
}

export function getNavigationMeta(meta: PageMeta): false | NavigationMeta {
  return resolveNavigationMeta(meta)
}

export function resolveNavigationMeta(meta: PageMeta): false | NavigationMeta {
  if (meta.navigation === false || meta.hidden || meta.visibility === 'never') return false
  return meta.navigation || { icon: meta.icon, order: meta.order }
}

export function toRoutePage(route: RouteRecordNormalized): RoutePage {
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
