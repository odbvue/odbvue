import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { injectHead } from '@unhead/vue'
import { renderDOMHead } from '@unhead/vue/client'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'
import { createOdbVuePageManifest, installAppRouting, useRouting } from '@/app/router/api'
import { installApp } from '@/app/plugins'
import { useHttp } from '@/app/http'
import { useUi } from '@/app/ui'
import { type OdbVueAppConfig } from '@/app/config'

const component = { template: '<div />' }
const routes: RouteRecordRaw[] = [
  { path: '/', component },
  {
    path: '/login',
    component,
    meta: { title: 'Login', access: 'when-unauthenticated', navigation: false },
  },
  { path: '/private', component, meta: { title: 'Private', access: 'when-authenticated' } },
  { path: '/admin', component, meta: { access: 'with-role', roles: ['admin'] } },
  { path: '/blocked', component, meta: { access: 'never' } },
  { path: '/anonymous', component, meta: { visibility: 'when-unauthenticated' } },
  {
    path: '/parent',
    component,
    meta: { access: 'with-role', roles: ['admin'] },
    children: [{ path: 'child', component, meta: { title: 'Child' } }],
  },
]

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function setup(config: OdbVueAppConfig = {}, pageRoutes = routes) {
  const app = createApp({})
  const router = createRouter({ history: createMemoryHistory(), routes: pageRoutes })
  const dispose = installAppRouting(router, createOdbVuePageManifest(pageRoutes))
  const runtime = installApp(app, { title: 'OdbVue', ...config }, router)
  const auth = runtime.auth
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json({}, 401))
  auth.setHttp(useHttp({ fetch }))
  const ui = app.runWithContext(() => useUi())
  const routing = app.runWithContext(() => useRouting())
  return { app, router, runtime, auth, fetch, ui, routing, dispose }
}

async function login(context: ReturnType<typeof setup>, roles: string[] = []) {
  await context.runtime.ready
  context.fetch
    .mockResolvedValueOnce(json({ accessToken: 'token' }))
    .mockResolvedValueOnce(json({ userId: 7, username: 'ada', roles }))
  await context.auth.login({ username: 'ada', password: 'password' })
}

describe('application routing installation', () => {
  afterEach(() => vi.restoreAllMocks())

  it('waits for restoration before deciding access and restores only once', async () => {
    let finish!: () => void
    const restored = new Promise<boolean>((resolve) => {
      finish = () => resolve(false)
    })
    const context = setup()
    const start = vi.spyOn(context.auth, 'restore').mockReturnValue(restored)
    let navigated = false
    const navigation = context.router.push('/private?tab=1#section').then(() => {
      navigated = true
    })
    await vi.waitFor(() => expect(start).toHaveBeenCalledOnce())
    expect(navigated).toBe(false)
    finish()
    await navigation
    expect(context.router.currentRoute.value.path).toBe('/login')
    expect(context.router.currentRoute.value.query.redirect).toBe('/private?tab=1#section')
    expect(context.fetch).not.toHaveBeenCalled()
    context.dispose()
  })

  it('uses the same access policy for guards and reactive navigation', async () => {
    const context = setup()
    await context.runtime.ready
    expect(context.routing.pages.value.map((page) => page.path)).toEqual(['/', '/anonymous'])
    await login(context)
    expect(context.routing.pages.value.map((page) => page.path)).toEqual(['/', '/private'])
    await context.router.push('/admin')
    expect(context.router.currentRoute.value.path).toBe('/')
    expect(context.ui.notification.value?.message).toBe('auth.forbidden')
    await context.router.push('/parent/child')
    expect(context.router.currentRoute.value.path).toBe('/')
    await context.router.push('/private')
    expect(context.router.currentRoute.value.path).toBe('/private')
    context.fetch.mockResolvedValueOnce(new Response(null, { status: 204 }))
    await context.auth.logout()
    expect(context.routing.pages.value.map((page) => page.path)).toEqual(['/', '/anonymous'])
    context.dispose()
  })

  it('authorizes restored identities before the first protected navigation', async () => {
    const context = setup()
    context.fetch.mockReset()
    context.fetch
      .mockResolvedValueOnce(json({ accessToken: 'restored-token' }))
      .mockResolvedValueOnce(json({ userId: 7, username: 'ada', roles: ['admin'] }))
    await context.router.push('/admin')
    expect(context.router.currentRoute.value.path).toBe('/admin')
    expect(context.fetch).toHaveBeenCalledTimes(2)
    expect(context.auth.ready.value).toBe(true)
    expect(context.routing.pages.value.some((page) => page.path === '/admin')).toBe(true)
    context.dispose()
  })

  it('redirects authenticated login requests safely', async () => {
    const context = setup()
    await login(context)
    await context.router.push('/login?redirect=/private%3Ftab=1%23section')
    expect(context.router.currentRoute.value.fullPath).toBe('/private?tab=1#section')
    await context.router.push('/login?redirect=//example.com')
    expect(context.router.currentRoute.value.path).toBe('/')
    context.dispose()
  })

  it('honors configured login, authenticated, and forbidden destinations', async () => {
    const pageRoutes: RouteRecordRaw[] = [
      ...routes.filter((route) => route.path !== '/login'),
      { path: '/sign-in', component, meta: { access: 'when-unauthenticated' } },
      { path: '/home', component },
      { path: '/denied', component },
    ]
    const context = setup(
      { auth: { routes: { login: '/sign-in', authenticated: '/home', forbidden: '/denied' } } },
      pageRoutes,
    )
    await context.router.push('/private')
    expect(context.router.currentRoute.value.path).toBe('/sign-in')
    await login(context)
    await context.router.push('/sign-in?redirect=/sign-in')
    expect(context.router.currentRoute.value.path).toBe('/home')
    await context.router.push('/admin')
    expect(context.router.currentRoute.value.path).toBe('/denied')
    context.dispose()
  })

  it('cancels denial at the fallback instead of looping', async () => {
    const context = setup(
      {},
      routes.map((route) => (route.path === '/' ? { ...route, meta: { access: 'never' } } : route)),
    )
    await context.router.push('/blocked')
    expect(context.router.currentRoute.value.matched).toHaveLength(0)
    expect(context.ui.notification.value?.message).toBe('auth.forbidden')
    context.dispose()
  })

  it('updates one head entry only after successful navigation', async () => {
    const context = setup()
    const head = context.app.runWithContext(() => injectHead())!
    await context.router.push('/login')
    await renderDOMHead(head)
    expect(document.title).toBe('OdbVue - Login')
    await context.router.push('/')
    await renderDOMHead(head)
    expect(document.title).toBe('OdbVue')
    expect(head.entries.size).toBe(1)
    const remove = context.router.beforeEach((to) => to.path !== '/login')
    await context.router.push('/login')
    await renderDOMHead(head)
    expect(document.title).toBe('OdbVue')
    remove()
    context.dispose()
    expect(head.entries.size).toBe(0)
  })

  it('propagates failed startup to navigation rather than hanging', async () => {
    const error = new Error('Restore failed')
    const context = setup()
    vi.spyOn(context.auth, 'restore').mockRejectedValue(error)
    const onError = vi.fn<Parameters<typeof context.router.onError>[0]>()
    context.router.onError(onError)
    await expect(context.router.push('/private')).rejects.toBe(error)
    expect(onError).toHaveBeenCalledWith(error, expect.anything(), expect.anything())
    context.dispose()
  })
})
