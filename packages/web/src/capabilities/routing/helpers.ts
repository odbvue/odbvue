import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { toRoutePage } from './metadata.js'
import type { OdbVueBreadcrumb, OdbVueRouting } from './types.js'

function routeModule(path: string): string | undefined {
  return path.split('/').filter(Boolean).at(0)
}

function normalizePath(path: string): string {
  const segments = path.split('/').filter(Boolean)
  return segments.length ? `/${segments.join('/')}` : '/'
}

export function useRouting(): OdbVueRouting {
  const router = useRouter()
  const route = useRoute()
  const pages = computed(() => router.getRoutes().map(toRoutePage))
  const currentPage = computed(() => {
    const matched = route.matched.at(-1)
    return matched ? toRoutePage(matched) : undefined
  })
  const currentModule = computed(() => routeModule(route.path))
  const breadcrumbs = computed<OdbVueBreadcrumb[]>(() => {
    const pathParts = route.path.split('/').filter(Boolean)
    const paths = [
      '/',
      ...pathParts.map((_, index) => `/${pathParts.slice(0, index + 1).join('/')}`),
    ]

    return paths.flatMap((path) => {
      const page = pages.value.find(
        (candidate) =>
          normalizePath(candidate.path) === path && candidate.meta.visibility !== 'never',
      )
      if (!page) return []
      return [
        {
          title: page.title,
          disabled: normalizePath(route.path) === path,
          href: path,
          icon: page.meta.icon,
        },
      ]
    })
  })

  return { currentPage, currentModule, breadcrumbs, pages }
}

export function usePageMeta() {
  const { currentPage } = useRouting()
  return computed(() => currentPage.value?.meta || {})
}
