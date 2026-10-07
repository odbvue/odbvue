import type { RouteMeta, RouteRecordNormalized } from 'vue-router'
import type { RoutePage } from './types.js'
import { appConfig } from '../config'

export function updatePageTitle(meta: RouteMeta, appTitle = appConfig.title || 'OdbVue'): void {
  document.title = meta.title ? `${appTitle} - ${meta.title}` : appTitle
}

export function resolvePageTitle(meta: RouteMeta, path: string): string {
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

export function getPageMeta(route: RouteRecordNormalized): RouteMeta {
  return route.meta
}

export function getNavigationMeta(meta: RouteMeta): boolean {
  return resolveNavigationMeta(meta)
}

export function resolveNavigationMeta(meta: RouteMeta): boolean {
  return meta.navigation !== false
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
