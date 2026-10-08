import type { RouteMeta, RouteRecordNormalized } from 'vue-router'
import type { RoutePage } from './types.js'
import { appConfig } from '../config'

export function validateAccessPolicy(meta: Record<string, unknown>): void {
  const access = meta.access
  const permissions = meta.permissions
  if (
    access !== undefined &&
    access !== 'public' &&
    access !== 'authenticated' &&
    access !== 'anonymous' &&
    !(
      Array.isArray(access) &&
      access.length > 0 &&
      access.every((role) => typeof role === 'string' && role.trim().length > 0)
    )
  ) {
    throw new Error(
      'Page access must be public, authenticated, anonymous, or a non-empty role list',
    )
  }
  if (
    permissions !== undefined &&
    !(
      Array.isArray(permissions) &&
      permissions.every(
        (permission) => typeof permission === 'string' && permission.trim().length > 0,
      )
    )
  ) {
    throw new Error('Page permissions must be an array of non-empty strings')
  }
  if (
    Array.isArray(permissions) &&
    permissions.length > 0 &&
    access !== 'authenticated' &&
    !Array.isArray(access)
  ) {
    throw new Error('Page permissions require authenticated access or a role list')
  }
  for (const key of ['roles', 'visibility', 'hidden']) {
    if (key in meta) {
      throw new Error(`Page metadata "${key}" is no longer supported; use access and navigation`)
    }
  }
}

export function validatePageMeta(meta: Record<string, unknown>, source: string): void {
  try {
    if (meta.access === undefined) throw new Error('Page access is required')
    if (typeof meta.navigation !== 'boolean') throw new Error('Page navigation must be a boolean')
    validateAccessPolicy(meta)
  } catch (error) {
    throw new Error(`Invalid page metadata in ${source}`, { cause: error })
  }
}

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
