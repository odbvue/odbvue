import type { ComputedRef } from 'vue'
import type {
  RouteLocationNormalizedLoaded,
  RouteRecordNormalized,
  RouteRecordRaw,
  RouteMeta,
  Router,
} from 'vue-router'

export type PageAccess = 'public' | 'authenticated' | 'anonymous' | [string, ...string[]]

export interface PageMeta extends Record<PropertyKey, unknown> {
  module?: string
  title?: string
  description?: string
  icon?: string
  color?: string
  order?: number
  layout?: 'default' | 'fullscreen'
  access: PageAccess
  permissions?: string[]
  navigation: boolean
}

export interface RoutePage {
  name?: RouteRecordNormalized['name'] | RouteRecordRaw['name']
  path: string
  module?: string
  parent?: string
  level: number
  children: string[]
  route: RouteRecordNormalized | RouteRecordRaw
  meta: RouteMeta
  title: string
  navigation: boolean
}

export interface Breadcrumb {
  title: string
  disabled: boolean
  href: string
  icon?: string
}

export interface RouteParams {
  pathParams: ComputedRef<Record<string, string>>
  queryParams: ComputedRef<Record<string, string>>
  routeParams: ComputedRef<Record<string, string>>
  param: (name: string) => ComputedRef<string>
  query: (name: string) => ComputedRef<string>
}

export interface Routing {
  currentPage: ComputedRef<RoutePage | undefined>
  currentModule: ComputedRef<string | undefined>
  breadcrumbs: ComputedRef<Breadcrumb[]>
  pages: ComputedRef<RoutePage[]>
  allPages: ComputedRef<RoutePage[]>
  title: ComputedRef<(path: string) => string>
  params: RouteParams
  navigate: Router['push']
  setBreadcrumb: (breadcrumbTitle: string, href?: string, icon?: string, disabled?: boolean) => void
}

declare module 'vue-router' {
  interface RouteMeta extends Partial<PageMeta> {}
}

export type RouteLocation = RouteLocationNormalizedLoaded
