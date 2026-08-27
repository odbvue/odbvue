import type { ComputedRef } from 'vue'
import type { RouteLocationNormalizedLoaded, RouteRecordNormalized } from 'vue-router'

export type OdbVuePageVisibility =
  | 'always'
  | 'when-authenticated'
  | 'when-unauthenticated'
  | 'with-role'
  | 'never'

export type OdbVuePageAccess = OdbVuePageVisibility

export interface OdbVueNavigationMeta {
  label?: string
  icon?: string
  order?: number
}

export interface OdbVuePageMeta {
  module?: string
  title?: string
  description?: string
  icon?: string
  color?: string
  hidden?: boolean
  order?: number
  layout?: string
  visibility?: OdbVuePageVisibility
  access?: OdbVuePageAccess
  roles?: string[]
  permissions?: string[]
  navigation?: false | OdbVueNavigationMeta
}

export interface OdbVueRoutePage {
  name?: RouteRecordNormalized['name']
  path: string
  module?: string
  route: RouteRecordNormalized
  meta: OdbVuePageMeta
  title: string
  navigation: false | OdbVueNavigationMeta
}

export interface OdbVueBreadcrumb {
  title: string
  disabled: boolean
  href: string
  icon?: string
}

export interface OdbVueRouting {
  currentPage: ComputedRef<OdbVueRoutePage | undefined>
  currentModule: ComputedRef<string | undefined>
  breadcrumbs: ComputedRef<OdbVueBreadcrumb[]>
  pages: ComputedRef<OdbVueRoutePage[]>
}

declare module 'vue-router' {
  interface RouteMeta extends OdbVuePageMeta {}
}

export type OdbVueRouteLocation = RouteLocationNormalizedLoaded
