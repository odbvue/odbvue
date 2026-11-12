import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import {
  canAccessPage,
  canShowPage,
  getBreadcrumbOverride,
  type PageAuth,
} from '@/capabilities/routing'
import type { HttpClient, HttpResponse } from '@/capabilities/http'
import type { components } from '@/api/openapi.generated'
import Users from '@/modules/admin/pages/users/index.vue'
import UserDetails from '@/modules/admin/pages/users/[id].vue'
import messages from '@/modules/admin/i18n/en.json'
import { renderViewItem, type OvTableOptions } from '@/components/api'

const { get } = vi.hoisted(() => ({ get: vi.fn<HttpClient['get']>() }))
vi.mock('@/capabilities/http', () => ({ useHttp: () => ({ get }) }))

const table = defineComponent({
  name: 'VOvTable',
  props: ['items', 'options', 'nextCursor', 'loading'],
  emits: ['fetch'],
  template: '<div data-testid="users-table" />',
})
const view = defineComponent({
  name: 'VOvView',
  props: ['options', 'data'],
  template: '<div data-testid="user-details" />',
})
const container = { template: '<div><slot /></div>' }
const alert = { props: ['text'], template: '<div role="alert">{{ text }}</div>' }
const user: components['schemas']['AdminListUsersItemsItem'] = {
  id: 'A'.repeat(32),
  username: 'ada@example.test',
  displayName: 'Ada',
  enabled: true,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-02T10:00:00Z',
}
const result = (items: (typeof user)[] = [user]): HttpResponse<{ items: (typeof user)[] }> => ({
  data: { items },
  error: null,
  status: 200,
  headers: null,
})
const failure = (status: number): HttpResponse<never> => ({
  data: null,
  error: Object.assign(new Error('Request failed'), { status, request: '/admin/users' }),
  status,
  headers: null,
})
const pages = import.meta.glob<string>('@/modules/admin/pages/**/*.vue', {
  eager: true,
  query: '?raw',
  import: 'default',
})
const wrappers: ReturnType<typeof mount>[] = []

async function setup(details = false) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: Users },
      { path: '/admin/users/:id', component: UserDetails },
    ],
  })
  await router.push(details ? `/admin/users/${user.id}` : '/admin/users')
  const wrapper = mount(details ? UserDetails : Users, {
    global: {
      plugins: [router, createI18n({ legacy: false, locale: 'en', messages: { en: messages } })],
      stubs: {
        VOvTable: table,
        VOvView: view,
        VTabs: container,
        VTab: { template: '<button role="tab"><slot /></button>' },
        VTabsWindow: container,
        VTabsWindowItem: container,
        VContainer: container,
        VAlert: alert,
        VBtn: { template: '<a><slot /></a>' },
        VProgressLinear: true,
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  vi.stubGlobal('definePage', vi.fn<() => void>())
  get.mockReset()
  get.mockResolvedValue(result())
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('admin page metadata', () => {
  it('discovers the landing page, users list and user details', () => {
    expect(Object.keys(pages)).toHaveLength(3)
  })

  it.each(Object.entries(pages))('restricts %s to administrators', (path, source) => {
    const metadata = source.match(/definePage\(\{\s*meta:\s*\{([\s\S]*?)\n\s*\},?\s*\}\)/)?.[1]
    expect(metadata).toMatch(/\baccess:\s*\[\s*'admin'\s*\]/)
    expect(metadata).toMatch(
      path.endsWith('/[id].vue') ? /\bnavigation:\s*false/ : /\bnavigation:\s*true/,
    )
    const policy = { access: ['admin'] as ['admin'], navigation: !path.endsWith('/[id].vue') }
    const session = (authenticated: boolean, admin: boolean): PageAuth => ({
      authenticated: computed(() => authenticated),
      hasRole: (role) => admin && role === 'admin',
      can: () => false,
    })
    expect(canAccessPage(policy, session(false, false))).toBe(false)
    expect(canAccessPage(policy, session(true, false))).toBe(false)
    expect(canAccessPage(policy, session(true, true))).toBe(true)
    expect(canShowPage(policy, session(true, true))).toBe(policy.navigation)
  })
})

describe('admin users list', () => {
  it('displays five users on desktop and mobile, requesting a sixth only for pagination', async () => {
    const records = Array.from({ length: 6 }, (_, index) => ({
      ...user,
      id: String(index).padStart(32, '0'),
    }))
    get.mockResolvedValue(result(records))
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    const options: OvTableOptions = component.props('options')
    expect(options.itemsPerPage).toBe(5)
    expect(options.mobileItemsPerPage).toBe(5)
    component.vm.$emit('fetch', [], undefined, options.itemsPerPage)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: undefined, limit: 6, search: undefined } }),
    )
    expect(component.props('items')).toEqual(records.slice(0, 5))
    expect(component.props('nextCursor')).toBe(records[4]?.id)
  })

  it.each([true, false])('renders enabled=%s with the correct status', async (enabled) => {
    const { wrapper } = await setup()
    const options: OvTableOptions = wrapper.findComponent(table).props('options')
    const column = options.columns.find((item) => item.name === 'enabled')
    expect(column).toBeDefined()
    const cell = mount(
      { render: renderViewItem(enabled, column) },
      {
        global: {
          stubs: {
            VChip: { template: '<span><slot /></span>' },
            VIcon: true,
            VLabel: container,
          },
        },
      },
    )
    wrappers.push(cell)
    expect(cell.text()).toContain(messages[enabled ? 'admin.enabled' : 'admin.disabled'])
    expect(cell.text()).not.toContain(messages[enabled ? 'admin.disabled' : 'admin.enabled'])
  })

  it('uses the table cursor, search and one extra row to paginate without skipping users', async () => {
    const second = { ...user, id: 'B'.repeat(32), username: 'bob@example.test' }
    get.mockResolvedValue(result([user, second]))
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    component.vm.$emit('fetch', [], undefined, 1, ' ada ')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: undefined, limit: 2, search: 'ada' } }),
    )
    expect(component.props('items')).toEqual([user])
    expect(component.props('nextCursor')).toBe(user.id)
    get.mockResolvedValue(result([second]))
    component.vm.$emit('fetch', [], user.id, 1, ' ada ')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: user.id, limit: 2, search: 'ada' } }),
    )
    expect(component.props('items')).toEqual([second])
    expect(component.props('nextCursor')).toBeUndefined()
    expect(component.props('options').columns.at(-1).actions[0].format.to).toBe(
      '/admin/users/{{value}}',
    )
  })

  it('shows empty results and reports request failures rather than retaining stale data', async () => {
    get.mockResolvedValue(result([]))
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    component.vm.$emit('fetch', [], undefined, 25, '')
    await flushPromises()
    expect(wrapper.text()).toContain(messages['admin.noUsers'])
    get.mockResolvedValue(failure(403))
    component.vm.$emit('fetch', [], undefined, 25)
    await flushPromises()
    expect(wrapper.text()).toContain(messages['admin.loadUsersError'])
    expect(component.props('items')).toEqual([])
    expect(component.props('loading')).toBe(false)
  })

  it('ignores stale requests after a newer search completes', async () => {
    let resolveFirst!: (response: ReturnType<typeof result>) => void
    get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    component.vm.$emit('fetch', [], undefined, 25, 'old')
    component.vm.$emit('fetch', [], undefined, 25, 'new')
    await flushPromises()
    resolveFirst(result([{ ...user, username: 'stale' }]))
    await flushPromises()
    expect(component.props('items')).toEqual([user])
  })
})

describe('admin user details', () => {
  it('loads the selected account into a static view in a single Details tab', async () => {
    const { wrapper, router } = await setup(true)
    expect(get).toHaveBeenCalledWith(
      `/admin/users/${user.id}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    const component = wrapper.findComponent(view)
    expect(component.props('data')).toEqual(user)
    expect(wrapper.get('h3').text()).toBe(user.username)
    expect(wrapper.findAll('[role="tab"]')).toHaveLength(1)
    expect(wrapper.get('[role="tab"]').text()).toBe(messages['admin.details'])
    expect(component.props('options').items).toHaveLength(6)
    expect(component.props('options').actions).toBeUndefined()
    expect(wrapper.find('input, textarea, select, form').exists()).toBe(false)
    expect(wrapper.find('a').exists()).toBe(false)
    expect(getBreadcrumbOverride(router).value?.title).toBe(user.displayName)
    wrapper.unmount()
    expect(getBreadcrumbOverride(router).value).toBeUndefined()
  })

  it('uses the username in the breadcrumb when the full name is missing', async () => {
    get.mockResolvedValue(result([{ ...user, displayName: null }]))
    const { router } = await setup(true)
    expect(getBreadcrumbOverride(router).value?.title).toBe(user.username)
  })

  it.each([404, 500])('reports a %s response', async (status) => {
    get.mockResolvedValue(failure(status))
    const { wrapper } = await setup(true)
    expect(wrapper.text()).toContain(
      messages[status === 404 ? 'admin.userNotFound' : 'admin.loadUserError'],
    )
    expect(wrapper.findComponent(view).exists()).toBe(false)
    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('reports an empty response as not found', async () => {
    get.mockResolvedValue(result([]))
    const { wrapper } = await setup(true)
    expect(wrapper.text()).toContain(messages['admin.userNotFound'])
    expect(wrapper.findComponent(view).exists()).toBe(false)
  })

  it('reacts to a changed route and discards a late response for the previous user', async () => {
    let resolveFirst!: (response: ReturnType<typeof result>) => void
    get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const { wrapper, router } = await setup(true)
    const next = { ...user, id: 'B'.repeat(32), username: 'bob@example.test' }
    get.mockResolvedValue(result([next]))
    await router.push(`/admin/users/${next.id}`)
    await flushPromises()
    resolveFirst(result())
    await flushPromises()
    expect(wrapper.findComponent(view).props('data')).toEqual(next)
    expect(wrapper.get('h3').text()).toBe(next.username)
    expect(getBreadcrumbOverride(router).value?.title).toBe(next.displayName)
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  })
})
