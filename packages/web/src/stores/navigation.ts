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
      const result = routeValueToString(value)
      if (result) merged[key] = result
    }

    for (const [key, value] of Object.entries(route.query)) {
      const result = routeValueToString(value)
      if (result) merged[key] = result
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
      const parameter = routeValueToString(value)
      if (parameter) result[key] = parameter
    }
    return result
  })

  const queryParams = computed(() => {
    const result: Record<string, string> = {}
    for (const [key, value] of Object.entries(route.query)) {
      const parameter = routeValueToString(value)
      if (parameter) result[key] = parameter
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

  const allPages: Page[] = routes.map((routeRecord) => {
    const path = routeRecord.path
    return {
      path,
      level: path == '/' ? 0 : path.split('/').length - 1,
      children:
        routes.find((otherRoute) => otherRoute.path.includes(path) && otherRoute.path !== path) !==
        undefined,
      title:
        routeRecord.meta?.title?.toString() ||
        path
          .split('/')
          .at(-1)
          ?.split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') ||
        '',
      description: routeRecord.meta?.description?.toString() || '',
      icon: (routeRecord.meta?.icon as string) || '$mdiMinus',
      color: (routeRecord.meta?.color as string) || '',
      visibility: (routeRecord.meta?.visibility as Visibility) || 'never',
      access: (routeRecord.meta?.access as Access) || 'never',
      roles: (routeRecord.meta?.roles as string[]) || [],
    }
  })

  const title = computed(() => (path: string) => {
    const matchedPage = allPages.find((candidate) => candidate.path === path)
    return matchedPage ? matchedPage.title : ''
  })

  const breadcrumbs = computed(() => {
    const paths = ['', ...route.path.split('/').filter(Boolean)].map((_, index, values) => {
      const path = values.slice(1, index + 1).join('/')
      return '/' + path
    })

    const crumbs = allPages
      .filter((page) => page.path !== '/:path(.*)')
      .filter((page) => paths.includes(page.path))
      .toSorted((first, second) => first.level - second.level)
      .map((page) => ({
        title: page.title,
        disabled: route.path === page.path,
        href: page.path,
        icon: page.icon,
      }))

    if (breadcrumb.value) crumbs.push(breadcrumb.value)

    return crumbs
  })

  const pages: ComputedRef<Page[]> = computed(() => {
    return allPages.filter((page) => page.level < 2).filter((page) => page.path !== '/:path(.*)')
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
