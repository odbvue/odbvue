import { describe, expect, expectTypeOf, it } from 'vitest'
import { computed } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { canAccessPage, canShowPage, resolveAuthRedirect } from '@/capabilities/routing'
import type { PageAccess, PageMeta } from '@/capabilities/routing'
import { validatePageMeta } from '@/capabilities/routing/metadata'

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
const anonymous = { ...auth, authenticated: computed(() => false) }

describe('auth route policy', () => {
  it('allows public pages and unrestricted structural records for any session', () => {
    expect(canAccessPage({}, auth)).toBe(true)
    expect(canAccessPage({}, anonymous)).toBe(true)
    expect(canAccessPage({ access: 'public' }, auth)).toBe(true)
    expect(canAccessPage({ access: 'public' }, anonymous)).toBe(true)
  })

  it('distinguishes authenticated and anonymous pages', () => {
    expect(canAccessPage({ access: 'authenticated' }, auth)).toBe(true)
    expect(canAccessPage({ access: 'authenticated' }, anonymous)).toBe(false)
    expect(canAccessPage({ access: 'anonymous' }, anonymous)).toBe(true)
    expect(canAccessPage({ access: 'anonymous' }, auth)).toBe(false)
  })

  it('requires any listed role and all listed permissions', () => {
    expect(canAccessPage({ access: ['admin', 'developer'] }, auth)).toBe(true)
    expect(canAccessPage({ access: ['admin'] }, auth)).toBe(false)
    expect(
      canAccessPage(
        { access: 'authenticated', permissions: ['settings.read', 'settings.write'] },
        auth,
      ),
    ).toBe(false)
    expect(canAccessPage({ access: 'authenticated', permissions: ['settings.read'] }, auth)).toBe(
      true,
    )
    expect(canAccessPage({ access: ['developer'], permissions: ['settings.read'] }, auth)).toBe(
      true,
    )
    expect(canAccessPage({ access: ['admin'], permissions: ['settings.read'] }, auth)).toBe(false)
    expect(canAccessPage({ access: ['developer'], permissions: ['settings.write'] }, auth)).toBe(
      false,
    )
  })

  it('requires authentication for role arrays even if the role predicate returns true', () => {
    expect(canAccessPage({ access: ['developer'] }, anonymous)).toBe(false)
    expect(
      canAccessPage({ access: 'authenticated', permissions: ['settings.read'] }, anonymous),
    ).toBe(false)
  })

  it('distinguishes access keywords from role names and permits empty permission lists', () => {
    expect(canAccessPage({ access: ['public'] }, auth)).toBe(false)
    expect(canAccessPage({ access: 'public', permissions: [] }, anonymous)).toBe(true)
    expect(canAccessPage({ access: 'authenticated', permissions: [] }, anonymous)).toBe(false)
    expect(canAccessPage({ access: 'authenticated', permissions: [] }, auth)).toBe(true)
  })

  it('hides non-navigable pages without denying route access', () => {
    expect(canAccessPage({ navigation: false }, auth)).toBe(true)
    expect(canShowPage({ navigation: false }, auth)).toBe(false)
    expect(canShowPage({}, auth)).toBe(true)
    expect(canShowPage({ navigation: true }, auth)).toBe(true)
    expect(canShowPage({ access: ['admin'], navigation: true }, auth)).toBe(false)
    expect(canShowPage({ access: 'authenticated' }, anonymous)).toBe(false)
  })

  it('requires explicit page access and navigation while allowing structural records', () => {
    expect(() => validatePageMeta({ access: 'public', navigation: true }, 'home.vue')).not.toThrow()
    expect(() =>
      validatePageMeta({ access: ['admin'], navigation: false }, 'admin.vue'),
    ).not.toThrow()
    expect(() => validatePageMeta({}, 'missing.vue')).toThrow(
      'Invalid page metadata in missing.vue',
    )
    expect(() => validatePageMeta({ access: 'public' }, 'missing.vue')).toThrow(
      'Invalid page metadata in missing.vue',
    )
    expectTypeOf<[]>().not.toExtend<PageAccess>()
    expectTypeOf<['admin', 'editor']>().toExtend<PageAccess>()
    expectTypeOf<{ navigation: boolean }>().not.toExtend<PageMeta>()
    expectTypeOf<{ access: 'public' }>().not.toExtend<PageMeta>()
  })

  it.each<Record<string, unknown>>([
    { access: [] },
    { access: [''] },
    { access: ['admin', 7] },
    { access: 'with-role' },
    { access: 'always' },
    { access: 'never' },
    { access: 'public', permissions: ['settings.read'] },
    { access: 'anonymous', permissions: ['settings.read'] },
    { permissions: ['settings.read'] },
    { access: 'authenticated', permissions: 'settings.read' },
    { access: 'authenticated', permissions: [''] },
    { access: 'public', roles: ['admin'] },
    { access: 'public', visibility: 'always' },
    { access: 'public', hidden: true },
  ])('surfaces invalid policies instead of allowing access: %j', (meta) => {
    expect(() => canAccessPage(meta, auth)).toThrow()
    expect(() => canAccessPage(meta, anonymous)).toThrow()
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
