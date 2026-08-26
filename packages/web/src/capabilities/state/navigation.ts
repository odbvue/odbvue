import { defineStore, acceptHMRUpdate } from 'pinia'
import { useRoute, type RouteLocationNormalizedLoaded } from 'vue-router'
import { useRouting } from '../routing/index.js'
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
  navigation: boolean
  order: number
}

type Breadcrumb = {
  title: string
  disabled: boolean
  href: string
  icon: string
}

export const useNavigationStore = defineStore('navigation', () => {
  const routing = useRouting()
  const breadcrumb = ref<Breadcrumb>()

  const allPages = computed<Page[]>(() => {
    const routes = routing.pages.value
    return routes.map((page) => ({
      path: page.path,
      level: page.path == '/' ? 0 : page.path.split('/').length - 1,
      children: routes.some(
        (otherPage) => otherPage.path.includes(page.path) && otherPage.path !== page.path,
      ),
      title: page.title,
      description: page.meta.description || '',
      icon: page.meta.icon || '$mdiMinus',
      color: page.meta.color || '',
      visibility: page.meta.visibility || 'never',
      access: page.meta.access || 'never',
      roles: page.meta.roles || [],
      navigation: page.navigation !== false,
      order: page.navigation === false ? 0 : page.navigation.order || 0,
    }))
  })

  const title = computed(() => (path: string) => {
    const matchedPage = allPages.value.find((candidate) => candidate.path === path)
    return matchedPage ? matchedPage.title : ''
  })

  const breadcrumbs = computed(() => {
    const crumbs = routing.breadcrumbs.value.map((page) => ({ ...page, icon: page.icon || '' }))

    if (breadcrumb.value) crumbs.push(breadcrumb.value)

    return crumbs
  })

  const pages: ComputedRef<Page[]> = computed(() => {
    return allPages.value
      .filter((page) => page.navigation)
      .filter((page) => page.level < 2)
      .filter((page) => page.path !== '/:path(.*)')
      .toSorted(
        (first, second) => first.order - second.order || first.path.localeCompare(second.path),
      )
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
