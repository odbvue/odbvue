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
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import Users from '@/modules/admin/pages/users/index.vue'
import UserDetails from '@/modules/admin/pages/users/[id].vue'
import messages from '@/modules/admin/i18n/en.json'
import { renderViewItem, type OvTableOptions } from '@/components/api'

const { get, put, authUser } = vi.hoisted(() => ({
  get: vi.fn<HttpClient['get']>(),
  put: vi.fn<HttpClient['put']>(),
  authUser: { value: { id: 'C'.repeat(32) } },
}))
vi.mock('@/capabilities/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/capabilities/http')>()),
  useHttp: () => ({ get, put }),
}))
vi.mock('@/capabilities/auth', () => ({ useAuth: () => ({ user: authUser }) }))

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
const result = (
  items: (typeof user)[] = [user],
  nextCursor?: string,
): HttpResponse<components['schemas']['AdminListUsersResponse']> => ({
  data: { items, nextCursor },
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
const ui = useUi()

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
        VBtn: {
          props: ['disabled', 'loading'],
          template: '<button :disabled="disabled"><slot /></button>',
        },
        VOvDialog: {
          props: ['modelValue', 'title', 'content', 'actions', 'actionCancel', 'actionSubmit'],
          emits: ['update:modelValue', 'submit', 'cancel'],
          template: `
            <div v-if="modelValue" role="dialog">
              {{ title }}{{ content }}
              <button v-for="action in actions" @click="
                $emit((typeof action === 'string' ? action : action.name) === actionSubmit ? 'submit' : 'cancel');
                $emit('update:modelValue', false)
              ">{{ $t(typeof action === 'string' ? action : action.name) }}</button>
              <slot name="content" /><slot name="actions" />
            </div>`,
        },
        VCard: {
          props: ['title', 'subtitle', 'text'],
          template: '<div>{{ title }}{{ subtitle }}{{ text }}<slot /><slot name="actions" /></div>',
        },
        VCardText: container,
        VCardActions: container,
        VProgressLinear: true,
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return { wrapper, router }
}

beforeEach(() => {
  ui.clear()
  vi.stubGlobal('definePage', vi.fn<() => void>())
  get.mockReset()
  get.mockResolvedValue(result())
  put.mockReset()
  authUser.value = { id: 'C'.repeat(32) }
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  expect(ui.loading.active.value).toBe(false)
  expect(ui.notification.value).toBeUndefined()
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
  it('requests five displayed users and uses backend-owned continuation on desktop and mobile', async () => {
    const records = Array.from({ length: 5 }, (_, index) => ({
      ...user,
      id: String(index).padStart(32, '0'),
    }))
    get.mockResolvedValue(result(records, 'opaque-next-page'))
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    const options: OvTableOptions = component.props('options')
    expect(options.itemsPerPage).toBe(5)
    expect(options.mobileItemsPerPage).toBe(5)
    component.vm.$emit('fetch', [], undefined, options.itemsPerPage)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: undefined, limit: 5, search: undefined } }),
    )
    expect(component.props('items')).toEqual(records)
    expect(component.props('nextCursor')).toBe('opaque-next-page')
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

  it('passes opaque continuation unchanged with the same normalized search', async () => {
    const second = { ...user, id: 'B'.repeat(32), username: 'bob@example.test' }
    get.mockResolvedValue(result([user], 'opaque-user-cursor'))
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    component.vm.$emit('fetch', [], undefined, 1, ' ada ')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: undefined, limit: 1, search: 'ada' } }),
    )
    expect(component.props('items')).toEqual([user])
    expect(component.props('nextCursor')).toBe('opaque-user-cursor')
    get.mockResolvedValue(result([second]))
    component.vm.$emit('fetch', [], 'opaque-user-cursor', 1, ' ada ')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: 'opaque-user-cursor', limit: 1, search: 'ada' } }),
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
    expect(ui.notification.value).toMatchObject({ type: 'info', message: 'admin.noUsers' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    get.mockResolvedValue(failure(403))
    component.vm.$emit('fetch', [], undefined, 25)
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.loadUsersError' })
    expect(component.props('items')).toEqual([])
    expect(component.props('loading')).toBe(false)
    expect(ui.loading.active.value).toBe(false)
  })

  it('uses app loading during list requests and releases it on unmount without late feedback', async () => {
    let resolveRequest!: (response: ReturnType<typeof result>) => void
    get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const { wrapper } = await setup()
    wrapper.findComponent(table).vm.$emit('fetch', [], undefined, 5)
    expect(ui.loading.has('admin.users.list')).toBe(true)
    wrapper.unmount()
    expect(ui.loading.active.value).toBe(false)
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    resolveRequest(failure(500))
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
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
    expect(ui.loading.active.value).toBe(true)
    component.vm.$emit('fetch', [], undefined, 25, 'new')
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    resolveFirst(failure(500))
    await flushPromises()
    expect(component.props('items')).toEqual([user])
    expect(ui.notification.value).toBeUndefined()
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
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: status === 404 ? 'admin.userNotFound' : 'admin.loadUserError',
    })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.findComponent(view).exists()).toBe(false)
    expect(wrapper.find('h3').exists()).toBe(false)
  })

  it('reports an empty response as not found', async () => {
    get.mockResolvedValue(result([]))
    const { wrapper } = await setup(true)
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.userNotFound' })
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
    expect(ui.loading.has('admin.users.details')).toBe(true)
    expect(wrapper.findComponent({ name: 'VProgressLinear' }).exists()).toBe(false)
    const next = { ...user, id: 'B'.repeat(32), username: 'bob@example.test' }
    get.mockResolvedValue(result([next]))
    await router.push(`/admin/users/${next.id}`)
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    resolveFirst(failure(500))
    await flushPromises()
    expect(wrapper.findComponent(view).props('data')).toEqual(next)
    expect(wrapper.get('h3').text()).toBe(next.username)
    expect(getBreadcrumbOverride(router).value?.title).toBe(next.displayName)
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    expect(ui.notification.value).toBeUndefined()
  })

  it('releases detail loading on unmount and ignores late errors', async () => {
    let resolveRequest!: (response: ReturnType<typeof result>) => void
    get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const { wrapper } = await setup(true)
    expect(ui.loading.active.value).toBe(true)
    wrapper.unmount()
    expect(ui.loading.active.value).toBe(false)
    resolveRequest(failure(500))
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
  })

  it('reports thrown detail requests and releases app loading', async () => {
    get.mockRejectedValue(new Error('Network failed'))
    const { wrapper } = await setup(true)
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.loadUserError' })
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.findComponent(view).exists()).toBe(false)
  })

  it('requires confirmation before disabling and updates status and timestamps from the server', async () => {
    const { wrapper } = await setup(true)
    const disable = wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
    await disable.trigger('click')
    expect(put).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain(user.username)
    await wrapper.get('[role="dialog"]').findAll('button')[0]!.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(put).not.toHaveBeenCalled()
    await disable.trigger('click')
    const updated = { ...user, enabled: false, updatedAt: '2026-11-13T10:00:00Z' }
    put.mockResolvedValue(result([updated]))
    await wrapper.get('[role="dialog"]').findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledExactlyOnceWith(
      `/admin/users/${user.id}/status`,
      { enabled: false },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    )
    expect(wrapper.findComponent(view).props('data')).toEqual(updated)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(ui.notification.value).toMatchObject({ type: 'success', message: 'admin.userDisabled' })
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).toContain(messages['admin.enableUser'])
  })

  it('enables a disabled account directly', async () => {
    get.mockResolvedValue(result([{ ...user, enabled: false }]))
    put.mockResolvedValue(result())
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.enableUser'])!
      .trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledWith(
      `/admin/users/${user.id}/status`,
      { enabled: true },
      expect.any(Object),
    )
    expect(wrapper.findComponent(view).props('data').enabled).toBe(true)
    expect(ui.notification.value).toMatchObject({ type: 'success', message: 'admin.userEnabled' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('prevents administrators disabling their own account', async () => {
    authUser.value = { id: user.id }
    const { wrapper } = await setup(true)
    const disable = wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
    expect(disable.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain(messages['admin.cannotDisableSelf'])
    await disable.trigger('click')
    expect(put).not.toHaveBeenCalled()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it.each([403, 404, 500])(
    'keeps the old status and reports a %s failure through the app alert',
    async (status) => {
      put.mockResolvedValue(failure(status))
      const { wrapper } = await setup(true)
      await wrapper
        .findAll('button')
        .find((button) => button.text() === messages['admin.disableUser'])!
        .trigger('click')
      await wrapper.get('[role="dialog"]').findAll('button')[1]!.trigger('click')
      await flushPromises()
      expect(wrapper.findComponent(view).props('data')).toEqual(user)
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain(messages['admin.userDisabled'])
      expect(ui.notification.value).toMatchObject({
        type: 'error',
        message: status === 404 ? 'admin.userNotFound' : 'admin.statusUpdateError',
      })
      expect(ui.loading.active.value).toBe(false)
      expect(
        wrapper
          .findAll('button')
          .find((button) => button.text() === messages['admin.disableUser'])!
          .attributes('disabled'),
      ).toBeUndefined()
    },
  )

  it('requires a fresh confirmation to retry a failure and clears the alert when saving', async () => {
    put.mockResolvedValue(failure(500))
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
      .trigger('click')
    await wrapper.get('[role="dialog"]').findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(ui.notification.value?.message).toBe('admin.statusUpdateError')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
      .trigger('click')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(put).toHaveBeenCalledTimes(1)
    let resolveMutation!: (response: ReturnType<typeof result>) => void
    put.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveMutation = resolve
      }),
    )
    await wrapper.get('[role="dialog"]').findAll('button')[1]!.trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(ui.notification.value).toBeUndefined()
    expect(ui.loading.has('admin.users.status')).toBe(true)
    resolveMutation(result([{ ...user, enabled: false }]))
    await flushPromises()
    expect(put).toHaveBeenCalledTimes(2)
    expect(ui.notification.value?.message).toBe('admin.userDisabled')
  })

  it('reports an empty mutation response instead of claiming success', async () => {
    get.mockResolvedValue(result([{ ...user, enabled: false }]))
    put.mockResolvedValue(result([]))
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.enableUser'])!
      .trigger('click')
    await flushPromises()
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: 'admin.statusUpdateError',
    })
    expect(wrapper.findComponent(view).props('data').enabled).toBe(false)
    expect(wrapper.text()).not.toContain(messages['admin.userEnabled'])
  })

  it('prevents duplicate submissions and ignores a late mutation after navigating away', async () => {
    let resolveMutation!: (response: ReturnType<typeof result>) => void
    put.mockReturnValue(
      new Promise((resolve) => {
        resolveMutation = resolve
      }),
    )
    const { wrapper, router } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
      .trigger('click')
    const confirm = wrapper.get('[role="dialog"]').findAll('button')[1]!
    await confirm.trigger('click')
    expect(ui.loading.has('admin.users.status')).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    const disable = wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
    expect(disable.attributes('disabled')).toBeDefined()
    await disable.trigger('click')
    expect(put).toHaveBeenCalledTimes(1)
    const next = { ...user, id: 'B'.repeat(32), username: 'bob@example.test' }
    get.mockResolvedValue(result([next]))
    await router.push(`/admin/users/${next.id}`)
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    expect(put.mock.calls[0]?.[2]?.signal?.aborted).toBe(true)
    resolveMutation(result([{ ...user, enabled: false }]))
    await flushPromises()
    expect(wrapper.findComponent(view).props('data')).toEqual(next)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(messages['admin.userDisabled'])
    expect(ui.notification.value).toBeUndefined()
  })

  it('closes an unsubmitted confirmation when the route user changes', async () => {
    const { wrapper, router } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
      .trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    const next = { ...user, id: 'B'.repeat(32) }
    get.mockResolvedValue(result([next]))
    await router.push(`/admin/users/${next.id}`)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(put).not.toHaveBeenCalled()
  })

  it('releases mutation loading on unmount and ignores late failures', async () => {
    get.mockResolvedValue(result([{ ...user, enabled: false }]))
    let rejectMutation!: (cause: Error) => void
    put.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectMutation = reject
      }),
    )
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.enableUser'])!
      .trigger('click')
    expect(ui.loading.has('admin.users.status')).toBe(true)
    wrapper.unmount()
    expect(ui.loading.active.value).toBe(false)
    expect(put.mock.calls[0]?.[2]?.signal?.aborted).toBe(true)
    rejectMutation(new Error('Network failed'))
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
  })
})
