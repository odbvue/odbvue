import { defineStore, acceptHMRUpdate } from 'pinia'
import { useRouter, useRoute } from 'vue-router'

export const useNavigationStore = defineStore('navigation', () => {
  const routes = useRouter().getRoutes()
  const route = useRoute()

  const allPages = routes.map((route) => {
    return {
      path: route.path,
      level: route.path == '/' ? 0 : route.path.split('/').length - 1,
      children:
        routes.find((r) => r.path.includes(route.path) && r.path !== route.path) !== undefined,
      title:
        route.meta?.title?.toString() ||
        route.path
          .split('/')
          .at(-1)
          ?.split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ') ||
        '',
      description: route.meta?.description?.toString() || '',
      icon: (route.meta?.icon as string) || '$mdiMinus',
      color: (route.meta?.color as string) || '',
      role: (route.meta?.role as string) || '',
    }
  })

  const title = computed(() => (path: string) => {
    const page = allPages.find((page) => page.path === path)
    return page ? page.title : ''
  })

  const breadcrumbs = computed(() => {
    const paths = ['', ...route.path.split('/').filter(Boolean)].map((_, i, arr) => {
      const path = arr.slice(1, i + 1).join('/')
      return '/' + path
    })
    const crumbs = allPages
      .filter((page) => page.path !== '/:path(.*)')
      .filter((page) => paths.includes(page.path))
      .sort((a, b) => a.level - b.level)
      .map((page) => {
        return {
          title: page.title,
          disabled: route.path === page.path,
          href: page.path,
          icon: page.icon,
        }
      })
    return crumbs
  })

  const pages = computed(() => {
    return allPages.filter((page) => page.level < 2).filter((page) => page.path !== '/:path(.*)')
  })

  return {
    pages,
    title,
    breadcrumbs,
  }
})

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
}
