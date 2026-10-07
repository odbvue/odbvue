import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { isPageAllowed, loginRedirect } from '../router/auth'

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
  isAuthenticated: true,
  hasRole: (role: string) => role === 'developer',
  can: (permission: string) => permission === 'settings.read',
}

describe('auth route policy', () => {
  it('allows public pages and excludes hidden pages', () => {
    expect(isPageAllowed(undefined, {}, auth)).toBe(true)
    expect(isPageAllowed('always', {}, auth)).toBe(true)
    expect(isPageAllowed('never', {}, auth)).toBe(false)
  })

  it('distinguishes authenticated and anonymous pages', () => {
    const anonymous = { ...auth, isAuthenticated: false }
    expect(isPageAllowed('when-authenticated', {}, auth)).toBe(true)
    expect(isPageAllowed('when-authenticated', {}, anonymous)).toBe(false)
    expect(isPageAllowed('when-unauthenticated', {}, anonymous)).toBe(true)
    expect(isPageAllowed('when-unauthenticated', {}, auth)).toBe(false)
  })

  it('requires any listed role and all listed permissions', () => {
    expect(isPageAllowed('with-role', { roles: ['admin', 'developer'] }, auth)).toBe(true)
    expect(isPageAllowed('with-role', { roles: ['admin'] }, auth)).toBe(false)
    expect(
      isPageAllowed('with-role', { permissions: ['settings.read', 'settings.write'] }, auth),
    ).toBe(false)
    expect(isPageAllowed('with-role', { permissions: ['settings.read'] }, auth)).toBe(true)
    expect(isPageAllowed('with-role', {}, auth)).toBe(false)
    expect(
      isPageAllowed('with-role', { roles: ['developer'] }, { ...auth, isAuthenticated: false }),
    ).toBe(false)
  })

  it('preserves local redirect query parameters and fragments', () => {
    expect(loginRedirect(router, '/sandbox?tab=auth#session')).toBe('/sandbox?tab=auth#session')
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
    expect(loginRedirect(router, redirect)).toBe('/')
  })
})
