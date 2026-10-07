import type { Router } from 'vue-router'
import type { OdbVueAuth } from '../auth/index.js'
import type { OdbVuePageAccess, OdbVuePageMeta } from './types.js'

export type OdbVuePageAuth = Pick<OdbVueAuth, 'authenticated' | 'hasRole' | 'can'>

function isPageAllowed(
  access: OdbVuePageAccess | undefined,
  meta: OdbVuePageMeta,
  auth: OdbVuePageAuth,
): boolean {
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

export function canAccessPage(meta: OdbVuePageMeta, auth: OdbVuePageAuth): boolean {
  return isPageAllowed(meta.access, meta, auth)
}

export function canShowPage(meta: OdbVuePageMeta, auth: OdbVuePageAuth): boolean {
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
