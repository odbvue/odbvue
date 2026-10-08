import type { Router, NavigationGuard, RouteMeta } from 'vue-router'
import { auth as applicationAuth, type Auth } from '../auth/index.js'
import { appConfig, type AppConfig } from '../config'
import { useUi } from '../ui/store'
import { validateAccessPolicy } from './metadata.js'

export type PageAuth = Pick<Auth, 'authenticated' | 'hasRole' | 'can'>

export function createAuthGuard(
  router: Router,
  session: Auth = applicationAuth,
  config: AppConfig = appConfig,
  onForbidden: () => void = () => useUi().error('auth.forbidden'),
): NavigationGuard {
  return async (to) => {
    const login = config.auth?.routes?.login ?? '/login'
    const authenticated = config.auth?.routes?.authenticated ?? '/'
    const forbidden = config.auth?.routes?.forbidden ?? '/'
    await session.restore()

    if (to.path === login && session.authenticated.value) {
      const redirect = resolveAuthRedirect(router, to.query.redirect, authenticated, login)
      return redirect === to.fullPath ? false : redirect
    }
    const denied = to.matched.find((record) => !canAccessPage(record.meta, session))
    if (!denied) return true
    if (!session.authenticated.value && requiresAuthentication(denied.meta) && to.path !== login) {
      return { path: login, query: { redirect: to.fullPath } }
    }
    onForbidden()
    return to.path === forbidden ? false : forbidden
  }
}

function requiresAuthentication(meta: RouteMeta): boolean {
  return meta.access === 'authenticated' || Array.isArray(meta.access)
}

export function canAccessPage(meta: RouteMeta, auth: PageAuth): boolean {
  validateAccessPolicy(meta)
  if (meta.access === 'anonymous' && auth.authenticated.value) return false
  if (requiresAuthentication(meta) && !auth.authenticated.value) return false
  return (
    (!Array.isArray(meta.access) || meta.access.some((role) => auth.hasRole(role))) &&
    (meta.permissions?.every((permission) => auth.can(permission)) ?? true)
  )
}

export function canShowPage(meta: RouteMeta, auth: PageAuth): boolean {
  return meta.navigation !== false && canAccessPage(meta, auth)
}

export function resolveAuthRedirect(
  router: Router,
  redirect: unknown,
  fallback = '/',
  login = '/login',
): string {
  if (
    typeof redirect !== 'string' ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//') ||
    redirect.includes('\\') ||
    [...redirect].some((character) => character.charCodeAt(0) <= 32)
  ) {
    return fallback
  }
  const resolved = router.resolve(redirect)
  return resolved.matched.length && resolved.path !== login ? resolved.fullPath : fallback
}
