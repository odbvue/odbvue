import type { ComputedRef } from 'vue'
import type {
  RouteLocationNormalizedLoaded,
  RouteRecordNormalized,
  RouteRecordRaw,
  Router,
} from 'vue-router'

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
  name?: RouteRecordNormalized['name'] | RouteRecordRaw['name']
  path: string
  module?: string
  parent?: string
  level: number
  children: string[]
  route: RouteRecordNormalized | RouteRecordRaw
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

export interface OdbVueRouteParams {
  pathParams: ComputedRef<Record<string, string>>
  queryParams: ComputedRef<Record<string, string>>
  routeParams: ComputedRef<Record<string, string>>
  param: (name: string) => ComputedRef<string>
  query: (name: string) => ComputedRef<string>
}

export interface OdbVueRouting {
  currentPage: ComputedRef<OdbVueRoutePage | undefined>
  currentModule: ComputedRef<string | undefined>
  breadcrumbs: ComputedRef<OdbVueBreadcrumb[]>
  pages: ComputedRef<OdbVueRoutePage[]>
  allPages: ComputedRef<OdbVueRoutePage[]>
  title: ComputedRef<(path: string) => string>
  params: OdbVueRouteParams
  navigate: Router['push']
  setBreadcrumb: (breadcrumbTitle: string, href?: string, icon?: string, disabled?: boolean) => void
}

declare module 'vue-router' {
  interface RouteMeta extends OdbVuePageMeta {}
}

export type OdbVueRouteLocation = RouteLocationNormalizedLoaded
