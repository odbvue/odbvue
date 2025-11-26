import { defineStore, acceptHMRUpdate } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { computed, type ComputedRef } from 'vue'
import { useAppStore } from '../index'

type Page = {
  path: string
  level: number
  children: boolean
  title: string
  description: string
  icon: string
  color: string
  role: string
}

type Breadcrumb = {
  title: string
  disabled: boolean
  href: string
  icon: string
}

export const useNavigationStore = defineStore(
  'navigation',
  (): {
    pages: ComputedRef<Page[]>
    title: ComputedRef<(path: string) => string>
    breadcrumbs: ComputedRef<Breadcrumb[]>
    guard: ComputedRef<(path: string) => boolean | string>
  } => {
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

    const pages: ComputedRef<Page[]> = computed(() => {
      const app = useAppStore()
      return allPages
        .filter((page) => page.level < 2)
        .filter((page) => page.path !== '/:path(.*)')
        .filter((page) => page.role !== 'guest')
        .filter(
          (page) =>
            (!app.auth.isAuthenticated &&
              ['restricted', 'public'].includes(page.role.toLowerCase())) ||
            app.auth.isAuthenticated,
        )
    })

    const guard = computed(() => (path: string) => {
      const app = useAppStore()
      const page = allPages.find((page) => {
        const regexPath = new RegExp('^' + page.path.replace(/:[^/]+/g, '[^/]+') + '$')
        return regexPath.test(path)
      })
      if (!page) return false
      if (page.role === 'public') return true
      if (!app.auth.isAuthenticated && page.role == 'guest') return true
      if (app.auth.isAuthenticated && page.role == 'restricted') return true
      if (
        app.auth.isAuthenticated &&
        app.user.privileges.some(
          (privilege: { role: string; permission: string; validfrom: string; validto: string }) =>
            privilege.role.toLowerCase() == page.role.toLowerCase(),
        )
      )
        return true
      if (!app.auth.isAuthenticated && page.role == 'restricted') return '/login'
      return false
    })

    return {
      pages,
      title,
      breadcrumbs,
      guard,
    }
  },
)

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useNavigationStore, import.meta.hot))
}
