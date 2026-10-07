import type { ComputedRef } from 'vue'
import type {
  RouteLocationNormalizedLoaded,
  RouteRecordNormalized,
  RouteRecordRaw,
  Router,
} from 'vue-router'

export type PageVisibility =
  | 'always'
  | 'when-authenticated'
  | 'when-unauthenticated'
  | 'with-role'
  | 'never'

export type PageAccess = PageVisibility

export interface NavigationMeta {
  label?: string
  icon?: string
  order?: number
}

export interface PageMeta {
  module?: string
  title?: string
  description?: string
  icon?: string
  color?: string
  hidden?: boolean
  order?: number
  layout?: 'default' | 'fullscreen'
  visibility?: PageVisibility
  access?: PageAccess
  roles?: string[]
  permissions?: string[]
  navigation?: false | NavigationMeta
}

export interface RoutePage {
  name?: RouteRecordNormalized['name'] | RouteRecordRaw['name']
  path: string
  module?: string
  parent?: string
  level: number
  children: string[]
  route: RouteRecordNormalized | RouteRecordRaw
  meta: PageMeta
  title: string
  navigation: false | NavigationMeta
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
  interface RouteMeta extends PageMeta {}
}

export type RouteLocation = RouteLocationNormalizedLoaded
