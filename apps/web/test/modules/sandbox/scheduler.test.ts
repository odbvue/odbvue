import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import Scheduler from '@/modules/sandbox/pages/capabilities/scheduler.vue'
import messages from '@/modules/sandbox/i18n/en.json'
import type { HttpClient } from '@/capabilities/http'
import type { OvTableFetchRequest } from '@/components/api'

const { get, post, success, error } = vi.hoisted(() => ({
  get: vi.fn<HttpClient['get']>(),
  post: vi.fn<HttpClient['post']>(),
  success: vi.fn<(message: string) => void>(),
  error: vi.fn<(failure: unknown) => void>(),
}))
vi.mock('@/capabilities/http', () => ({ useHttp: () => ({ get, post }) }))
vi.mock('@/capabilities/ui', () => ({
  useUi: () => ({
    success,
    action: async (_key: string, run: () => Promise<unknown>) => {
      try {
        return { ok: true, data: await run() }
      } catch (failure) {
        error(failure)
        return { ok: false }
      }
    },
  }),
}))

const fetch = vi.fn<(page: string) => Promise<boolean>>()
const table = defineComponent({
  props: ['options', 'title'],
  emits: ['fetch'],
  setup(_props, { expose }) {
    expose({ fetch })
  },
  template: '<div />',
})
const wrappers: ReturnType<typeof mount>[] = []
const response = (enabled: string) => ({
  data: { enabled, state: enabled === 'TRUE' ? 'SCHEDULED' : 'DISABLED' },
  error: null,
  status: 200,
  headers: null,
})

async function setup() {
  const wrapper = mount(Scheduler, {
    global: {
      plugins: [createI18n({ legacy: false, locale: 'en', messages: { en: messages } })],
      stubs: {
        VContainer: { template: '<div><slot /></div>' },
        VChip: { template: '<span><slot /></span>' },
        VBtn: { props: ['disabled'], template: '<button :disabled="disabled"><slot /></button>' },
        VOvTable: table,
      },
    },
  })
  wrappers.push(wrapper)
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.stubGlobal('definePage', vi.fn())
  get.mockReset().mockResolvedValue(response('FALSE'))
  post.mockReset().mockResolvedValue({ data: null, error: null, status: 204, headers: null })
  fetch.mockReset().mockResolvedValue(true)
  success.mockReset()
  error.mockReset()
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.unstubAllGlobals()
})

describe('sandbox Scheduler', () => {
  it('loads status and refreshes status and audit after starting or stopping', async () => {
    const wrapper = await setup()
    expect(get).toHaveBeenCalledWith('/sandbox/scheduler')
    expect(wrapper.text()).toContain('Disabled')
    const [start, stop] = wrapper.findAll('button')
    expect(start!.attributes('disabled')).toBeUndefined()
    expect(stop!.attributes('disabled')).toBeDefined()
    get.mockResolvedValueOnce(response('TRUE'))
    await start!.trigger('click')
    await flushPromises()
    expect(post).toHaveBeenLastCalledWith('/sandbox/scheduler/enable')
    expect(wrapper.text()).toContain('Enabled')
    expect(fetch).toHaveBeenCalledWith('first')
    get.mockResolvedValueOnce(response('FALSE'))
    await stop!.trigger('click')
    await flushPromises()
    expect(post).toHaveBeenLastCalledWith('/sandbox/scheduler/disable')
    expect(wrapper.text()).toContain('Disabled')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('forwards the audit cursor and page unchanged', async () => {
    const wrapper = await setup()
    const page = { items: [], nextCursor: 'opaque-next' }
    get.mockResolvedValueOnce({ data: page, error: null, status: 200, headers: null })
    const { signal } = new AbortController()
    const complete = vi.fn<OvTableFetchRequest['complete']>()
    wrapper.findComponent(table).vm.$emit('fetch', {
      cursor: 'opaque-cursor',
      limit: 5,
      signal,
      complete,
    })
    await flushPromises()
    expect(get).toHaveBeenLastCalledWith('/sandbox/scheduler/audit', {
      query: { cursor: 'opaque-cursor', limit: 5 },
      signal,
    })
    expect(complete).toHaveBeenCalledExactlyOnceWith(page)
  })

  it('keeps unavailable status distinct from disabled and does not refresh failed writes', async () => {
    get.mockRejectedValueOnce(new Error('Offline'))
    const wrapper = await setup()
    expect(wrapper.text()).toContain('Status unavailable')
    expect(wrapper.findAll('button')[0]!.attributes('disabled')).toBeDefined()
    await wrapper.findAll('button')[2]!.trigger('click')
    await flushPromises()
    fetch.mockClear()
    get.mockClear()
    post.mockResolvedValueOnce({
      data: null,
      error: Object.assign(new Error('Failed'), {
        status: 500,
        request: '/sandbox/scheduler/enable',
      }),
      status: 500,
      headers: null,
    })
    await wrapper.findAll('button')[0]!.trigger('click')
    await flushPromises()
    expect(error).toHaveBeenCalled()
    expect(success).not.toHaveBeenCalled()
    expect(get).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Disabled')
  })
})
