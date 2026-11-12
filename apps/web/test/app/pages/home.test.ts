import { afterEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import Home from '@/app/pages/index.vue'

const pages = ref([
  {
    path: '/admin',
    title: 'admin.title',
    level: 0,
    meta: { description: 'admin.description' },
  },
  { path: '/sandbox', title: 'Sandbox', level: 0, meta: { description: 'Developer tools' } },
])
vi.mock('@/capabilities/routing', () => ({
  useRouting: () => ({ pages }),
}))
vi.mock('@/capabilities/ui', () => ({
  useCardBackground: () => ref({}),
}))

afterEach(() => vi.unstubAllGlobals())

describe('home navigation cards', () => {
  it('translates registered titles and descriptions reactively while preserving literal text', async () => {
    vi.stubGlobal('definePage', vi.fn<() => void>())
    const localization = createI18n({
      legacy: false,
      locale: 'en',
      messages: {
        en: { 'admin.title': 'Admin', 'admin.description': 'Manage the application' },
        de: { 'admin.title': 'Administration', 'admin.description': 'Anwendung verwalten' },
      },
    })
    const wrapper = mount(Home, {
      global: {
        plugins: [localization],
        stubs: {
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: {
            props: ['title', 'text', 'to'],
            template: '<a :href="to">{{ title }} {{ text }}</a>',
          },
        },
      },
    })
    try {
      expect(wrapper.findAll('a').map((card) => card.text())).toEqual([
        'Admin Manage the application',
        'Sandbox Developer tools',
      ])
      expect(wrapper.get('a').attributes('href')).toBe('/admin')
      localization.global.locale.value = 'de'
      await wrapper.vm.$nextTick()
      expect(wrapper.findAll('a').map((card) => card.text())).toEqual([
        'Administration Anwendung verwalten',
        'Sandbox Developer tools',
      ])
    } finally {
      wrapper.unmount()
    }
  })
})
