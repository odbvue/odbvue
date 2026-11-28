import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, onBeforeUnmount, onMounted, ref } from 'vue'
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
import UserDetailsTab from '@/modules/admin/pages/users/[id]/index.vue'
import UserPermissionsTab from '@/modules/admin/pages/users/[id]/permissions.vue'
import UserAuditTab from '@/modules/admin/pages/users/[id]/audit.vue'
import Audit from '@/modules/admin/pages/audit/index.vue'
import Roles from '@/modules/admin/pages/roles/index.vue'
import Settings from '@/modules/admin/pages/settings/index.vue'
import Jobs from '@/modules/admin/pages/jobs/index.vue'
import JobHistory from '@/modules/admin/pages/jobs/[name].vue'
import Emails from '@/modules/admin/pages/emails/index.vue'
import Admin from '@/modules/admin/pages/index.vue'
import App from '@/app/App.vue'
import messages from '@/modules/admin/i18n/en.json'
import de from '@/modules/admin/i18n/de.json'
import fr from '@/modules/admin/i18n/fr.json'
import { i18n } from '@/capabilities/i18n'
import {
  renderViewItem,
  type OvTableOptions,
  type OvTableFetchRequest,
  type OvActionComplete,
  type OvFormSelectionField,
} from '@/components/api'

const { get, post, put, putRole, authUser } = vi.hoisted(() => ({
  get: vi.fn<HttpClient['get']>(),
  post: vi.fn<HttpClient['post']>(),
  put: vi.fn<HttpClient['putOrThrow']>(),
  putRole: vi.fn<HttpClient['put']>(),
  authUser: { value: { id: 'C'.repeat(32) } },
}))
vi.mock('@/capabilities/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/capabilities/http')>()),
  useHttp: () => ({ get, post, put: putRole, putOrThrow: put }),
}))
vi.mock('@/capabilities/client', () => ({ http: { get } }))
vi.mock('@/capabilities/auth', () => ({ useAuth: () => ({ user: authUser }) }))
vi.mock('@/app/layouts/DefaultLayout.vue', () => ({
  default: { template: '<main><slot /></main>' },
}))
vi.mock('@/app/layouts/FullscreenLayout.vue', () => ({
  default: { template: '<main><slot /></main>' },
}))

const table = defineComponent({
  name: 'VOvTable',
  props: ['options', 'title'],
  emits: ['fetch', 'action'],
  setup(_props, { expose }) {
    expose({ fetch: refetchTable })
  },
  template: '<div data-testid="users-table" />',
})
const refetchTable = vi.fn<(action: string) => Promise<boolean>>().mockResolvedValue(true)
const view = defineComponent({
  name: 'VOvView',
  props: ['options', 'data'],
  template: '<div data-testid="user-details" />',
})
const tabs = defineComponent({
  name: 'VTabs',
  props: ['modelValue'],
  template: '<div><slot /></div>',
})
const container = { template: '<div><slot /></div>' }
const alert = {
  props: ['text', 'role'],
  template: '<div :role="role ?? \'alert\'">{{ text }}</div>',
}
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

beforeEach(() => {
  i18n.global.mergeLocaleMessage('en', messages)
})

async function setup(
  page:
    | boolean
    | 'roles'
    | 'permissions'
    | 'audit'
    | 'global-audit'
    | 'settings'
    | 'jobs'
    | 'job-history'
    | 'emails' = false,
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/users', component: Users },
      {
        path: '/admin/users/:id',
        component: UserDetails,
        children: [
          { path: '', name: '/admin/users/[id]/', component: UserDetailsTab },
          {
            path: 'permissions',
            name: '/admin/users/[id]/permissions',
            component: UserPermissionsTab,
          },
          { path: 'audit', name: '/admin/users/[id]/audit', component: UserAuditTab },
        ],
      },
      { path: '/admin/roles', component: Roles },
      { path: '/admin/audit', component: Audit },
      { path: '/admin/settings', component: Settings },
      { path: '/admin/jobs', component: Jobs },
      { path: '/admin/jobs/:name', component: JobHistory },
      { path: '/admin/emails', component: Emails },
    ],
  })
  await router.push(
    page === 'job-history'
      ? '/admin/jobs/EXAMPLE_JOB'
      : page === 'global-audit'
        ? '/admin/audit'
        : page === 'roles' || page === 'settings' || page === 'jobs' || page === 'emails'
          ? `/admin/${page}`
          : page
            ? `/admin/users/${user.id}${page === 'permissions' || page === 'audit' ? `/${page}` : ''}`
            : '/admin/users',
  )
  const wrapper = mount(App, {
    global: {
      plugins: [router, createI18n({ legacy: false, locale: 'en', messages: { en: messages } })],
      stubs: {
        VOvTable: table,
        VOvView: view,
        VTabs: tabs,
        VTab: {
          props: ['to', 'disabled'],
          template:
            '<button role="tab" :disabled="disabled" @click="$router.push(to)"><slot /></button>',
        },
        VTabsWindow: container,
        VTabsWindowItem: container,
        VContainer: container,
        VAlert: alert,
        VBtn: {
          props: ['disabled', 'loading'],
          template: '<button :disabled="disabled"><slot /></button>',
        },
        VOvDialog: {
          props: [
            'modelValue',
            'activator',
            'title',
            'content',
            'actions',
            'actionCancel',
            'actionSubmit',
            'closeable',
          ],
          emits: ['update:modelValue', 'submit', 'cancel'],
          setup(props) {
            const open = ref(false)
            const root = ref<HTMLElement>()
            let activator: HTMLElement | null | undefined
            const activate = () => {
              if (props.activator) open.value = true
            }
            onMounted(() => {
              activator = root.value?.parentElement
              activator?.addEventListener('click', activate)
            })
            onBeforeUnmount(() => activator?.removeEventListener('click', activate))
            return { open, root }
          },
          template: `
            <span ref="root"><div v-if="open || modelValue" role="dialog" @click.stop>
              {{ title }}{{ content }}
              <button v-for="action in actions" @click="
                $emit((typeof action === 'string' ? action : action.name) === actionSubmit ? 'submit' : 'cancel');
                open = false;
                $emit('update:modelValue', false)
              ">{{ $t(typeof action === 'string' ? action : action.name) }}</button>
              <button v-if="closeable" @click="$emit('update:modelValue', false)">Close</button>
              <slot name="content" /><slot name="actions" />
            </div></span>`,
        },
        VCard: {
          props: ['title', 'subtitle', 'text'],
          template: '<div>{{ title }}{{ subtitle }}{{ text }}<slot /><slot name="actions" /></div>',
        },
        VCardText: container,
        VCardActions: container,
        VProgressLinear: true,
        VList: container,
        VListItem: {
          props: ['title', 'subtitle'],
          template:
            '<div>{{ title }} {{ subtitle }}<slot name="subtitle" /><slot name="append" /></div>',
        },
        VForm: { template: '<form><slot /></form>' },
        VAutocomplete: {
          props: ['items', 'modelValue'],
          emits: ['update:modelValue'],
          template: `
            <select :value="modelValue" @change="$emit('update:modelValue', $event.target.value)">
              <option value=""></option>
              <option v-for="item in items" :key="item">{{ item }}</option>
            </select>`,
        },
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
  post.mockReset()
  get.mockImplementation(async () => result([{ ...user }]))
  put.mockReset()
  putRole.mockReset()
  refetchTable.mockClear()
  authUser.value = { id: 'C'.repeat(32) }
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  expect(ui.loading.active.value).toBe(false)
  ui.clear()
  vi.unstubAllGlobals()
})

describe('admin settings', () => {
  it('limits displayed values to 30 characters and marks secrets with a lock icon', async () => {
    const { wrapper } = await setup('settings')
    const options: OvTableOptions = wrapper.findComponent(table).props('options')
    const value = options.columns.find(
      (column) => typeof column !== 'string' && column.name === 'value',
    )
    const secret = options.columns.find(
      (column) => typeof column !== 'string' && column.name === 'secret',
    )
    expect(value).toMatchObject({ maxLength: 30 })
    expect(secret).toMatchObject({
      format: [
        { rules: { type: 'equals', params: 'Y' }, icon: '$mdiLock', text: '' },
        { text: '' },
      ],
    })
  })

  it('passes search and the opaque cursor through and can clear an ordinary setting', async () => {
    const { wrapper } = await setup('settings')
    const settings = wrapper.findComponent(table)
    const row = {
      id: 'SMTP_HOST',
      secret: 'N',
      readonly: 'N',
      value: 'smtp.example.test',
      meta: { type: 'text' },
    }
    const secret = {
      id: 'SMTP_PASSWORD',
      secret: 'Y',
      readonly: 'N',
      value: null,
      meta: { type: 'password' },
    }
    const readonlySecret = { ...secret, id: 'AUTH_JWT_SECRET', readonly: 'Y' }
    const readonlyValue = { ...row, id: 'AUTH_JWT_ISSUER', readonly: 'Y' }
    const page = {
      items: [row, secret, readonlySecret, readonlyValue],
      nextCursor: 'opaque-next',
    }
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    const { signal } = new AbortController()
    get.mockResolvedValueOnce({ ...result(), data: page })
    settings.vm.$emit('fetch', {
      cursor: 'opaque-cursor',
      limit: 5,
      search: 'smtp',
      signal,
      complete,
    })
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/admin/settings', {
      query: { cursor: 'opaque-cursor', limit: 5, search: 'smtp' },
      signal,
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      items: [
        { ...row, editMode: 'value' },
        { ...secret, editMode: 'secret' },
        { ...readonlySecret, editMode: 'none' },
        { ...readonlyValue, editMode: 'none' },
      ],
      nextCursor: 'opaque-next',
    })
    const saved = vi.fn<OvActionComplete>()
    putRole.mockResolvedValueOnce({ data: null, error: null, status: 204, headers: null })
    settings.vm.$emit('action', 'admin.editSetting', page.items, { ...row, value: null }, saved)
    await flushPromises()
    expect(putRole).toHaveBeenCalledExactlyOnceWith('/admin/settings/SMTP_HOST', { value: null })
    expect(saved).toHaveBeenCalledExactlyOnceWith({ status: 'success', refetch: true })
  })

  it('saves a secret replacement and requests a refetch', async () => {
    const { wrapper } = await setup('settings')
    const settings = wrapper.findComponent(table)
    const row = { id: 'API_TOKEN', secret: 'Y', readonly: 'N', value: null }
    const complete = vi.fn<OvActionComplete>()
    putRole.mockResolvedValueOnce({ data: null, error: null, status: 204, headers: null })
    settings.vm.$emit(
      'action',
      'admin.replaceSettingSecret',
      [row],
      { ...row, value: 'new-test-value' },
      complete,
    )
    await flushPromises()
    expect(putRole).toHaveBeenCalledExactlyOnceWith('/admin/settings/API_TOKEN', {
      value: 'new-test-value',
    })
    expect(complete).toHaveBeenLastCalledWith({ status: 'success', refetch: true })
    expect(row.value).toBeNull()
  })

  it('shows server validation on the field without a global notification', async () => {
    const { wrapper } = await setup('settings')
    const complete = vi.fn<OvActionComplete>()
    const error = Object.assign(new Error('Request failed'), {
      status: 422,
      request: '/admin/settings/SMTP_HOST',
      problem: {
        code: 'SETTINGS_VALIDATION_INVALID',
        errors: [{ field: 'value', code: 'SETTINGS_VALIDATION_INVALID' }],
      },
    })
    putRole.mockResolvedValueOnce({ data: null, error, status: 422, headers: null })
    wrapper
      .findComponent(table)
      .vm.$emit('action', 'admin.editSetting', [], { id: 'SMTP_HOST', value: 'bad' }, complete)
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      status: 'invalid',
      errors: [{ name: 'value', message: 'errors.SETTINGS_VALIDATION_INVALID', params: undefined }],
    })
    expect(ui.notification.value).toBeUndefined()
  })

  it('shows a translated business error without closing the form', async () => {
    const { wrapper } = await setup('settings')
    const complete = vi.fn<OvActionComplete>()
    const error = Object.assign(new Error('Request failed'), {
      status: 403,
      request: '/admin/settings/SMTP_HOST',
      problem: { code: 'SETTINGS_REQUIRE_TRUSTED_SETUP' },
    })
    putRole.mockResolvedValueOnce({ data: null, error, status: 403, headers: null })
    wrapper
      .findComponent(table)
      .vm.$emit('action', 'admin.editSetting', [], { id: 'SMTP_HOST', value: 'bad' }, complete)
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith({ status: 'error' })
    expect(ui.notification.value?.message).toBe(
      i18n.global.t('errors.SETTINGS_REQUIRE_TRUSTED_SETUP'),
    )
  })

  it('reports malformed submissions without sending an update', async () => {
    const { wrapper } = await setup('settings')
    const settings = wrapper.findComponent(table)
    const complete = vi.fn<OvActionComplete>()
    settings.vm.$emit('action', 'admin.editSetting', [], { value: 'test' }, complete)
    expect(putRole).not.toHaveBeenCalled()
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      status: 'invalid',
      errors: [{ name: 'value', message: 'admin.updateSettingError' }],
    })
  })

  it('completes unsupported actions with an error without sending an update', async () => {
    const { wrapper } = await setup('settings')
    const complete = vi.fn<OvActionComplete>()
    wrapper.findComponent(table).vm.$emit('action', 'admin.unsupported', [], {}, complete)
    expect(complete).toHaveBeenCalledExactlyOnceWith({ status: 'error' })
    expect(putRole).not.toHaveBeenCalled()
  })

  it.each(['Y', 'N'])(
    'passes the form value %s without consulting displayed rows',
    async (value) => {
      const { wrapper } = await setup('settings')
      const complete = vi.fn<OvActionComplete>()
      putRole.mockResolvedValueOnce({ data: null, error: null, status: 204, headers: null })
      wrapper
        .findComponent(table)
        .vm.$emit(
          'action',
          'admin.editSetting',
          undefined,
          { id: 'AUTH_PASSWORD_ENABLED', value },
          complete,
        )
      await flushPromises()
      expect(putRole).toHaveBeenCalledExactlyOnceWith('/admin/settings/AUTH_PASSWORD_ENABLED', {
        value,
      })
      expect(complete).toHaveBeenCalledExactlyOnceWith({ status: 'success', refetch: true })
    },
  )

  it.each(['response', 'rejection', 'empty rejection'])(
    'explicitly completes with an error on HTTP %s',
    async (kind) => {
      const { wrapper } = await setup('settings')
      const row = { id: 'CUSTOM_POLICY', secret: 'N', readonly: 'Y', value: 'Y' }
      const complete = vi.fn<OvActionComplete>()
      if (kind === 'response') putRole.mockResolvedValueOnce(failure(403))
      else if (kind === 'rejection') putRole.mockRejectedValueOnce(new Error('Network unavailable'))
      else putRole.mockRejectedValueOnce(undefined)
      wrapper.findComponent(table).vm.$emit('action', 'admin.editSetting', [row], row, complete)
      await flushPromises()
      expect(putRole).toHaveBeenCalledExactlyOnceWith('/admin/settings/CUSTOM_POLICY', {
        value: 'Y',
      })
      expect(complete).toHaveBeenCalledExactlyOnceWith({ status: 'error' })
      expect(ui.notification.value).toMatchObject({
        type: 'error',
        message: i18n.global.t('errors.requestFailed'),
      })
    },
  )
})

describe('admin page metadata', () => {
  it.each([
    ['en', messages],
    ['de', de],
    ['fr', fr],
  ] as const)(
    'shows a translated Jobs tile linking to the job list in %s',
    (locale, translations) => {
      const card = defineComponent({
        props: ['to', 'title', 'text'],
        template: '<a :href="to">{{ title }} {{ text }}</a>',
      })
      const wrapper = mount(Admin, {
        global: {
          plugins: [createI18n({ legacy: false, locale, messages: { [locale]: translations } })],
          stubs: { VContainer: container, VRow: container, VCol: container, VCard: card },
        },
      })
      wrappers.push(wrapper)
      const tile = wrapper.get('a[href="/admin/jobs"]')
      expect(tile.text()).toContain(translations['admin.jobs'])
      expect(tile.text()).toContain(translations['admin.jobsDescription'])
    },
  )

  it('discovers the landing page, users list, user details, roles, audit, and settings', () => {
    expect(Object.keys(pages)).toHaveLength(12)
  })

  describe('admin emails', () => {
    it('passes subject, recipient and UTC date filters with opaque cursors unchanged', async () => {
      const { wrapper } = await setup('emails')
      const recipients = 'ada@example.test, grace@example.test, linus@example.test'
      const page = {
        items: [
          {
            id: user.id,
            toRecipients: recipients,
            ccRecipients: 'cc@example.test',
            bccRecipients: 'bcc@example.test',
          },
        ],
        nextCursor: 'opaque-next',
      }
      const complete = vi.fn<OvTableFetchRequest['complete']>()
      const { signal } = new AbortController()
      const from = '2026-11-01T10:00:00.000Z'
      const to = '2026-11-27T18:00:00.000Z'
      const deliveredFrom = '2026-11-02T10:00:00.000Z'
      const deliveredTo = '2026-11-28T18:00:00.000Z'
      get.mockResolvedValueOnce({ data: page, error: null, status: 200, headers: null })
      wrapper.findComponent(table).vm.$emit('fetch', {
        cursor: 'opaque',
        limit: 5,
        search: 'stale table search',
        filter: {
          subject: [' receipt '],
          address: [' cc@example.test '],
          from: [from],
          to: [to],
          deliveredFrom: [deliveredFrom],
          deliveredTo: [deliveredTo],
        },
        signal,
        complete,
      })
      await flushPromises()
      expect(get).toHaveBeenCalledWith('/admin/emails', {
        query: {
          cursor: 'opaque',
          limit: 5,
          search: 'receipt',
          address: 'cc@example.test',
          from,
          to,
          deliveredFrom,
          deliveredTo,
        },
        signal,
      })
      expect(complete.mock.calls[0]?.[0]).toBe(page)
      const options: OvTableOptions = wrapper.findComponent(table).props('options')
      expect(options.search).toBeUndefined()
      expect(options.columns).toEqual(
        expect.arrayContaining([
          { name: 'delivered', label: 'admin.emailDelivered', format: { tsFormat: 'datetime' } },
          { name: 'toRecipients', label: 'admin.emailTo', maxLength: 40 },
          { name: 'ccRecipients', label: 'admin.emailCc', maxLength: 40 },
          { name: 'bccRecipients', label: 'admin.emailBcc', maxLength: 40 },
        ]),
      )
      expect(options.columns.map((column) => column.name)).not.toContain('attempts')
      expect(options.columns.map((column) => column.name)).not.toContain('error')
      expect(options.filter?.fields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'subject', type: 'text' }),
          expect.objectContaining({ name: 'from', filterUtc: true }),
          expect.objectContaining({
            name: 'to',
            filterUtc: true,
            rules: expect.arrayContaining([
              { type: 'date-on-or-after', params: 'from', message: 'admin.emailInvalidInterval' },
            ]),
          }),
          expect.objectContaining({ name: 'deliveredFrom', filterUtc: true }),
          expect.objectContaining({
            name: 'deliveredTo',
            filterUtc: true,
            rules: expect.arrayContaining([
              {
                type: 'date-on-or-after',
                params: 'deliveredFrom',
                message: 'admin.emailInvalidInterval',
              },
            ]),
          }),
        ]),
      )
      const emit = vi.fn<(event: string, ...args: unknown[]) => void>()
      const row = mount(
        {
          render: renderViewItem(
            recipients,
            { name: 'toRecipients', maxLength: 40 },
            {},
            { items: [] },
            emit,
          ),
        },
        {
          global: {
            stubs: {
              VChip: { template: '<span><slot /></span>' },
              VBtn: { template: '<button />' },
            },
          },
        },
      )
      wrappers.push(row)
      await row.get('button').trigger('click')
      expect(emit).toHaveBeenCalledWith('details', 'toRecipients', recipients)
    })

    it('clears subject, recipient and date filters without retaining previous values', async () => {
      const { wrapper } = await setup('emails')
      const complete = vi.fn<OvTableFetchRequest['complete']>()
      const { signal } = new AbortController()
      wrapper.findComponent(table).vm.$emit('fetch', {
        limit: 5,
        search: 'stale table search',
        filter: { subject: [' '], address: [' '] },
        signal,
        complete,
      })
      await flushPromises()
      expect(get).toHaveBeenCalledWith('/admin/emails', {
        query: {
          cursor: undefined,
          limit: 5,
          search: undefined,
          address: undefined,
          from: undefined,
          to: undefined,
          deliveredFrom: undefined,
          deliveredTo: undefined,
        },
        signal,
      })
    })

    it('shows email metadata without the body and keeps list state unchanged', async () => {
      const { wrapper, router } = await setup('emails')
      get.mockResolvedValueOnce({
        data: {
          items: [
            {
              id: user.id,
              subject: 'Receipt',
              status: 'S',
              content: 'sensitive body from an outdated server',
              bodyLength: 42,
              created: '2026-01-01T10:00:00Z',
              priority: 3,
              attempts: 1,
            },
          ],
          addresses: [
            { addrType: 'To', addrAddr: 'ada@example.test', addrName: 'Ada' },
            { addrType: 'Cc', addrAddr: 'cc@example.test', addrName: null },
            { addrType: 'Bcc', addrAddr: 'bcc@example.test', addrName: null },
          ],
          attachments: [{ fileName: 'receipt.pdf', fileSize: 1234 }],
        },
        error: null,
        status: 200,
        headers: null,
      })
      wrapper.findComponent(table).vm.$emit('action', 'admin.details', [], { id: user.id })
      await flushPromises()
      expect(wrapper.get('[role="dialog"]').text()).toContain('Receipt')
      expect(wrapper.findComponent(view).exists()).toBe(false)
      const details = JSON.parse(wrapper.get('[role="dialog"] pre').text())
      expect(details).toMatchObject({
        id: user.id,
        subject: 'Receipt',
        bodyLength: 42,
        addresses: [
          { addrType: 'To', addrAddr: 'ada@example.test', addrName: 'Ada' },
          { addrType: 'Cc', addrAddr: 'cc@example.test', addrName: null },
          { addrType: 'Bcc', addrAddr: 'bcc@example.test', addrName: null },
        ],
        attachments: [{ fileName: 'receipt.pdf', fileSize: 1234 }],
      })
      expect(details).not.toHaveProperty('content')
      expect(wrapper.get('[role="dialog"]').text()).not.toContain('sensitive body')
      expect(wrapper.find('iframe').exists()).toBe(false)
      expect(router.currentRoute.value.path).toBe('/admin/emails')
      await wrapper.get('[role="dialog"] button').trigger('click')
      await flushPromises()
      expect(wrapper.find('pre').exists()).toBe(false)
      expect(refetchTable).not.toHaveBeenCalled()
    })

    it('shows an empty attachment list for messages without attachments', async () => {
      const { wrapper } = await setup('emails')
      get.mockResolvedValueOnce({
        data: {
          items: [{ id: user.id, subject: 'Notice', bodyLength: 0 }],
          addresses: [],
          attachments: [],
        },
        error: null,
        status: 200,
        headers: null,
      })
      wrapper.findComponent(table).vm.$emit('action', 'admin.details', [], { id: user.id })
      await flushPromises()
      expect(JSON.parse(wrapper.get('[role="dialog"] pre').text())).toMatchObject({
        bodyLength: 0,
        attachments: [],
      })
    })

    it('reports details failures in the dialog and discards requests after closing', async () => {
      const { wrapper } = await setup('emails')
      get.mockResolvedValueOnce(failure(404))
      wrapper.findComponent(table).vm.$emit('action', 'admin.details', [], { id: user.id })
      await flushPromises()
      expect(wrapper.get('[role="dialog"]').text()).toContain(messages['admin.emailNotFound'])
      expect(wrapper.find('iframe').exists()).toBe(false)
      await wrapper.get('[role="dialog"] button').trigger('click')
      const pending = Promise.withResolvers<HttpResponse<never>>()
      get.mockReturnValueOnce(pending.promise)
      wrapper.findComponent(table).vm.$emit('action', 'admin.details', [], { id: user.id })
      await flushPromises()
      const signal = get.mock.calls.at(-1)?.[1]?.signal
      await wrapper.get('[role="dialog"] button').trigger('click')
      expect(signal?.aborted).toBe(true)
      pending.resolve(failure(500))
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(ui.notification.value).toBeUndefined()
      expect(refetchTable).not.toHaveBeenCalled()
    })
  })

  describe('admin jobs', () => {
    it('passes search and opaque cursors through, and refreshes only after successful actions', async () => {
      const { wrapper } = await setup('jobs')
      const jobs = wrapper.findComponent(table)
      const page = { items: [], nextCursor: 'opaque-next' }
      const complete = vi.fn<OvTableFetchRequest['complete']>()
      const { signal } = new AbortController()
      get.mockResolvedValueOnce({ data: page, error: null, status: 200, headers: null })
      jobs.vm.$emit('fetch', { cursor: 'opaque', limit: 5, search: 'demo', signal, complete })
      await flushPromises()
      expect(get).toHaveBeenCalledWith('/admin/jobs', {
        query: { cursor: 'opaque', limit: 5, search: 'demo' },
        signal,
      })
      expect(complete).toHaveBeenCalledWith(page)

      post.mockResolvedValueOnce(failure(500))
      jobs.vm.$emit('action', 'admin.runJob', [], { jobName: 'EXAMPLE_JOB' })
      await flushPromises()
      expect(refetchTable).not.toHaveBeenCalled()
      post.mockResolvedValueOnce({
        data: { auditRecorded: 1 },
        error: null,
        status: 200,
        headers: null,
      })
      jobs.vm.$emit('action', 'admin.runJob', [], { jobName: 'EXAMPLE_JOB' })
      await flushPromises()
      expect(post).toHaveBeenLastCalledWith('/admin/jobs/EXAMPLE_JOB/run')
      expect(refetchTable).toHaveBeenCalledExactlyOnceWith('first')
      expect(ui.notification.value).toMatchObject({ type: 'success' })
    })

    it('passes the history cursor unchanged for the selected job', async () => {
      const { wrapper } = await setup('job-history')
      const page = { items: [], nextCursor: 'next' }
      const complete = vi.fn<OvTableFetchRequest['complete']>()
      const { signal } = new AbortController()
      get.mockResolvedValueOnce({ data: page, error: null, status: 200, headers: null })
      wrapper
        .findComponent(table)
        .vm.$emit('fetch', { cursor: 'opaque', limit: 5, signal, complete })
      await flushPromises()
      expect(get).toHaveBeenCalledWith('/admin/jobs/EXAMPLE_JOB/history', {
        query: { cursor: 'opaque', limit: 5 },
        signal,
      })
      expect(complete).toHaveBeenCalledWith(page)
    })

    it('asks for confirmation before disabling a job', async () => {
      const { wrapper } = await setup('jobs')
      post.mockResolvedValueOnce({
        data: { auditRecorded: 1 },
        error: null,
        status: 200,
        headers: null,
      })
      wrapper
        .findComponent(table)
        .vm.$emit('action', 'admin.disableJob', [], { jobName: 'EXAMPLE_JOB' })
      await flushPromises()
      expect(post).not.toHaveBeenCalled()
      const dialog = wrapper.find('[role="dialog"]')
      expect(dialog.text()).toContain('EXAMPLE_JOB')
      const submit = dialog.findAll('button').find((button) => button.text() === 'Disable job')
      expect(submit).toBeDefined()
      await submit!.trigger('click')
      await flushPromises()
      expect(post).toHaveBeenCalledExactlyOnceWith('/admin/jobs/EXAMPLE_JOB/disable')
    })

    it('warns and refreshes when the action completed but its audit failed', async () => {
      const { wrapper } = await setup('jobs')
      post.mockResolvedValueOnce({
        data: { auditRecorded: 0 },
        error: null,
        status: 200,
        headers: null,
      })
      wrapper
        .findComponent(table)
        .vm.$emit('action', 'admin.runJob', [], { jobName: 'EXAMPLE_JOB' })
      await flushPromises()
      expect(post).toHaveBeenCalledExactlyOnceWith('/admin/jobs/EXAMPLE_JOB/run')
      expect(refetchTable).toHaveBeenCalledExactlyOnceWith('first')
      expect(ui.notification.value).toMatchObject({
        type: 'warning',
        message: 'admin.jobAuditWarning',
      })
    })
  })

  it.each(Object.entries(pages))('restricts %s to administrators', (path, source) => {
    const metadata = source.match(/definePage\(\{\s*meta:\s*\{([\s\S]*?)\n\s*\},?\s*\}\)/)?.[1]
    expect(metadata).toMatch(/\baccess:\s*\[\s*'admin'\s*\]/)
    expect(metadata).toMatch(
      path.includes('/[id]') || path.includes('/[name]')
        ? /\bnavigation:\s*false/
        : /\bnavigation:\s*true/,
    )
    const policy = {
      access: ['admin'] as ['admin'],
      navigation: !path.includes('/[id]') && !path.includes('/[name]'),
    }
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

describe('admin global audit', () => {
  it('lists unfiltered events and filters by a user selected through username or display name search', async () => {
    const { wrapper } = await setup('global-audit')
    const component = wrapper.findComponent(table)
    const options: OvTableOptions = component.props('options')
    expect(options.columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'username' }),
        expect.objectContaining({ name: 'displayName' }),
      ]),
    )
    const page = {
      items: [{ id: 'audit-1', body: 'Signed in', username: user.username }],
      nextCursor: 'next',
    }
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    const { signal } = new AbortController()
    get.mockResolvedValueOnce({ ...result(), data: page })
    component.vm.$emit('fetch', { limit: 5, signal, complete } satisfies OvTableFetchRequest)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/admin/audit/events', {
      query: expect.objectContaining({ userId: undefined, limit: 5 }),
      signal,
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith(page)

    const userFilter = options.filter?.fields.find(
      (field): field is OvFormSelectionField =>
        field.type === 'autocomplete' && field.name === 'userId',
    )
    expect(await userFilter?.fetchItems?.('Ada')).toEqual([
      { value: user.id, title: `Ada (${user.username})` },
    ])
    expect(get).toHaveBeenLastCalledWith('/admin/users', { query: { search: 'Ada', limit: 25 } })

    get.mockResolvedValueOnce({ ...result(), data: page })
    component.vm.$emit('fetch', {
      cursor: 'next',
      limit: 5,
      filter: { userId: [user.id], severity: ['INFO'], messageType: ['auth.login'] },
      signal,
      complete,
    } satisfies OvTableFetchRequest)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/admin/audit/events', {
      query: expect.objectContaining({
        cursor: 'next',
        userId: user.id,
        severity: 'INFO',
        messageType: 'auth.login',
      }),
      signal,
    })
  })
})

describe('admin user audit', () => {
  async function openAudit() {
    const { wrapper } = await setup(true)
    expect(wrapper.findComponent(table).exists()).toBe(false)
    await wrapper.get('button[role="tab"][value="audit"]').trigger('click')
    await flushPromises()
    return wrapper.findComponent(table)
  }

  it('loads audit lazily and forwards filters and opaque cursor without changing the page', async () => {
    const component = await openAudit()
    const page = {
      items: [{ id: 'audit-1', eventName: 'auth.login', body: 'Signed in', severityText: 'INFO' }],
      nextCursor: 'opaque-audit-next',
    }
    get.mockResolvedValueOnce({ ...result(), data: page })
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    const { signal } = new AbortController()
    const from = '2026-11-01T10:00:00.000Z'
    const to = '2026-11-18T12:00:00.000Z'
    component.vm.$emit('fetch', {
      cursor: 'opaque-audit-cursor',
      limit: 1,
      search: 'Signed',
      filter: { severity: ['WARN', 'INFO'], messageType: ['auth.login'], from: [from], to: [to] },
      signal,
      complete,
    } satisfies OvTableFetchRequest)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(`/admin/users/${user.id}/audit`, {
      query: {
        cursor: 'opaque-audit-cursor',
        limit: 1,
        severity: 'WARN,INFO',
        messageType: 'auth.login',
        from,
        to,
      },
      signal,
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith(page)
    expect(component.props('options').itemsPerPage).toBeUndefined()
    expect(component.props('options').mobileItemsPerPage).toBeUndefined()
  })

  it('reports load failures but ignores failures from cancelled requests', async () => {
    const component = await openAudit()
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    get.mockResolvedValueOnce(failure(403))
    component.vm.$emit('fetch', {
      limit: 5,
      signal: new AbortController().signal,
      complete,
    } satisfies OvTableFetchRequest)
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.loadAuditError' })
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    ui.clear()
    complete.mockClear()
    const pending = Promise.withResolvers<HttpResponse<unknown>>()
    get.mockReturnValueOnce(pending.promise)
    const controller = new AbortController()
    component.vm.$emit('fetch', { limit: 5, signal: controller.signal, complete })
    controller.abort()
    pending.resolve(failure(500))
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(ui.notification.value).toBeUndefined()
  })
})

describe('admin users list', () => {
  function fetchUsers(
    wrapper: ReturnType<typeof mount>,
    params: Partial<Pick<OvTableFetchRequest, 'cursor' | 'limit' | 'search'>> = {},
  ) {
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    const controller = new AbortController()
    wrapper.findComponent(table).vm.$emit('fetch', {
      limit: 5,
      ...params,
      signal: controller.signal,
      complete,
    } satisfies OvTableFetchRequest)
    return { complete, controller }
  }

  it('preserves unrelated feedback during searches and after unmount', async () => {
    const pending = Promise.withResolvers<ReturnType<typeof result>>()
    get.mockReturnValue(pending.promise)
    ui.success('Other operation completed')
    const { wrapper } = await setup()
    fetchUsers(wrapper, { search: 'ada' })
    expect(ui.notification.value?.message).toBe('Other operation completed')
    pending.resolve(result())
    await flushPromises()
    expect(ui.notification.value?.message).toBe('Other operation completed')
    wrapper.unmount()
    expect(ui.notification.value?.message).toBe('Other operation completed')
  })

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
    const { complete, controller } = fetchUsers(wrapper)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/admin/users', {
      query: { cursor: undefined, limit: 5, search: undefined },
      signal: controller.signal,
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      items: records,
      nextCursor: 'opaque-next-page',
    })
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

  it('forwards opaque continuation and table-normalized search and completes with the page', async () => {
    const second = { ...user, id: 'B'.repeat(32), username: 'bob@example.test' }
    get.mockResolvedValue(result([user], 'opaque-user-cursor'))
    const { wrapper } = await setup()
    const component = wrapper.findComponent(table)
    const first = fetchUsers(wrapper, { limit: 1, search: 'ada' })
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: undefined, limit: 1, search: 'ada' } }),
    )
    expect(first.complete).toHaveBeenCalledExactlyOnceWith({
      items: [user],
      nextCursor: 'opaque-user-cursor',
    })
    get.mockResolvedValue(result([second]))
    const secondRequest = fetchUsers(wrapper, {
      cursor: 'opaque-user-cursor',
      limit: 1,
      search: 'ada',
    })
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(
      '/admin/users',
      expect.objectContaining({ query: { cursor: 'opaque-user-cursor', limit: 1, search: 'ada' } }),
    )
    expect(secondRequest.complete).toHaveBeenCalledExactlyOnceWith({
      items: [second],
      nextCursor: undefined,
    })
    expect(component.props('options').columns.at(-1).actions[0].format.to).toBe(
      '/admin/users/{{value}}',
    )
  })

  it('completes empty searches without notifications and reports failures', async () => {
    get.mockResolvedValue(result([]))
    const { wrapper } = await setup()
    const first = fetchUsers(wrapper, { search: 'missing' })
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(first.complete).toHaveBeenCalledExactlyOnceWith({ items: [], nextCursor: undefined })
    const second = fetchUsers(wrapper, { search: 'still missing' })
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
    expect(second.complete).toHaveBeenCalledExactlyOnceWith({ items: [], nextCursor: undefined })
    get.mockResolvedValue(failure(403))
    const { complete } = fetchUsers(wrapper)
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.loadUsersError' })
    expect(complete).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(ui.loading.active.value).toBe(false)
  })

  it('tracks app loading until a cancelled request settles without late feedback after unmount', async () => {
    let resolveRequest!: (response: ReturnType<typeof result>) => void
    get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const { wrapper } = await setup()
    const { complete, controller } = fetchUsers(wrapper)
    expect(ui.loading.has('admin.users.list')).toBe(true)
    controller.abort()
    wrapper.unmount()
    expect(get.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
    resolveRequest(failure(500))
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    expect(complete).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(ui.notification.value).toBeUndefined()
  })

  it('ignores a cancelled failure after a newer search completes', async () => {
    let resolveFirst!: (response: ReturnType<typeof result>) => void
    get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFirst = resolve
      }),
    )
    const { wrapper } = await setup()
    const old = fetchUsers(wrapper, { search: 'old' })
    expect(ui.loading.active.value).toBe(true)
    old.controller.abort()
    const current = fetchUsers(wrapper, { search: 'new' })
    await flushPromises()
    expect(current.complete).toHaveBeenCalledExactlyOnceWith({
      items: [user],
      nextCursor: undefined,
    })
    resolveFirst(failure(500))
    await flushPromises()
    expect(old.complete).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(ui.loading.active.value).toBe(false)
    expect(ui.notification.value).toBeUndefined()
  })

  it('does not report an empty list for a superseded request', async () => {
    const stale = Promise.withResolvers<ReturnType<typeof result>>()
    const current = Promise.withResolvers<ReturnType<typeof result>>()
    get.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise)
    const { wrapper } = await setup()
    const old = fetchUsers(wrapper, { search: 'old' })
    old.controller.abort()
    const { complete } = fetchUsers(wrapper, { search: 'new' })
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
    expect(ui.loading.has('admin.users.list')).toBe(true)
    expect(complete).not.toHaveBeenCalled()
    stale.resolve(result([]))
    await flushPromises()
    expect(ui.notification.value).toBeUndefined()
    expect(old.complete).toHaveBeenCalledExactlyOnceWith(undefined)
    current.resolve(result())
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith({
      items: [user],
      nextCursor: undefined,
    })
  })

  it.each([403, 404, 500])(
    'reports a localized %s failure and settles table fetching',
    async (status) => {
      get.mockResolvedValueOnce(failure(status))
      const { wrapper } = await setup()
      const { complete } = fetchUsers(wrapper)
      await flushPromises()
      expect(complete).toHaveBeenCalledExactlyOnceWith(undefined)
      expect(ui.notification.value).toMatchObject({
        type: 'error',
        message: 'admin.loadUsersError',
      })
      expect(ui.loading.active.value).toBe(false)
    },
  )

  it('reports missing data as a load error', async () => {
    get.mockResolvedValueOnce({ data: null, error: null, status: 204, headers: null })
    const { wrapper } = await setup()
    const { complete } = fetchUsers(wrapper)
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(ui.notification.value?.message).toBe('admin.loadUsersError')
  })

  it('reports unexpected thrown errors and releases loading', async () => {
    get.mockRejectedValueOnce(new Error('Network failed'))
    const { wrapper } = await setup()
    const { complete } = fetchUsers(wrapper)
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(ui.notification.value?.message).toBe(i18n.global.t('errors.requestFailed'))
    expect(ui.loading.active.value).toBe(false)
  })
})

describe('admin roles list', () => {
  function fetchRoles(wrapper: ReturnType<typeof mount>, search: string, cursor?: string) {
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    const { signal } = new AbortController()
    wrapper.findComponent(table).vm.$emit('fetch', {
      search,
      cursor,
      limit: 5,
      signal,
      complete,
    } satisfies OvTableFetchRequest)
    return { complete, signal }
  }

  it('forwards search, limit, and opaque server cursors without repaginating', async () => {
    const editors = Array.from({ length: 5 }, (_, index) => ({
      role: `editor-${index + 1}`,
      description: null,
    }))
    const contributor = { role: 'contributor', description: 'Can edit content' }
    const cursor = 'opaque-role-cursor'
    const firstPage = { items: editors, nextCursor: cursor }
    const lastPage = { items: [contributor] }
    get
      .mockResolvedValueOnce({ ...result(), data: firstPage })
      .mockResolvedValueOnce({ ...result(), data: lastPage })
    const { wrapper } = await setup('roles')
    const first = fetchRoles(wrapper, 'EDIT')
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/admin/roles', {
      query: { cursor: undefined, limit: 5, search: 'EDIT' },
      signal: first.signal,
    })
    expect(first.complete).toHaveBeenCalledExactlyOnceWith(firstPage)
    const second = fetchRoles(wrapper, 'EDIT', cursor)
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/admin/roles', {
      query: { cursor, limit: 5, search: 'EDIT' },
      signal: second.signal,
    })
    expect(second.complete).toHaveBeenCalledExactlyOnceWith(lastPage)
    get.mockResolvedValueOnce({ ...result(), data: { items: [] } })
    const empty = fetchRoles(wrapper, 'no match')
    await flushPromises()
    expect(empty.complete).toHaveBeenCalledExactlyOnceWith({ items: [] })
  })

  it('reports catalog load failures without presenting them as empty search results', async () => {
    get.mockResolvedValueOnce(failure(500))
    const { wrapper } = await setup('roles')
    const { complete } = fetchRoles(wrapper, '')
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(ui.notification.value?.message).toBe('admin.loadRolesError')
  })
})

describe('admin user details', () => {
  it.each(['permissions', 'audit'] as const)(
    'opens %s directly and loads only its content',
    async (selected) => {
      const { wrapper } = await setup(selected)
      expect(wrapper.findComponent(tabs).props('modelValue')).toBe(selected)
      expect(wrapper.findAllComponents(table)).toHaveLength(1)
      expect(get).toHaveBeenCalledExactlyOnceWith(`/admin/users/${user.id}`)
    },
  )

  it('updates the URL and follows browser back and forward', async () => {
    const { wrapper, router } = await setup(true)
    await wrapper.get('button[role="tab"][value="audit"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`/admin/users/${user.id}/audit`)
    expect(wrapper.findComponent(tabs).props('modelValue')).toBe('audit')

    const back = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => {
        remove()
        resolve()
      })
    })
    router.back()
    await back
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`/admin/users/${user.id}`)
    expect(wrapper.findComponent(tabs).props('modelValue')).toBe('details')
    expect(wrapper.findComponent(table).exists()).toBe(false)

    const forward = new Promise<void>((resolve) => {
      const remove = router.afterEach(() => {
        remove()
        resolve()
      })
    })
    router.forward()
    await forward
    await flushPromises()
    expect(router.currentRoute.value.path).toBe(`/admin/users/${user.id}/audit`)
    expect(wrapper.findComponent(tabs).props('modelValue')).toBe('audit')
  })

  it('disables the status action only for status loading', async () => {
    const { wrapper } = await setup(true)
    const disable = () =>
      wrapper.findAll('button').find((button) => button.text() === messages['admin.disableUser'])!
    const finishList = ui.loading.start('admin.users.list')
    const finishDetails = ui.loading.start('admin.users.details')
    try {
      await flushPromises()
      expect(disable().attributes('disabled')).toBeUndefined()
      const finishStatus = ui.loading.start('admin.users.status')
      try {
        await flushPromises()
        expect(disable().attributes('disabled')).toBeDefined()
      } finally {
        finishStatus()
      }
      await flushPromises()
      expect(disable().attributes('disabled')).toBeUndefined()
    } finally {
      finishList()
      finishDetails()
    }
  })

  it('preserves unrelated feedback when loading and leaving the page', async () => {
    ui.success('Other operation completed')
    const { wrapper } = await setup(true)
    expect(ui.notification.value?.message).toBe('Other operation completed')
    wrapper.unmount()
    expect(ui.notification.value?.message).toBe('Other operation completed')
  })

  it('loads account details without fetching role assignments until requested', async () => {
    const { wrapper, router } = await setup(true)
    expect(get).toHaveBeenCalledWith(`/admin/users/${user.id}`)
    const component = wrapper.findComponent(view)
    expect(component.props('data')).toEqual(user)
    expect(wrapper.get('h3').text()).toBe(user.username)
    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      messages['admin.details'],
      messages['admin.permissions'],
      messages['admin.audit'],
    ])
    expect(get).toHaveBeenCalledTimes(1)
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

  it('opens the available table on demand and adds a role from a later page without loading the catalog', async () => {
    const path = `/admin/users/${user.id}/roles`
    const { wrapper } = await setup(true)
    await wrapper.get('button[role="tab"][value="permissions"]').trigger('click')
    await flushPromises()
    const assigned = wrapper.findComponent(table)
    const assignedCursor = 'opaque-assigned-cursor'
    const assignedPage = { items: [{ role: 'reader' }], nextCursor: 'opaque-assigned-next' }
    const completeAssigned = vi.fn<OvTableFetchRequest['complete']>()
    const { signal } = new AbortController()
    get.mockResolvedValueOnce({ ...result(), data: assignedPage })
    assigned.vm.$emit('fetch', {
      cursor: assignedCursor,
      search: 'read',
      limit: 5,
      signal,
      complete: completeAssigned,
    })
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(path, {
      query: { cursor: assignedCursor, limit: 5, search: 'read' },
      signal,
    })
    expect(completeAssigned).toHaveBeenCalledExactlyOnceWith(assignedPage)
    expect(wrapper.findAllComponents(table)).toHaveLength(1)
    expect(get).toHaveBeenCalledTimes(3)

    assigned.vm.$emit('action', 'admin.addRole', [], {})
    await flushPromises()
    const available = wrapper.get('[role="dialog"]').findComponent(table)
    const editor = { role: 'editor', description: 'Can edit content' }
    const page = { items: [editor], nextCursor: 'opaque-available-next' }
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    get.mockResolvedValueOnce({ ...result(), data: page })
    available.vm.$emit('fetch', {
      cursor: 'opaque-available-cursor',
      limit: 1,
      search: 'edit',
      signal,
      complete,
    })
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith(`${path}/available`, {
      query: { cursor: 'opaque-available-cursor', limit: 1, search: 'edit' },
      signal,
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith(page)
    const saved = Promise.withResolvers<HttpResponse<unknown>>()
    putRole.mockReturnValueOnce(saved.promise)
    available.vm.$emit('action', 'admin.addRole', page.items, editor)
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)
    expect(wrapper.get('[role="dialog"]').find('button').exists()).toBe(false)
    expect(ui.loading.has('admin.users.roles.save')).toBe(true)
    expect(refetchTable).not.toHaveBeenCalled()
    saved.resolve({ data: null, error: null, status: 204, headers: null })
    await flushPromises()
    expect(putRole).toHaveBeenCalledExactlyOnceWith(path, { role: 'editor', assigned: true })
    expect(refetchTable).toHaveBeenCalledExactlyOnceWith('first')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(ui.notification.value).toMatchObject({ type: 'success', message: 'admin.roleAdded' })
  })

  it.each(['failure', 'abort'] as const)(
    'closes the picker on save %s and alerts globally',
    async (outcome) => {
      const { wrapper } = await setup(true)
      await wrapper.get('button[role="tab"][value="permissions"]').trigger('click')
      await flushPromises()
      wrapper.findComponent(table).vm.$emit('action', 'admin.addRole', [], {})
      await flushPromises()
      const available = wrapper.get('[role="dialog"]').findComponent(table)
      const editor = { role: 'editor' }

      if (outcome === 'abort') {
        putRole.mockResolvedValueOnce({
          ...failure(500),
          status: null,
          error: Object.assign(new DOMException('Request aborted', 'AbortError'), {
            status: null,
            request: `/admin/users/${user.id}/roles`,
          }),
        })
      } else {
        putRole.mockResolvedValueOnce(failure(500))
      }
      available.vm.$emit('action', 'admin.addRole', [editor], editor)
      await flushPromises()
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(putRole).toHaveBeenCalledTimes(1)
      expect(refetchTable).not.toHaveBeenCalled()
      expect(ui.notification.value).toMatchObject({
        type: 'error',
        message: 'admin.updateRoleError',
      })

      wrapper.findComponent(table).vm.$emit('action', 'admin.addRole', [], {})
      await flushPromises()
      expect(wrapper.get('[role="dialog"]').find('[role="alert"]').exists()).toBe(false)
    },
  )

  it('reports an assigned list reload failure globally but ignores an aborted load', async () => {
    const { wrapper } = await setup(true)
    await wrapper.get('button[role="tab"][value="permissions"]').trigger('click')
    await flushPromises()
    const assigned = wrapper.findComponent(table)
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    const controller = new AbortController()
    const emitFetch = (signal: AbortSignal) =>
      assigned.vm.$emit('fetch', { limit: 5, signal, complete })
    refetchTable.mockImplementationOnce(async () => {
      get.mockResolvedValueOnce(failure(503))
      emitFetch(controller.signal)
      return false
    })
    assigned.vm.$emit('action', 'admin.addRole', [], {})
    await flushPromises()
    const editor = { role: 'editor' }
    putRole.mockResolvedValueOnce({ data: null, error: null, status: 204, headers: null })
    wrapper
      .get('[role="dialog"]')
      .findComponent(table)
      .vm.$emit('action', 'admin.addRole', [editor], editor)
    await flushPromises()
    expect(complete).toHaveBeenCalledExactlyOnceWith()
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.loadRolesError' })

    ui.clear()
    const read = Promise.withResolvers<HttpResponse<unknown>>()
    get.mockReturnValueOnce(read.promise)
    emitFetch(controller.signal)
    controller.abort()
    read.resolve(failure(503))
    await flushPromises()
    expect(complete).toHaveBeenNthCalledWith(2)
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(ui.notification.value).toBeUndefined()
    expect(putRole).toHaveBeenCalledTimes(1)
  })

  it('confirms removal and refreshes the assigned table after saving', async () => {
    const { wrapper } = await setup(true)
    await wrapper.get('button[role="tab"][value="permissions"]').trigger('click')
    await flushPromises()
    const editor = { role: 'editor' }
    putRole.mockResolvedValueOnce({ data: null, error: null, status: 204, headers: null })
    wrapper.findComponent(table).vm.$emit('action', 'admin.removeRole', [editor], editor)
    await flushPromises()
    expect(putRole).not.toHaveBeenCalled()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Remove the editor role')
    await wrapper.get('[role="dialog"] button:last-of-type').trigger('click')
    await flushPromises()
    expect(putRole).toHaveBeenCalledExactlyOnceWith(`/admin/users/${user.id}/roles`, {
      role: 'editor',
      assigned: false,
    })
    expect(refetchTable).toHaveBeenCalledExactlyOnceWith('first')
  })

  it('closes the confirmation during removal, blocks a second submission, and alerts on failure', async () => {
    const { wrapper } = await setup(true)
    await wrapper.get('button[role="tab"][value="permissions"]').trigger('click')
    await flushPromises()
    const assigned = wrapper.findComponent(table)
    const editor = { role: 'editor' }
    const remove = () => assigned.vm.$emit('action', 'admin.removeRole', [editor], editor)
    const saved = Promise.withResolvers<HttpResponse<unknown>>()
    putRole.mockReturnValueOnce(saved.promise)

    remove()
    await flushPromises()
    const submit = wrapper.get('[role="dialog"] button:last-of-type')
    const firstClick = submit.trigger('click')
    await submit.trigger('click')
    await firstClick
    remove()
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(putRole).toHaveBeenCalledTimes(1)

    saved.resolve(failure(500))
    await flushPromises()
    expect(ui.notification.value).toMatchObject({ type: 'error', message: 'admin.updateRoleError' })
    expect(refetchTable).not.toHaveBeenCalled()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)

    remove()
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Remove the editor role')
    expect(putRole).toHaveBeenCalledTimes(1)
  })

  it('does not offer to remove the signed-in user’s admin role', async () => {
    authUser.value = { id: user.id }
    const { wrapper } = await setup(true)
    await wrapper.get('button[role="tab"][value="permissions"]').trigger('click')
    await flushPromises()
    const admin = { role: 'admin' }
    wrapper.findComponent(table).vm.$emit('action', 'admin.removeRole', [admin], admin)
    await flushPromises()
    expect(ui.notification.value?.message).toBe('admin.cannotRemoveOwnAdmin')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(putRole).not.toHaveBeenCalled()
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

  it('ignores a late response for the previous user after a route change', async () => {
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
    expect(ui.loading.has('admin.users.details')).toBe(true)
    resolveFirst(result([{ ...user }]))
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.findComponent(view).props('data')).toEqual(next)
    expect(wrapper.get('h3').text()).toBe(next.username)
    expect(getBreadcrumbOverride(router).value?.title).toBe(next.displayName)
    expect(get.mock.calls[0]).toHaveLength(1)
    expect(ui.notification.value).toBeUndefined()
  })

  it('tracks a detail request until completion after unmount and reports its failure', async () => {
    let resolveRequest!: (response: ReturnType<typeof result>) => void
    get.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const { wrapper } = await setup(true)
    expect(ui.loading.active.value).toBe(true)
    wrapper.unmount()
    expect(ui.loading.has('admin.users.details')).toBe(true)
    resolveRequest(failure(500))
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    expect(ui.notification.value?.message).toBe('admin.loadUserError')
  })

  it.each(['route change', 'unmount'] as const)(
    'reports a thrown detail error after %s',
    async (change) => {
      const request = Promise.withResolvers<ReturnType<typeof result>>()
      get.mockReturnValueOnce(request.promise)
      const { wrapper, router } = await setup(true)
      if (change === 'unmount') {
        wrapper.unmount()
      } else {
        const next = { ...user, id: 'B'.repeat(32) }
        get.mockResolvedValue(result([next]))
        await router.push(`/admin/users/${next.id}`)
        await flushPromises()
      }
      request.reject(new Error('Late network failure'))
      await flushPromises()
      expect(ui.notification.value?.message).toBe(i18n.global.t('errors.requestFailed'))
      expect(ui.loading.active.value).toBe(false)
      if (change === 'route change') {
        expect(wrapper.findComponent(view).props('data').id).toBe('B'.repeat(32))
      }
    },
  )

  it('ignores an old response even after navigating back to the same user', async () => {
    const first = Promise.withResolvers<ReturnType<typeof result>>()
    get.mockReturnValueOnce(first.promise)
    const { wrapper, router } = await setup(true)
    const next = { ...user, id: 'B'.repeat(32) }
    get.mockResolvedValueOnce(result([next]))
    await router.push(`/admin/users/${next.id}`)
    await flushPromises()
    const latest = { ...user, displayName: 'Latest' }
    get.mockResolvedValueOnce(result([latest]))
    await router.push(`/admin/users/${user.id}`)
    await flushPromises()
    first.resolve(result([{ ...user, displayName: 'Stale' }]))
    await flushPromises()
    expect(wrapper.findComponent(view).props('data')).toEqual(latest)
    expect(getBreadcrumbOverride(router).value?.title).toBe('Latest')
  })

  it('reports a returned error from a previous page without changing the new user', async () => {
    const first = Promise.withResolvers<ReturnType<typeof result>>()
    get.mockReturnValueOnce(first.promise)
    const { wrapper, router } = await setup(true)
    const next = { ...user, id: 'B'.repeat(32) }
    get.mockResolvedValue(result([next]))
    await router.push(`/admin/users/${next.id}`)
    await flushPromises()
    first.resolve(failure(500))
    await flushPromises()
    expect(ui.notification.value?.message).toBe('admin.loadUserError')
    expect(wrapper.findComponent(view).props('data')).toEqual(next)
  })

  it('reports thrown detail requests and releases app loading', async () => {
    get.mockRejectedValue(new Error('Network failed'))
    const { wrapper } = await setup(true)
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: i18n.global.t('errors.requestFailed'),
    })
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.findComponent(view).exists()).toBe(false)
  })

  it('requires confirmation before disabling and updates the local status after success', async () => {
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
    put.mockResolvedValue(null)
    await wrapper.get('[role="dialog"]').findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(put).toHaveBeenCalledExactlyOnceWith(`/admin/users/${user.id}/status`, {
      enabled: false,
    })
    expect(wrapper.findComponent(view).props('data')).toEqual({ ...user, enabled: false })
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
    expect(put).toHaveBeenCalledWith(`/admin/users/${user.id}/status`, { enabled: true })
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
      put.mockRejectedValue(failure(status).error)
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
        message: i18n.global.t('errors.requestFailed'),
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

  it('requires a fresh confirmation to retry a failure and preserves feedback while saving', async () => {
    put.mockRejectedValue(failure(500).error)
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.disableUser'])!
      .trigger('click')
    await wrapper.get('[role="dialog"]').findAll('button')[1]!.trigger('click')
    await flushPromises()
    expect(ui.notification.value?.message).toBe(i18n.global.t('errors.requestFailed'))
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
    expect(ui.notification.value?.message).toBe(i18n.global.t('errors.requestFailed'))
    expect(ui.loading.has('admin.users.status')).toBe(true)
    resolveMutation(result([{ ...user, enabled: false }]))
    await flushPromises()
    expect(put).toHaveBeenCalledTimes(2)
    expect(ui.notification.value?.message).toBe('admin.userDisabled')
  })

  it('accepts a no-content mutation response without selecting a returned record', async () => {
    get.mockResolvedValue(result([{ ...user, enabled: false }]))
    put.mockResolvedValue(null)
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.enableUser'])!
      .trigger('click')
    await flushPromises()
    expect(ui.notification.value).toMatchObject({
      type: 'success',
      message: 'admin.userEnabled',
    })
    expect(wrapper.findComponent(view).props('data').enabled).toBe(true)
  })

  it('reports a thrown status request and releases loading without changing the user', async () => {
    get.mockResolvedValue(result([{ ...user, enabled: false }]))
    put.mockRejectedValue(new Error('Network failed'))
    const { wrapper } = await setup(true)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === messages['admin.enableUser'])!
      .trigger('click')
    await flushPromises()
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: i18n.global.t('errors.requestFailed'),
    })
    expect(ui.loading.active.value).toBe(false)
    expect(wrapper.findComponent(view).props('data').enabled).toBe(false)
  })

  it('prevents duplicate submissions and only changes the original account after navigation', async () => {
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
    expect(ui.loading.has('admin.users.status')).toBe(true)
    expect(put.mock.calls[0]).toHaveLength(2)
    resolveMutation(result([{ ...user, enabled: false }]))
    await flushPromises()
    expect(wrapper.findComponent(view).props('data')).toEqual(next)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain(messages['admin.userDisabled'])
    expect(ui.notification.value?.message).toBe('admin.userDisabled')
    ui.clear()
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

  it('lets a write finish after unmount and reports its failure through ui.action', async () => {
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
    expect(ui.loading.has('admin.users.status')).toBe(true)
    expect(put.mock.calls[0]).toHaveLength(2)
    rejectMutation(new Error('Network failed'))
    await flushPromises()
    expect(ui.loading.active.value).toBe(false)
    expect(ui.notification.value).toMatchObject({
      type: 'error',
      message: i18n.global.t('errors.requestFailed'),
    })
    ui.clear()
  })
})
