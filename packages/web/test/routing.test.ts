import { describe, expect, it } from 'vitest'
import type { RouteRecordNormalized } from 'vue-router'
import { getNavigationMeta, toRoutePage } from '../src/capabilities/routing/index.js'

function route(path: string, meta: Record<string, unknown> = {}): RouteRecordNormalized {
  return { path, meta } as RouteRecordNormalized
}

describe('routing metadata', () => {
  it('derives a page and navigation metadata from a route record', () => {
    const page = toRoutePage(
      route('/customers', {
        title: 'Customers',
        icon: '$mdiAccountGroup',
        navigation: { label: 'Customers', order: 20 },
      }),
    )

    expect(page.title).toBe('Customers')
    expect(page.navigation).toEqual({ label: 'Customers', order: 20 })
  })

  it('omits hidden and non-navigable pages from generated navigation', () => {
    expect(getNavigationMeta({ navigation: false })).toBe(false)
    expect(getNavigationMeta({ hidden: true })).toBe(false)
    expect(getNavigationMeta({ visibility: 'never' })).toBe(false)
  })
})
