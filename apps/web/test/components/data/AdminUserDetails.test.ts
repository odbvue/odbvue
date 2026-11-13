import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { VTab } from 'vuetify/components'
import type { HttpClient } from '@/capabilities/http'
import UserDetails from '@/modules/admin/pages/users/[id].vue'
import VOvForm from '@/components/forms/VOvForm.vue'
import VOvView from '@/components/data/VOvView.vue'
import { globalPlugins } from '../../support/components.setup'

const { get } = vi.hoisted(() => ({ get: vi.fn<HttpClient['get']>() }))
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
  it('renders static user data and populated timestamps inside one Details tab', async () => {
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
      global: { plugins: [router, ...globalPlugins], stubs: { VIcon: true } },
    })
    try {
      await flushPromises()
      const view = wrapper.findComponent(VOvView)
      expect(view.exists()).toBe(true)
      expect(wrapper.findComponent(VOvForm).exists()).toBe(false)
      expect(wrapper.get('h3').text()).toBe(user.username)
      expect(wrapper.findAllComponents(VTab)).toHaveLength(1)
      expect(wrapper.findComponent(VTab).props('value')).toBe('details')
      expect(wrapper.findComponent(VTab).text()).toBe('admin.details')
      expect(view.text()).toContain(user.id)
      expect(view.text()).toContain(user.username)
      expect(view.text()).toContain(user.displayName)
      expect(view.text()).toContain('admin.enabled')
      const format = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'medium' })
      for (const name of ['createdAt', 'updatedAt'] as const) {
        expect(view.text()).toContain(format.format(new Date(user[name])))
      }
      expect(get).toHaveBeenCalledTimes(1)
      expect(wrapper.find('input, textarea, select, form').exists()).toBe(false)
      expect(view.find('button').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })
})
