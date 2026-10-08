import { useRoute, useRouter, type RouteLocationNormalizedLoaded } from 'vue-router'
import type { RouteMeta, RouteParamsRaw } from 'vue-router'
import { computed, type ComputedRef } from 'vue'
import { getBreadcrumbOverride, getPageManifest } from './registry.js'
import { toRoutePage } from './metadata.js'
import { toManifestPage } from './manifest.js'
import type { Breadcrumb, RouteParams, Routing } from './types.js'
import { useAuth } from '../auth'
import { canAccessPage, canShowPage, type PageAuth } from './auth.js'

function routeParamsForPath(path: string, params: Record<string, unknown>): RouteParamsRaw {
  const parameterNames = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1])
  return Object.fromEntries(
    parameterNames
      .filter((name): name is string => name !== undefined && name in params)
      .map((name) => [name, params[name] as string | string[]]),
  )
}

export function useRouting(auth: PageAuth = useAuth()): Routing {
  const router = useRouter()
  const route = useRoute()
  const manifest = getPageManifest(router)
  const breadcrumbOverride = getBreadcrumbOverride(router)
  const params = useRouteParams()
  function isNavigable(page: { path: string; meta: RouteMeta }): boolean {
    return (
      canShowPage(page.meta, auth) &&
      router.resolve(page.path).matched.every((record) => canAccessPage(record.meta, auth))
    )
  }
  const pageEntries = computed(() => {
    return manifest.pages.reduce<(typeof manifest.pages)[number][]>((pages, page) => {
      if (page.route.component === undefined) return pages
      const duplicateIndex = pages.findIndex((existingPage) => existingPage.path === page.path)
      if (duplicateIndex < 0) return [...pages, page]
      const existing = pages[duplicateIndex]
      if (existing && Object.keys(page.meta).length > Object.keys(existing.meta).length) {
        pages[duplicateIndex] = page
      }
      return pages
    }, [])
  })
  const allPages = computed(() => pageEntries.value.map(toManifestPage))
  const pages = computed(() => {
    return allPages.value
      .filter((page) => page.navigation !== false)
      .filter((page) => page.level === 0)
      .filter((page) => page.path !== '/:path(.*)')
      .filter(isNavigable)
      .toSorted(
        (first, second) =>
          (first.meta.order || 0) - (second.meta.order || 0) ||
          first.path.localeCompare(second.path),
      )
  })
  const title = computed(() => (path: string) => {
    const page = allPages.value.find((candidate) => candidate.path === path)
    return page?.title || ''
  })
  const currentPage = computed(() => {
    const matched = route.matched.at(-1)
    return matched ? toRoutePage(matched) : undefined
  })
  const currentModule = computed(() => currentPage.value?.module)
  const breadcrumbs = computed<Breadcrumb[]>(() => {
    const matchedNames = new Set(route.matched.map((matchedRoute) => matchedRoute.name))
    const matchedPages = pageEntries.value
      .filter((page) => {
        if (!page.route.component) return false
        if (page.path === '/') return true
        return (
          route.path === page.path ||
          route.path.startsWith(`${page.path}/`) ||
          (page.name && matchedNames.has(page.name))
        )
      })
      .toSorted((first, second) => first.path.length - second.path.length)
      .map(toManifestPage)

    const items: Breadcrumb[] = matchedPages.filter(isNavigable).map((page, index, matched) => ({
      title: page.title,
      disabled: index === matched.length - 1,
      href: page.route.name
        ? router.resolve({
            name: page.route.name,
            params: routeParamsForPath(page.route.path, route.params),
          }).href
        : page.route.path.includes(':')
          ? route.path
          : router.resolve(page.route.path).href,
      icon: page.meta.icon,
    }))
    if (breadcrumbOverride.value) items.push(breadcrumbOverride.value)
    return items
  })

  function setBreadcrumb(breadcrumbTitle: string, href = '', icon = '', disabled = true): void {
    breadcrumbOverride.value = { title: breadcrumbTitle, href, icon, disabled }
  }

  return {
    currentPage,
    currentModule,
    breadcrumbs,
    pages,
    allPages,
    title,
    params,
    navigate: router.push,
    setBreadcrumb,
  }
}

export function usePageMeta() {
  const { currentPage } = useRouting()
  return computed(() => currentPage.value?.meta || {})
}

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

export const useRouteParams = (): RouteParams => {
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
