import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { VBtn, VDialog, VTab } from 'vuetify/components'
import type { HttpClient, HttpResponse } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import UserDetails from '@/modules/admin/pages/users/[id].vue'
import VOvForm from '@/components/forms/VOvForm.vue'
import VOvView from '@/components/data/VOvView.vue'
import VOvTable from '@/components/data/VOvTable.vue'
import messages from '@/modules/admin/i18n/en.json'

const { get } = vi.hoisted(() => ({ get: vi.fn<HttpClient['get']>() }))
vi.mock('@/capabilities/client', () => ({ http: { get } }))
vi.mock('@/capabilities/http', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/capabilities/http')>()),
  useHttp: () => ({ get }),
}))
vi.mock('@/capabilities/auth', () => ({
  useAuth: () => ({ user: { value: { id: 'another-admin' } } }),
}))

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('admin user details view', () => {
  it('renders static user data and populated timestamps before opening Permissions', async () => {
    vi.stubGlobal('definePage', vi.fn<() => void>())
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
        { path: '/admin/users/:id', component: UserDetails },
      ],
    })
    await router.push(`/admin/users/${user.id}`)
    const wrapper = mount(UserDetails, {
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
    })
    try {
      await flushPromises()
      const view = wrapper.findComponent(VOvView)
      expect(view.exists()).toBe(true)
      expect(wrapper.findComponent(VOvForm).exists()).toBe(false)
      expect(wrapper.get('h3').text()).toBe(user.username)
      const tabs = wrapper.findAllComponents(VTab)
      expect(tabs.map((tab) => tab.props('value'))).toEqual(['details', 'permissions'])
      expect(tabs[0]?.text()).toBe(messages['admin.details'])
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
      await tabs[1]?.trigger('click')
      await flushPromises()
      expect(get).toHaveBeenCalledWith(`/admin/users/${user.id}/roles`, expect.any(Object))
      const assigned = wrapper.getComponent(VOvTable)
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
      const assign = available
        ?.findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiPlus')
      expect(assign?.attributes('title')).toBe(messages['admin.addRole'])
      expect(assign?.attributes('aria-label')).toBe(messages['admin.addRole'])
    } finally {
      wrapper.unmount()
      useUi().clear()
    }
  })
})
