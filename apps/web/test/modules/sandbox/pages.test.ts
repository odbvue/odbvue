import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { odbVueCapabilities } from '@/modules/sandbox/catalog'
import Sandbox from '@/modules/sandbox/pages/index.vue'
import en from '@/modules/sandbox/i18n/en.json'
import de from '@/modules/sandbox/i18n/de.json'
import fr from '@/modules/sandbox/i18n/fr.json'

vi.mock('@/capabilities/routing', () => ({
  useRouting: () => ({ allPages: ref([]) }),
}))

afterEach(() => vi.unstubAllGlobals())

const pages = import.meta.glob<string>('@/modules/sandbox/pages/**/*.vue', {
  eager: true,
  query: '?raw',
  import: 'default',
})

describe('sandbox page metadata', () => {
  it('discovers sandbox pages', () => {
    expect(Object.keys(pages).length).toBeGreaterThan(0)
  })

  it('registers Network ACL in the catalog with its dedicated page', () => {
    expect(odbVueCapabilities.find((capability) => capability.name === 'acl')).toMatchObject({
      kind: 'infrastructure',
      title: 'Network ACL',
      icon: '$mdiShieldLock',
    })
    expect(Object.keys(pages).some((path) => path.endsWith('/capabilities/acl.vue'))).toBe(true)
  })

  it.each([
    ['en', en],
    ['de', de],
    ['fr', fr],
  ] as const)('shows a translated Scheduler card linking to its page in %s', (locale, messages) => {
    vi.stubGlobal('definePage', vi.fn())
    const card = defineComponent({
      props: ['to', 'title', 'text'],
      template: '<a :href="to">{{ title }} {{ text }}</a>',
    })
    const wrapper = mount(Sandbox, {
      global: {
        plugins: [createI18n({ legacy: false, locale, messages: { [locale]: messages } })],
        stubs: {
          VContainer: { template: '<div><slot /></div>' },
          VRow: { template: '<div><slot /></div>' },
          VCol: { template: '<div><slot /></div>' },
          VCard: card,
        },
      },
    })
    const link = wrapper.get('a[href="/sandbox/capabilities/scheduler"]')
    expect(link.text()).toContain(messages['sandbox.scheduler'])
    expect(link.text()).toContain(messages['sandbox.schedulerDescription'])
    expect(Object.keys(pages).some((path) => path.endsWith('/capabilities/scheduler.vue'))).toBe(
      true,
    )
    wrapper.unmount()
  })

  it.each(Object.entries(pages))('restricts %s to administrators', (_path, source) => {
    const metadata = source.match(/definePage\(\{\s*meta:\s*\{([\s\S]*?)\n\s*\},?\s*\}\)/)?.[1]
    expect(metadata).toBeDefined()
    expect(metadata).not.toMatch(/\b(?:roles|visibility|hidden):/)
    expect(metadata).toMatch(/\baccess:\s*\[\s*'admin'\s*\]/)
    expect(metadata).toMatch(/\bnavigation:\s*true/)
  })
})
