import type { OdbVuePageAccess, OdbVuePageMeta } from '@odbvue/web'
import type { Router } from 'vue-router'

interface AuthAccessState {
  isAuthenticated: boolean
  hasRole(role: string): boolean
  can(permission: string): boolean
}

export function isPageAllowed(
  access: OdbVuePageAccess | undefined,
  meta: OdbVuePageMeta,
  auth: AuthAccessState,
): boolean {
  switch (access) {
    case 'never':
      return false
    case 'when-authenticated':
      return auth.isAuthenticated
    case 'when-unauthenticated':
      return !auth.isAuthenticated
    case 'with-role':
      return (
        auth.isAuthenticated &&
        (!!meta.roles?.length || !!meta.permissions?.length) &&
        (!meta.roles?.length || meta.roles.some((role) => auth.hasRole(role))) &&
        (meta.permissions?.every((permission) => auth.can(permission)) ?? true)
      )
    default:
      return true
  }
}

export function loginRedirect(router: Router, redirect: unknown): string {
  if (
    typeof redirect !== 'string' ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//') ||
    redirect.includes('\\') ||
    [...redirect].some((character) => character.charCodeAt(0) <= 32)
  ) {
    return '/'
  }
  const resolved = router.resolve(redirect)
  return resolved.matched.length && resolved.path !== '/login' ? resolved.fullPath : '/'
}
