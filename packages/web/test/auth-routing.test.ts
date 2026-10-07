import { describe, expect, it } from 'vitest'
import { computed } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { canAccessPage, canShowPage, resolveAuthRedirect } from '../src/index.js'

const component = { template: '<div />' }
const router = createRouter({
  history: createMemoryHistory(),
  routes: [
    { path: '/', component },
    { path: '/login', component },
    { path: '/sandbox', component },
  ],
})
const auth = {
  authenticated: computed(() => true),
  hasRole: (role: string) => role === 'developer',
  can: (permission: string) => permission === 'settings.read',
}

describe('auth route policy', () => {
  it('allows public pages and excludes hidden pages', () => {
    expect(canAccessPage({}, auth)).toBe(true)
    expect(canAccessPage({ access: 'always' }, auth)).toBe(true)
    expect(canAccessPage({ access: 'never' }, auth)).toBe(false)
  })

  it('distinguishes authenticated and anonymous pages', () => {
    const anonymous = { ...auth, authenticated: computed(() => false) }
    expect(canAccessPage({ access: 'when-authenticated' }, auth)).toBe(true)
    expect(canAccessPage({ access: 'when-authenticated' }, anonymous)).toBe(false)
    expect(canAccessPage({ access: 'when-unauthenticated' }, anonymous)).toBe(true)
    expect(canAccessPage({ access: 'when-unauthenticated' }, auth)).toBe(false)
  })

  it('requires any listed role and all listed permissions', () => {
    expect(canAccessPage({ access: 'with-role', roles: ['admin', 'developer'] }, auth)).toBe(true)
    expect(canAccessPage({ access: 'with-role', roles: ['admin'] }, auth)).toBe(false)
    expect(
      canAccessPage(
        { access: 'with-role', permissions: ['settings.read', 'settings.write'] },
        auth,
      ),
    ).toBe(false)
    expect(canAccessPage({ access: 'with-role', permissions: ['settings.read'] }, auth)).toBe(true)
    expect(canAccessPage({ access: 'with-role' }, auth)).toBe(false)
    expect(
      canAccessPage(
        { access: 'with-role', roles: ['developer'] },
        { ...auth, authenticated: computed(() => false) },
      ),
    ).toBe(false)
  })

  it('keeps visibility separate while also enforcing access for navigation', () => {
    expect(canAccessPage({ visibility: 'never' }, auth)).toBe(true)
    expect(canShowPage({ visibility: 'never' }, auth)).toBe(false)
    expect(canShowPage({ visibility: 'always', access: 'never' }, auth)).toBe(false)
    expect(canShowPage({ visibility: 'with-role', roles: ['admin'] }, auth)).toBe(false)
  })

  it('preserves local redirect query parameters and fragments', () => {
    expect(resolveAuthRedirect(router, '/sandbox?tab=auth#session')).toBe(
      '/sandbox?tab=auth#session',
    )
  })

  it.each([
    undefined,
    ['/', '/sandbox'],
    'https://example.com',
    '//example.com',
    '/\\example.com',
    '/sandbox\n',
    '/login?redirect=/sandbox',
    '/missing',
  ])('rejects unsafe or unusable redirects (%s)', (redirect) => {
    expect(resolveAuthRedirect(router, redirect)).toBe('/')
  })

  it('uses application-configured login and fallback routes', () => {
    expect(resolveAuthRedirect(router, '/sandbox?redirect=/', '/', '/sandbox')).toBe('/')
    expect(resolveAuthRedirect(router, undefined, '/sandbox')).toBe('/sandbox')
  })
})
