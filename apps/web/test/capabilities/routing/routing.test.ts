import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import type { RouteRecordNormalized } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  createPageManifest,
  getNavigationMeta,
  registerPageManifest,
  resolvePageTitle,
  toRoutePage,
  useRouting,
} from '@/capabilities/routing'
import type { PageMeta } from '@/capabilities/routing'

function pageMeta(meta: Partial<PageMeta> = {}): PageMeta {
  return { access: 'public', navigation: true, ...meta }
}

function route(path: string, meta: Record<string, unknown> = {}): RouteRecordNormalized {
  return { path, meta } as RouteRecordNormalized
}

describe('routing metadata', () => {
  it('derives a page and navigation metadata from a route record', () => {
    const page = toRoutePage(
      route('/customers', {
        module: 'sandbox',
        title: 'Customers',
        icon: '$mdiAccountGroup',
        order: 20,
        navigation: true,
      }),
    )

    expect(page.module).toBe('sandbox')
    expect(page.title).toBe('Customers')
    expect(page.navigation).toBe(true)
    expect(page.meta.order).toBe(20)
  })

  it('defaults to navigation unless explicitly disabled', () => {
    expect(getNavigationMeta({ navigation: false })).toBe(false)
    expect(getNavigationMeta({ navigation: true })).toBe(true)
    expect(getNavigationMeta({})).toBe(true)
  })

  it('resolves page titles consistently from metadata and paths', () => {
    expect(resolvePageTitle({}, '/customer-orders')).toBe('Customer Orders')
    expect(resolvePageTitle({ title: 'Orders' }, '/customer-orders')).toBe('Orders')
  })

  it('validates completed page metadata without requiring it on structural parents', () => {
    expect(() =>
      createPageManifest([
        {
          path: '/parent',
          children: [{ path: 'child', component: {}, meta: pageMeta() }],
        },
      ]),
    ).not.toThrow()
    expect(() => createPageManifest([{ path: '/missing', component: {} }])).toThrow(
      'Invalid page metadata in /missing',
    )
    expect(() =>
      createPageManifest([{ path: '/missing', component: {}, meta: { access: 'public' } }]),
    ).toThrow('Invalid page metadata in /missing')
  })

  it('includes matched dynamic routes in breadcrumbs', async () => {
    const routes = [
      {
        path: '/customers',
        name: 'customers',
        component: {},
        meta: pageMeta({ title: 'Customers' }),
        children: [
          {
            path: ':id',
            name: 'customer',
            component: {},
            meta: pageMeta({ title: 'Customer' }),
          },
        ],
      },
    ]
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    registerPageManifest(router, createPageManifest(routes))
    await router.push('/customers/42')
    const app = createApp({})
    app.use(router)

    let breadcrumbs: ReturnType<typeof useRouting>['breadcrumbs']
    app.runWithContext(() => {
      breadcrumbs = useRouting().breadcrumbs
    })

    expect(breadcrumbs!.value).toEqual([
      { title: 'Customers', disabled: false, href: '/customers', icon: undefined },
      { title: 'Customer', disabled: true, href: '/customers/42', icon: undefined },
    ])
  })

  it('uses manifest pages for breadcrumbs instead of directory-only routes', async () => {
    const routes = [
      { path: '/', name: 'home', component: {}, meta: pageMeta({ title: 'Home' }) },
      {
        path: '/sandbox',
        name: 'sandbox',
        component: {},
        meta: pageMeta({ title: 'Sandbox' }),
        children: [
          {
            path: 'capabilities',
            component: undefined,
            children: [
              {
                path: 'routing',
                name: 'sandbox-routing',
                component: {},
                meta: pageMeta({ title: 'Routing' }),
              },
            ],
          },
        ],
      },
    ]
    const router = createRouter({ history: createMemoryHistory(), routes })
    registerPageManifest(router, createPageManifest(routes))
    await router.push('/sandbox/capabilities/routing')
    const app = createApp({})
    app.use(router)

    let breadcrumbs: ReturnType<typeof useRouting>['breadcrumbs']
    app.runWithContext(() => {
      breadcrumbs = useRouting().breadcrumbs
    })

    expect(breadcrumbs!.value.map((breadcrumb) => breadcrumb.title)).toEqual([
      'Home',
      'Sandbox',
      'Routing',
    ])
  })

  it('excludes navigation-disabled pages from menus and breadcrumbs but not the registry', async () => {
    const routes = [
      { path: '/', component: {}, meta: pageMeta({ title: 'Home' }) },
      {
        path: '/hidden',
        component: {},
        meta: pageMeta({ title: 'Hidden', navigation: false }),
        children: [{ path: 'child', component: {}, meta: pageMeta({ title: 'Child' }) }],
      },
    ]
    const router = createRouter({ history: createMemoryHistory(), routes })
    registerPageManifest(router, createPageManifest(routes))
    await router.push('/hidden/child')
    const app = createApp({})
    app.use(router)
    const routing = app.runWithContext(() => useRouting())

    expect(routing.pages.value.map((page) => page.path)).toEqual(['/'])
    expect(routing.allPages.value.map((page) => page.path)).toEqual([
      '/',
      '/hidden',
      '/hidden/child',
    ])
    expect(routing.breadcrumbs.value.map((item) => item.title)).toEqual(['Home', 'Child'])
  })

  it('omits structural and duplicate routes from the page registry', async () => {
    const routes = [
      {
        path: '/sandbox',
        component: {},
        meta: pageMeta(),
        children: [
          { path: '', name: 'sandbox', component: {}, meta: pageMeta({ title: 'Sandbox' }) },
          {
            path: 'capabilities',
            component: undefined,
            children: [
              {
                path: 'routing',
                name: 'sandbox-routing',
                component: {},
                meta: pageMeta({ title: 'Routing' }),
              },
            ],
          },
        ],
      },
    ]
    const router = createRouter({ history: createMemoryHistory(), routes })
    registerPageManifest(router, createPageManifest(routes))
    await router.push('/sandbox')
    const app = createApp({})
    app.use(router)

    let pages: ReturnType<typeof useRouting>['allPages']
    app.runWithContext(() => {
      pages = useRouting().allPages
    })

    expect(pages!.value.map((page) => page.path)).toEqual([
      '/sandbox',
      '/sandbox/capabilities/routing',
    ])
    expect(pages!.value[0]?.title).toBe('Sandbox')
    expect(pages!.value[0]?.level).toBe(0)
  })

  it('uses generated module metadata instead of URL segments', async () => {
    const routes = [
      {
        path: '/crm/customers/:id',
        name: 'customer',
        component: {},
        meta: pageMeta({ module: 'sandbox' }),
      },
    ]
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    registerPageManifest(router, createPageManifest(routes))
    await router.push('/crm/customers/42')
    const app = createApp({})
    app.use(router)

    let currentModule: ReturnType<typeof useRouting>['currentModule']
    app.runWithContext(() => {
      currentModule = useRouting().currentModule
    })

    expect(currentModule!.value).toBe('sandbox')
  })

  it('retains generated module metadata on a page', () => {
    const page = toRoutePage(
      route('/crm/customers', {
        module: 'sandbox',
      }),
    )

    expect(page.meta.module).toBe('sandbox')
  })

  it('creates a flattened page registry from generated nested routes', () => {
    const manifest = createPageManifest([
      {
        path: '/sandbox',
        name: 'sandbox',
        component: {},
        meta: pageMeta({ module: 'sandbox' }),
        children: [
          {
            path: 'capabilities/routing',
            name: 'sandbox-routing',
            component: {},
            meta: pageMeta({ module: 'sandbox', title: 'Routing' }),
          },
        ],
      },
    ])

    expect(manifest.pages).toMatchObject([
      {
        name: 'sandbox',
        path: '/sandbox',
        module: 'sandbox',
        level: 0,
        children: ['/sandbox/capabilities/routing'],
      },
      {
        name: 'sandbox-routing',
        path: '/sandbox/capabilities/routing',
        module: 'sandbox',
        parent: '/sandbox',
        level: 1,
        children: [],
      },
    ])
  })

  it('derives navigation and breadcrumb overrides from the routing runtime', async () => {
    const routes = [
      { path: '/', name: 'home', component: {}, meta: pageMeta({ title: 'Home', order: 20 }) },
      {
        path: '/customers',
        name: 'customers',
        component: {},
        meta: pageMeta({ title: 'Customers', order: 10 }),
        children: [
          {
            path: ':id',
            name: 'customer',
            component: {},
            meta: pageMeta({ title: 'Customer' }),
          },
        ],
      },
    ]
    const router = createRouter({ history: createMemoryHistory(), routes })
    registerPageManifest(router, createPageManifest(routes))
    await router.push('/customers')
    const app = createApp({})
    app.use(router)

    let routing: ReturnType<typeof useRouting>
    app.runWithContext(() => {
      routing = useRouting()
    })

    expect(routing!.pages.value.map((page) => page.path)).toEqual(['/customers', '/'])
    routing!.setBreadcrumb('Acme Corp')
    expect(routing!.breadcrumbs.value.at(-1)).toEqual({
      title: 'Acme Corp',
      href: '',
      icon: '',
      disabled: true,
    })
    await routing!.navigate('/customers/42')
    expect(routing!.params.pathParams.value).toEqual({ id: '42' })
  })
})
