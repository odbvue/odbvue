import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getOdbVuePageManifest } from './registry.js'
import { toRoutePage } from './metadata.js'
import { toManifestPage } from './manifest.js'
import type { OdbVueBreadcrumb, OdbVueRouting } from './types.js'

export function useRouting(): OdbVueRouting {
  const router = useRouter()
  const route = useRoute()
  const manifest = getOdbVuePageManifest(router)
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
  const pages = computed(() => pageEntries.value.map(toManifestPage))
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

    return matchedPages
      .filter((page) => page.meta.visibility !== 'never')
      .map((page, index, matched) => ({
        title: page.title,
        disabled: index === matched.length - 1,
        href: page.route.name
          ? router.resolve({ name: page.route.name, params: route.params }).href
          : page.route.path.includes(':')
            ? route.path
            : router.resolve(page.route.path).href,
        icon: page.meta.icon,
      }))
  })

  return { currentPage, currentModule, breadcrumbs, pages }
}

export function usePageMeta() {
  const { currentPage } = useRouting()
  return computed(() => currentPage.value?.meta || {})
}
