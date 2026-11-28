import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { VBtn, VDialog, VSelect, VTab } from 'vuetify/components'
import type { HttpClient, HttpResponse } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import { i18n } from '@/capabilities/i18n'
import UserDetails from '@/modules/admin/pages/users/[id].vue'
import UserAudit from '@/modules/admin/pages/users/[id]/audit.vue'
import UserDetailsTab from '@/modules/admin/pages/users/[id]/index.vue'
import UserPermissionsTab from '@/modules/admin/pages/users/[id]/permissions.vue'
import VOvForm from '@/components/forms/VOvForm.vue'
import VOvView from '@/components/data/VOvView.vue'
import VOvTable from '@/components/data/VOvTable.vue'
import messages from '@/modules/admin/i18n/en.json'
import sharedMessages from '@/app/i18n/en.json'

const { get } = vi.hoisted(() => ({ get: vi.fn<HttpClient['get']>() }))
vi.mock('@/capabilities/client', () => ({ http: { get } }))
vi.mock('@/capabilities/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/capabilities/http')>()),
  useHttp: () => ({ get }),
}))
vi.mock('@/capabilities/auth', () => ({
  useAuth: () => ({ user: { value: { id: 'another-admin' } } }),
}))

beforeEach(() => {
  i18n.global.mergeLocaleMessage('en', messages)
  sessionStorage.clear()
  vi.stubGlobal('definePage', vi.fn<() => void>())
})

afterEach(() => {
  sessionStorage.clear()
  vi.unstubAllGlobals()
})

describe('admin user details view', () => {
  it.each([
    { field: 'severity', value: ['WARN'], query: { severity: 'WARN' } },
    { field: 'messageType', value: 'auth.login', query: { messageType: 'auth.login' } },
    {
      field: 'from',
      value: '2026-11-01T10:00',
      query: { from: new Date('2026-11-01T10:00').toISOString() },
    },
    {
      field: 'to',
      value: '2026-11-18T12:00',
      query: { to: new Date('2026-11-18T12:00').toISOString() },
    },
  ])(
    'applies the audit $field filter through the actual table form',
    async ({ field, value, query }) => {
      get.mockReset()
      get
        .mockResolvedValueOnce({
          data: { items: [{ id: 'entry-1', body: 'Initial entry', severityText: 'INFO' }] },
          error: null,
          status: 200,
          headers: null,
        })
        .mockResolvedValue({
          data: { items: [] },
          error: null,
          status: 200,
          headers: null,
        })
      const wrapper = mount(UserAudit, {
        props: {
          user: {
            id: 'user-1',
            username: 'test',
            displayName: null,
            enabled: true,
            createdAt: '2026-01-01T00:00:00Z',
            updatedAt: '2026-01-01T00:00:00Z',
          },
          isSelf: false,
        },
        attachTo: document.body,
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              messages: { en: { ...sharedMessages, ...messages } },
              missing: () => {},
            }),
          ],
          stubs: { VIcon: true },
        },
      })
      try {
        await flushPromises()
        expect(wrapper.text()).toContain('Initial entry')
        const filterButton = wrapper
          .findAllComponents(VBtn)
          .find((button) => button.props('icon') === '$mdiFilterPlus')!
        await filterButton.trigger('click')
        await flushPromises()
        const form = wrapper.getComponent(VOvForm)
        if (field === 'severity') {
          form.getComponent(VSelect).vm.$emit('update:modelValue', value)
        } else {
          await form.get(`input[id="${field}"]`).setValue(value)
        }
        const apply = wrapper
          .findAllComponents(VBtn)
          .find((button) => button.text() === messages['admin.apply'])!
        await apply.trigger('click')
        await flushPromises()
        expect(get).toHaveBeenLastCalledWith(
          '/admin/users/user-1/audit',
          expect.objectContaining({
            query: expect.objectContaining({ cursor: undefined, ...query }),
          }),
        )
        expect(JSON.parse(sessionStorage.getItem('admin.users.user-1.audit')!)).toMatchObject({
          filter: { [field]: value },
        })
        expect(wrapper.text()).not.toContain('Initial entry')
        get.mockResolvedValueOnce({
          data: { items: [{ id: 'entry-1', body: 'Initial entry', severityText: 'INFO' }] },
          error: null,
          status: 200,
          headers: null,
        })
        if (field === 'severity' || field === 'messageType') {
          await filterButton.trigger('click')
          await flushPromises()
          const reopened = wrapper.getComponent(VOvForm)
          if (field === 'severity') {
            reopened.getComponent(VSelect).vm.$emit('update:modelValue', null)
          } else {
            await reopened.get('input[id="messageType"]').setValue('')
          }
          await wrapper
            .findAllComponents(VBtn)
            .find((button) => button.text() === messages['admin.apply'])!
            .trigger('click')
        } else {
          await wrapper.get('.v-chip__close').trigger('click')
        }
        await flushPromises()
        expect(get).toHaveBeenLastCalledWith(
          '/admin/users/user-1/audit',
          expect.objectContaining({
            query: expect.objectContaining({
              cursor: undefined,
              severity: undefined,
              messageType: undefined,
              from: undefined,
              to: undefined,
            }),
          }),
        )
        expect(wrapper.text()).toContain('Initial entry')
      } finally {
        wrapper.unmount()
        useUi().clear()
      }
    },
  )

  it('renders static user data and populated timestamps before opening Permissions', async () => {
    const user = {
      id: '5ff809b391110087e0630205590ae5a6',
      username: 'admin@odbvue.com',
      displayName: 'Administrator',
      enabled: true,
      createdAt: '2026-11-11T03:03:34.956221Z',
      updatedAt: '2026-11-11T03:03:34.956221Z',
    }
    get.mockResolvedValue({
      data: { items: [user] },
      error: null,
      status: 200,
      headers: null,
    })
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/users', component: {} },
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
            { path: 'audit', name: '/admin/users/[id]/audit', component: UserAudit },
            { path: 'emails', name: '/admin/users/[id]/emails', component: {} },
          ],
        },
      ],
    })
    await router.push(`/admin/users/${user.id}`)
    const wrapper = mount(
      { template: '<RouterView />' },
      {
        attachTo: document.body,
        global: {
          plugins: [
            router,
            createI18n({
              legacy: false,
              locale: 'en',
              messages: { en: messages },
              missing: () => {},
            }),
          ],
          stubs: { VIcon: true },
        },
      },
    )
    try {
      await flushPromises()
      const view = wrapper.findComponent(VOvView)
      expect(view.exists()).toBe(true)
      expect(wrapper.findComponent(VOvForm).exists()).toBe(false)
      expect(wrapper.get('h3').text()).toBe(user.username)
      const tabs = wrapper.findAllComponents(VTab)
      expect(tabs.map((tab) => tab.props('value'))).toEqual([
        'details',
        'permissions',
        'audit',
        'emails',
      ])
      expect(tabs[0]?.text()).toBe(messages['admin.details'])
      expect(tabs[1]?.attributes('href')).toBe(`/admin/users/${user.id}/permissions`)
      expect(tabs[1]?.attributes('disabled')).toBeUndefined()
      expect(view.text()).toContain(user.id)
      expect(view.text()).toContain(user.username)
      expect(view.text()).toContain(user.displayName)
      expect(view.text()).toContain(messages['admin.enabled'])
      const format = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' })
      for (const name of ['createdAt', 'updatedAt'] as const) {
        expect(view.text()).toContain(format.format(new Date(user[name])))
      }
      expect(get).toHaveBeenCalledTimes(1)
      expect(wrapper.find('input, textarea, select, form').exists()).toBe(false)
      expect(view.find('button').exists()).toBe(false)

      get.mockResolvedValueOnce({
        data: { items: [{ role: 'admin', validFrom: user.createdAt }] },
        error: null,
        status: 200,
        headers: null,
      })
      const permissionsNavigation = new Promise<void>((resolve) => {
        const remove = router.afterEach(() => {
          remove()
          resolve()
        })
      })
      await tabs[1]?.trigger('click', { button: 0 })
      await permissionsNavigation
      await flushPromises()
      expect(router.currentRoute.value.path).toBe(`/admin/users/${user.id}/permissions`)
      expect(tabs[1]?.attributes('aria-selected')).toBe('true')
      expect(get).toHaveBeenCalledWith(`/admin/users/${user.id}/roles`, expect.any(Object))
      const assigned = wrapper.getComponent(VOvTable)
      expect(assigned.props('options').stateKey).toBe(`admin.users.${user.id}.roles`)
      expect(assigned.find('h3').exists()).toBe(false)
      const remove = assigned
        .findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiMinus')
      expect(remove?.attributes('title')).toBe(messages['admin.removeRole'])
      expect(remove?.attributes('aria-label')).toBe(messages['admin.removeRole'])
      expect(get).toHaveBeenCalledTimes(2)

      const availableRequest = Promise.withResolvers<HttpResponse<unknown>>()
      get.mockReturnValueOnce(availableRequest.promise)
      const add = assigned
        .findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiPlus')
      expect(add?.attributes('title')).toBe(messages['admin.addRole'])
      expect(add?.attributes('aria-label')).toBe(messages['admin.addRole'])
      await add!.trigger('click')
      await flushPromises()
      expect(get).toHaveBeenLastCalledWith(
        `/admin/users/${user.id}/roles/available`,
        expect.any(Object),
      )
      expect(useUi().loading.active.value).toBe(true)
      availableRequest.resolve({
        data: null,
        error: Object.assign(new Error('Unavailable'), { status: 503, request: '/available' }),
        status: 503,
        headers: null,
      })
      await flushPromises()
      expect(useUi().loading.active.value).toBe(false)
      expect(document.body.querySelector('[role="dialog"] [role="alert"]')).toBeNull()
      expect(useUi().notification.value).toMatchObject({
        type: 'error',
        message: 'admin.loadRolesError',
      })

      const picker = wrapper.findAllComponents(VDialog).find((dialog) => dialog.props('modelValue'))
      expect(picker).toBeDefined()
      picker!.vm.$emit('update:modelValue', false)
      await flushPromises()
      picker!.vm.$emit('afterLeave')
      expect(document.activeElement).toBe(add!.element)

      get.mockResolvedValueOnce({
        data: { items: [{ role: 'editor', description: 'Can edit content' }] },
        error: null,
        status: 200,
        headers: null,
      })
      await add!.trigger('click')
      await flushPromises()
      expect(document.body.querySelector('[role="dialog"]')?.textContent).not.toContain(
        messages['admin.loadRolesError'],
      )
      const available = wrapper.findAllComponents(VOvTable)[1]
      expect(available).toBeDefined()
      expect(available!.props('options').stateKey).toBeUndefined()
      const assign = available
        ?.findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiPlus')
      expect(assign?.attributes('title')).toBe(messages['admin.addRole'])
      expect(assign?.attributes('aria-label')).toBe(messages['admin.addRole'])

      picker!.vm.$emit('update:modelValue', false)
      get.mockResolvedValueOnce({
        data: { items: [] },
        error: null,
        status: 200,
        headers: null,
      })
      const auditNavigation = new Promise<void>((resolve) => {
        const removeHook = router.afterEach(() => {
          removeHook()
          resolve()
        })
      })
      await tabs[2]!.trigger('click', { button: 0 })
      await auditNavigation
      await flushPromises()
      expect(tabs[2]?.attributes('aria-selected')).toBe('true')
      expect(get).toHaveBeenLastCalledWith(
        `/admin/users/${user.id}/audit`,
        expect.objectContaining({
          query: expect.objectContaining({ limit: 1 }),
        }),
      )
    } finally {
      wrapper.unmount()
      useUi().clear()
    }
  })
})
