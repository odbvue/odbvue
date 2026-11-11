import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, ref } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import Audit from '@/modules/sandbox/pages/capabilities/audit.vue'
import Storage from '@/modules/sandbox/pages/capabilities/storage.vue'

const authenticated = ref(true)
const get = vi.fn<(url: string) => Promise<{ data: unknown; error: Error | null }>>()
vi.mock('@/capabilities/auth', () => ({
  useAuth: () => ({ authenticated }),
}))
vi.mock('@/capabilities/http', () => ({
  useHttp: () => ({ get }),
}))

const slot = { template: '<div><slot /></div>' }
const button = defineComponent({
  props: ['disabled'],
  template: '<button :disabled="disabled"><slot /></button>',
})
const stubs = {
  VContainer: slot,
  VRow: slot,
  VCol: slot,
  VChip: slot,
  VTable: { template: '<table><slot /></table>' },
  VBtn: button,
  VTextField: true,
  VFileInput: true,
  VTooltip: { template: '<div><slot name="activator" :props="{}" /></div>' },
  VDialog: true,
  VAlert: true,
}

describe('sandbox camelCase service responses', () => {
  beforeEach(() => {
    vi.stubGlobal('definePage', vi.fn())
    authenticated.value = true
    get.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('renders audit timestamps, severity and attributes from the service response', async () => {
    const timestamp = '2026-11-11T02:20:28.268282Z'
    get.mockResolvedValue({
      data: {
        items: [
          {
            id: 'audit-id',
            observedTimestamp: timestamp,
            eventTimestamp: timestamp,
            severityText: 'WARN',
            body: 'Sandbox audit sample',
            attributes: '{"service.name":"myatp"}',
          },
        ],
      },
      error: null,
    })
    const wrapper = mount(Audit, { global: { stubs } })
    await wrapper
      .findAll('button')
      .find((candidate) => candidate.text() === 'Load')!
      .trigger('click')
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/sandbox/audit?limit=51')
    const cells = wrapper.get('tbody tr').findAll('td')
    expect(cells[0]!.text()).toBe(new Date(timestamp).toLocaleString())
    expect(cells[1]!.text()).toBe('WARN')
    expect(cells[2]!.text()).toBe('Sandbox audit sample')
    expect(cells[3]!.text()).toContain('"service.name": "myatp"')
    wrapper.unmount()
  })

  it('renders storage metadata directly and preserves keyset pagination', async () => {
    const timestamp = '2026-11-11T02:20:28Z'
    get
      .mockResolvedValueOnce({
        data: {
          items: Array.from({ length: 51 }, (_, index) => ({
            id: `file-${index}`,
            fileName: `report-${index}.pdf`,
            mimeType: 'application/pdf',
            fileSize: 2048,
            createdAt: timestamp,
            meta: {},
          })),
        },
        error: null,
      })
      .mockResolvedValueOnce({ data: { items: [] }, error: null })
    const wrapper = mount(Storage, { global: { stubs } })
    await flushPromises()
    expect(get).toHaveBeenCalledWith('/sandbox/storage?limit=51')
    expect(wrapper.findAll('tbody tr')).toHaveLength(50)
    const cells = wrapper.get('tbody tr').findAll('td')
    expect(cells[0]!.text()).toBe('report-0.pdf')
    expect(cells[1]!.text()).toBe('application/pdf')
    expect(cells[2]!.text()).toBe('2.0 KiB')
    expect(cells[3]!.text()).toBe(new Date(timestamp).toLocaleString())
    await wrapper
      .findAll('button')
      .find((candidate) => candidate.text() === 'Next')!
      .trigger('click')
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/sandbox/storage?limit=51&cursor=file-49')
    expect(wrapper.text()).toContain('No files.')
    wrapper.unmount()
  })
})
