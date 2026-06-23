import { defineStore, acceptHMRUpdate } from 'pinia'
import { useRouter, useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import { computed, ref, type ComputedRef } from 'vue'

const routeValueToString = (value: unknown): string => {
  if (Array.isArray(value)) return routeValueToString(value[0])
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return ''
}

export const computedRouteParam = (
  route: RouteLocationNormalizedLoaded,
  name: string,
): ComputedRef<string> => {
  return computed(() => routeValueToString((route.params as Record<string, unknown>)[name]))
}

export const computedRouteQuery = (
  route: RouteLocationNormalizedLoaded,
  name: string,
): ComputedRef<string> => {
  return computed(() => routeValueToString(route.query[name]))
}

export const computedRouteParams = (
  route: RouteLocationNormalizedLoaded,
): ComputedRef<Record<string, string>> => {
  return computed(() => {
    const merged: Record<string, string> = {}

    for (const [key, value] of Object.entries(route.params as Record<string, unknown>)) {
      const v = routeValueToString(value)
      if (v) merged[key] = v
    }

    for (const [key, value] of Object.entries(route.query)) {
      const v = routeValueToString(value)
      if (v) merged[key] = v
    }

    return merged
  })
}

export const useRouteParams = (): {
  pathParams: ComputedRef<Record<string, string>>
  queryParams: ComputedRef<Record<string, string>>
  routeParams: ComputedRef<Record<string, string>>
  param: (name: string) => ComputedRef<string>
  query: (name: string) => ComputedRef<string>
} => {
  const route = useRoute()

  const pathParams = computed(() => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.params as Record<string, unknown>)) {
      const v = routeValueToString(value)
      if (v) result[key] = v
    }
    return result
  })

  const queryParams = computed(() => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.query)) {
      const v = routeValueToString(value)
      if (v) result[key] = v
    }
    return result
  })

  const routeParams = computed(() => ({ ...pathParams.value, ...queryParams.value }))

  const param = (name: string) => computedRouteParam(route, name)
  const query = (name: string) => computedRouteQuery(route, name)

  return { pathParams, queryParams, routeParams, param, query }
}

type Visibility = 'always' | 'when-authenticated' | 'when-unauthenticated' | 'never' | 'with-role'
type Access = 'always' | 'when-authenticated' | 'when-unauthenticated' | 'never' | 'with-role'

type Page = {
  path: string
  level: number
  children: boolean
  title: string
  description: string
  icon: string
  color: string
  visibility: Visibility
  access: Access
  roles: string[]
}

type Breadcrumb = {
  title: string
  disabled: boolean
  href: string
  icon: string
}

export const useNavigationStore = defineStore('navigation', () => {
  const router = useRouter()
  const routes = router.getRoutes()
  const route = useRoute()

  const breadcrumb = ref<Breadcrumb>()

  const allPages: Page[] = routes.map((r) => {
    const path = r.path
    return {
      path,
      level: path == '/' ? 0 : path.split('/').length - 1,
      children: routes.find((rr) => rr.path.includes(path) && rr.path !== path) !== undefined,
      title:
        r.meta?.title?.toString() ||
        path
          .split('/')
          .at(-1)
          ?.split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') ||
        '',
      description: r.meta?.description?.toString() || '',
      icon: (r.meta?.icon as string) || '$mdiMinus',
      color: (r.meta?.color as string) || '',
      visibility: (r.meta?.visibility as Visibility) || 'never',
      access: (r.meta?.access as Access) || 'never',
      roles: (r.meta?.roles as string[]) || [],
    }
  })

  const title = computed(() => (path: string) => {
    const page = allPages.find((p) => p.path === path)
    return page ? page.title : ''
  })

  const breadcrumbs = computed(() => {
    const paths = ['', ...route.path.split('/').filter(Boolean)].map((_, i, arr) => {
      const p = arr.slice(1, i + 1).join('/')
      return '/' + p
    })

    const crumbs = allPages
      .filter((p) => p.path !== '/:path(.*)')
      .filter((p) => paths.includes(p.path))
      .toSorted((a, b) => a.level - b.level)
      .map((p) => ({ title: p.title, disabled: route.path === p.path, href: p.path, icon: p.icon }))

    if (breadcrumb.value) crumbs.push(breadcrumb.value)

    return crumbs
  })

  const pages: ComputedRef<Page[]> = computed(() => {
    return allPages.filter((p) => p.level < 2)
  })

  function setBreadcrumb(breadcrumbTitle: string, href?: string, icon?: string, disabled = true) {
    breadcrumb.value = { title: breadcrumbTitle, href: href || '', icon: icon || '', disabled }
  }

  return {
    pages,
    title,
    breadcrumbs,
    setBreadcrumb,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
}
