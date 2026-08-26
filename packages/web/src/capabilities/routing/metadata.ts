import type { RouteRecordNormalized } from 'vue-router'
import type { OdbVueNavigationMeta, OdbVuePageMeta, OdbVueRoutePage } from './types.js'

function titleFromPath(path: string): string {
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
  if (meta.navigation === false || meta.hidden || meta.visibility === 'never') return false
  return meta.navigation || { icon: meta.icon, order: meta.order }
}

export function toRoutePage(route: RouteRecordNormalized): OdbVueRoutePage {
  const meta = getPageMeta(route)
  return {
    path: route.path,
    route,
    meta,
    title: meta.title || titleFromPath(route.path),
    navigation: getNavigationMeta(meta),
  }
}
