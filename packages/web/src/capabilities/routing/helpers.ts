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
  const pages = computed(() => manifest.pages.map(toManifestPage))
  const currentPage = computed(() => {
    const matched = route.matched.at(-1)
    return matched ? toRoutePage(matched) : undefined
  })
  const currentModule = computed(() => currentPage.value?.module)
  const breadcrumbs = computed<OdbVueBreadcrumb[]>(() => {
    return route.matched
      .map(toRoutePage)
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
