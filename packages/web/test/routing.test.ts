import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import type { RouteRecordNormalized } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'
import {
  createOdbVuePageManifest,
  getNavigationMeta,
  registerOdbVuePageManifest,
  toRoutePage,
  useRouting,
} from '../src/capabilities/routing/index.js'

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
        navigation: { label: 'Customers', order: 20 },
      }),
    )

    expect(page.module).toBe('sandbox')
    expect(page.title).toBe('Customers')
    expect(page.navigation).toEqual({ label: 'Customers', order: 20 })
  })

  it('omits hidden and non-navigable pages from generated navigation', () => {
    expect(getNavigationMeta({ navigation: false })).toBe(false)
    expect(getNavigationMeta({ hidden: true })).toBe(false)
    expect(getNavigationMeta({ visibility: 'never' })).toBe(false)
  })

  it('includes matched dynamic routes in breadcrumbs', async () => {
    const routes = [
      {
        path: '/customers',
        name: 'customers',
        component: {},
        meta: { title: 'Customers' },
        children: [
          {
            path: ':id',
            name: 'customer',
            component: {},
            meta: { title: 'Customer' },
          },
        ],
      },
    ]
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    registerOdbVuePageManifest(router, createOdbVuePageManifest(routes))
    const app = createApp({})
    app.use(router)
    await router.push('/customers/42')

    let breadcrumbs: ReturnType<typeof useRouting>['breadcrumbs']
    app.runWithContext(() => {
      breadcrumbs = useRouting().breadcrumbs
    })

    expect(breadcrumbs!.value).toEqual([
      { title: 'Customers', disabled: false, href: '/customers', icon: undefined },
      { title: 'Customer', disabled: true, href: '/customers/42', icon: undefined },
    ])
  })

  it('uses generated module metadata instead of URL segments', async () => {
    const routes = [
      {
        path: '/crm/customers/:id',
        name: 'customer',
        component: {},
        meta: { module: 'sandbox' },
      },
    ]
    const router = createRouter({
      history: createMemoryHistory(),
      routes,
    })
    registerOdbVuePageManifest(router, createOdbVuePageManifest(routes))
    const app = createApp({})
    app.use(router)
    await router.push('/crm/customers/42')

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
    const manifest = createOdbVuePageManifest([
      {
        path: '/sandbox',
        name: 'sandbox',
        component: {},
        meta: { module: 'sandbox' },
        children: [
          {
            path: 'capabilities/routing',
            name: 'sandbox-routing',
            component: {},
            meta: { module: 'sandbox', title: 'Routing' },
          },
        ],
      },
    ])

    expect(manifest.pages).toMatchObject([
      { name: 'sandbox', path: '/sandbox', module: 'sandbox' },
      { name: 'sandbox-routing', path: '/sandbox/capabilities/routing', module: 'sandbox' },
    ])
  })
})
