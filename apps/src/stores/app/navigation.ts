import { defineStore, acceptHMRUpdate } from 'pinia'
import { useRouter, useRoute } from 'vue-router'
import { computed, type ComputedRef } from 'vue'
import { useAppStore } from '../index'

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
        visibility: (route.meta?.visibility as Visibility) || 'never',
        access: (route.meta?.access as Access) || 'never',
        roles: (route.meta?.roles as string[]) || [],
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

    const hasVisibility = (page: Page): boolean => {
      const app = useAppStore()
      if (page.visibility === 'always') return true
      if (page.visibility === 'when-authenticated' && app.auth.isAuthenticated) return true
      if (page.visibility === 'when-unauthenticated' && !app.auth.isAuthenticated) return true
      if (page.visibility === 'with-role' && app.auth.isAuthenticated) {
        return app.user.privileges.some(
          (privilege: { role: string; permission: string; validfrom: string; validto: string }) =>
            page.roles.some((role) => privilege.role.toLowerCase() === role.toLowerCase()),
        )
      }
      return false
    }

    const pages: ComputedRef<Page[]> = computed(() => {
      return allPages.filter((page) => page.level < 2).filter((page) => hasVisibility(page))
    })

    const guard = computed(() => (path: string) => {
      const app = useAppStore()
      const page = allPages.find((page) => {
        const regexPath = new RegExp('^' + page.path.replace(/:[^/]+/g, '[^/]+') + '$')
        return regexPath.test(path)
      })
      if (!page) return false
      if (page.access === 'always') return true
      if (page.access === 'when-authenticated' && app.auth.isAuthenticated) return true
      if (page.access === 'when-unauthenticated' && !app.auth.isAuthenticated) return true
      if (page.access === 'with-role' && app.auth.isAuthenticated) {
        const hasRole = app.user.privileges.some(
          (privilege: { role: string; permission: string; validfrom: string; validto: string }) =>
            page.roles.some((role) => privilege.role.toLowerCase() === role.toLowerCase()),
        )
        if (hasRole) return true
      }
      return hasVisibility(page) ? '/login' : '/'
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
