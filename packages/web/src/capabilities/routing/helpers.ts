import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { RouteParamsRaw } from 'vue-router'
import { getOdbVueBreadcrumbOverride, getOdbVuePageManifest } from './registry.js'
import { toRoutePage } from './metadata.js'
import { toManifestPage } from './manifest.js'
import { useRouteParams } from './navigation.js'
import type { OdbVueBreadcrumb, OdbVueRouting } from './types.js'

function routeParamsForPath(path: string, params: Record<string, unknown>): RouteParamsRaw {
  const parameterNames = [...path.matchAll(/:([A-Za-z0-9_]+)/g)].map((match) => match[1])
  return Object.fromEntries(
    parameterNames
      .filter((name): name is string => name !== undefined && name in params)
      .map((name) => [name, params[name] as string | string[]]),
  )
}

export function useRouting(): OdbVueRouting {
  const router = useRouter()
  const route = useRoute()
  const manifest = getOdbVuePageManifest(router)
  const breadcrumbOverride = getOdbVueBreadcrumbOverride(router)
  const params = useRouteParams()
  const pageEntries = computed(() => {
    return manifest.pages.reduce<(typeof manifest.pages)[number][]>((pages, page) => {
      if (page.route.component === undefined) return pages
      const duplicateIndex = pages.findIndex((existingPage) => existingPage.path === page.path)
      if (duplicateIndex < 0) return [...pages, page]
      if (Object.keys(page.meta).length > Object.keys(pages[duplicateIndex].meta).length) {
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
      .toSorted(
        (first, second) =>
          (first.navigation === false ? 0 : first.navigation.order || 0) -
            (second.navigation === false ? 0 : second.navigation.order || 0) ||
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
  const breadcrumbs = computed<OdbVueBreadcrumb[]>(() => {
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

    const items: OdbVueBreadcrumb[] = matchedPages
      .filter((page) => page.meta.visibility !== 'never')
      .map((page, index, matched) => ({
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
