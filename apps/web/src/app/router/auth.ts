import type { Router, NavigationGuard } from 'vue-router'
import { auth as applicationAuth, type Auth } from '../auth/index.js'
import { appConfig, type AppConfig } from '../config'
import { useUi } from '../ui/store'
import type { PageAccess, PageMeta } from './types.js'

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
    if (
      !session.authenticated.value &&
      (denied.meta.access === 'when-authenticated' || denied.meta.access === 'with-role') &&
      to.path !== login
    ) {
      return { path: login, query: { redirect: to.fullPath } }
    }
    onForbidden()
    return to.path === forbidden ? false : forbidden
  }
}

function isPageAllowed(access: PageAccess | undefined, meta: PageMeta, auth: PageAuth): boolean {
  switch (access) {
    case 'never':
      return false
    case 'when-authenticated':
      return auth.authenticated.value
    case 'when-unauthenticated':
      return !auth.authenticated.value
    case 'with-role':
      return (
        auth.authenticated.value &&
        (!!meta.roles?.length || !!meta.permissions?.length) &&
        (!meta.roles?.length || meta.roles.some((role) => auth.hasRole(role))) &&
        (meta.permissions?.every((permission) => auth.can(permission)) ?? true)
      )
    default:
      return true
  }
}

export function canAccessPage(meta: PageMeta, auth: PageAuth): boolean {
  return isPageAllowed(meta.access, meta, auth)
}

export function canShowPage(meta: PageMeta, auth: PageAuth): boolean {
  return canAccessPage(meta, auth) && isPageAllowed(meta.visibility, meta, auth)
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
