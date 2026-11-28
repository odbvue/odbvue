import { afterEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { VBtn, VExpansionPanelTitle, VList } from 'vuetify/components'
import VOvJson from '@/components/data/VOvJson.vue'
import JsonNodeView from '@/components/data/JsonNodeView.vue'
import { createJsonNode, getJsonRecordTable } from '@/components/data/json'
import en from '@/app/i18n/en.json'
import de from '@/app/i18n/de.json'
import fr from '@/app/i18n/fr.json'

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')

afterEach(() => {
  if (clipboardDescriptor) Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
  else Reflect.deleteProperty(navigator, 'clipboard')
})

function mountJson(props: { data?: unknown; loading?: boolean; error?: string }, locale = 'en') {
  return mount(VOvJson, {
    props,
    global: {
      plugins: [createI18n({ legacy: false, locale, messages: { en, de, fr } })],
    },
  })
}

function clipboard(writeText?: (text: string) => Promise<void>) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  })
}

describe('VOvJson', () => {
  it('renders objects and nested mixed arrays as readable sections and keeps raw JSON unchanged', async () => {
    const data = {
      'home.title': 'Literal key',
      addresses: [{ city: 'Paris', enabled: false }, null, []],
      empty: {},
      html: '<img src=x onerror=alert(1)>',
    }
    const wrapper = mountJson({ data })
    try {
      await flushPromises()
      expect(wrapper.text()).toContain('home.title')
      expect(wrapper.get('.ov-json-fields th').text()).toBe('home.title')
      expect(wrapper.find('img').exists()).toBe(false)
      expect(wrapper.text()).toContain('{}')
      expect(
        wrapper.findAllComponents(VExpansionPanelTitle).map((title) => title.text()),
      ).toContain('addresses 3 items')
      expect(
        wrapper.findAllComponents(VExpansionPanelTitle).map((title) => title.text()),
      ).toContain('[0] 2 fields')
      expect(wrapper.text()).toContain('city')
      expect(wrapper.text()).toContain('Paris')
      expect(wrapper.text()).toContain(en['json.false'])
      expect(wrapper.text()).toContain('null')
      expect(wrapper.text()).toContain('[]')
      await wrapper
        .findAllComponents(VBtn)
        .find((button) => button.props('value') === 'raw')!
        .trigger('click')
      expect(wrapper.get('pre').text()).toBe(JSON.stringify(data, null, 2))
    } finally {
      wrapper.unmount()
    }
  })

  it.each([null, false, 0, '', 'plain text', [], {}])('displays a root JSON value: %j', (data) => {
    const wrapper = mountJson({ data })
    try {
      expect(wrapper.findComponent(JsonNodeView).exists()).toBe(true)
      const expected =
        data === false
          ? en['json.false']
          : data === ''
            ? '""'
            : typeof data === 'string'
              ? data
              : JSON.stringify(data)
      expect(wrapper.text()).toContain(expected)
    } finally {
      wrapper.unmount()
    }
  })

  it('prioritizes loading and errors over stale data, and distinguishes absent data from null', async () => {
    const wrapper = mountJson({
      data: { stale: true },
      loading: true,
      error: 'errors.requestFailed',
    })
    try {
      expect(wrapper.get('[role="progressbar"]').attributes('aria-label')).toBe(en['json.loading'])
      expect(wrapper.findComponent(JsonNodeView).exists()).toBe(false)
      await wrapper.setProps({ loading: false })
      expect(wrapper.text()).toBe(en['errors.requestFailed'])
      await wrapper.setProps({ error: 'A specific failure' })
      expect(wrapper.text()).toBe('A specific failure')
      await wrapper.setProps({ error: undefined, data: undefined })
      expect(wrapper.text()).toBe(en['json.empty'])
      await wrapper.setProps({ data: null })
      expect(wrapper.text()).toContain('null')
    } finally {
      wrapper.unmount()
    }
  })

  it('copies all branches, reports success, and clears feedback when data changes', async () => {
    const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue()
    clipboard(writeText)
    const data = { nested: { secret: 'value' } }
    const wrapper = mountJson({ data })
    try {
      await wrapper
        .findAllComponents(VBtn)
        .find((button) => button.text() === en['copy.to.clipboard'])!
        .trigger('click')
      await flushPromises()
      expect(writeText).toHaveBeenCalledExactlyOnceWith(JSON.stringify(data, null, 2))
      expect(wrapper.get('[role="status"]').text()).toBe(en['json.copied'])
      await wrapper.setProps({ data: { next: true } })
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
      expect(wrapper.text()).toContain('next')
    } finally {
      wrapper.unmount()
    }
  })

  it.each(['unavailable', 'rejected'])('reports a clipboard failure: %s', async (failure) => {
    clipboard(
      failure === 'rejected'
        ? vi.fn<(text: string) => Promise<void>>().mockRejectedValue(new Error('Denied'))
        : undefined,
    )
    const wrapper = mountJson({ data: { ok: true } })
    try {
      await wrapper
        .findAllComponents(VBtn)
        .find((button) => button.text() === en['copy.to.clipboard'])!
        .trigger('click')
      await flushPromises()
      expect(wrapper.get('[role="alert"]').text()).toContain(en['json.copyError'])
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('does not report stale copy results after the input changes', async () => {
    const pending = Promise.withResolvers<void>()
    clipboard(() => pending.promise)
    const wrapper = mountJson({ data: { first: true } })
    try {
      await wrapper
        .findAllComponents(VBtn)
        .find((button) => button.text() === en['copy.to.clipboard'])!
        .trigger('click')
      await wrapper.setProps({ data: { second: true } })
      pending.resolve()
      await flushPromises()
      expect(wrapper.find('[role="status"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it.each([en, de, fr])('translates controls but never property names', (messages) => {
    const locale = messages === de ? 'de' : messages === fr ? 'fr' : 'en'
    const wrapper = mountJson({ data: { 'home.title': 1 } }, locale)
    try {
      expect(wrapper.text()).toContain(messages['json.formatted'])
      expect(wrapper.text()).toContain(messages['json.raw'])
      expect(wrapper.text()).toContain(messages['copy.to.clipboard'])
      expect(wrapper.text()).toContain('home.title')
    } finally {
      wrapper.unmount()
    }
  })

  it('shows an explicit error for invalid input and recovers when valid data arrives', async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    const wrapper = mountJson({ data: circular })
    try {
      expect(wrapper.get('[role="alert"]').text()).toContain(en['json.invalid'])
      expect(wrapper.findComponent(JsonNodeView).exists()).toBe(false)
      await wrapper.setProps({ data: { valid: true } })
      expect(wrapper.text()).toContain('valid')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('infers record columns by exact keys and displays every record without paging on desktop and mobile', async () => {
    const originalWidth = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1440 })
    window.dispatchEvent(new Event('resize'))
    await flushPromises()
    const data = Array.from({ length: 16 }, (_, index) => ({
      'user.name': `Person ${index}`,
      enabled: index % 2 === 0,
      note: index === 0 ? null : 'First line\nSecond line',
    }))
    const wrapper = mountJson({ data })
    try {
      expect(wrapper.get('.ov-json-records thead').text()).toContain('user.name')
      expect(wrapper.get('.ov-json-records tbody').text()).toContain('Person 0')
      expect(wrapper.get('.ov-json-records tbody').text()).toContain('Person 15')
      expect(wrapper.findAll('.ov-json-records tbody tr')).toHaveLength(16)
      expect(wrapper.find('[aria-label="Pagination Navigation"]').exists()).toBe(false)
      expect(wrapper.get('.ov-json-records tbody').text()).toContain(en['json.true'])
      expect(wrapper.get('.ov-json-records tbody').text()).toContain('null')
      expect(wrapper.get('.ov-json-records pre').text()).toBe('First line\nSecond line')
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 })
      window.dispatchEvent(new Event('resize'))
      await flushPromises()
      expect(wrapper.findAll('.ov-json-records tbody tr')).toHaveLength(16)
      expect(wrapper.find('[aria-label="Pagination Navigation"]').exists()).toBe(false)
    } finally {
      wrapper.unmount()
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
      window.dispatchEvent(new Event('resize'))
    }
  })

  it('uses compact primitive lists, preserves multiline text, and collapses deep sections until opened', async () => {
    const wrapper = mountJson({
      data: {
        tags: ['alpha', 2, true, null],
        notes: 'First line\n  Second line',
        delivery: { details: { history: { attempts: 3 } } },
      },
    })
    try {
      await flushPromises()
      expect(wrapper.getComponent(VList).text()).toContain('alpha')
      expect(wrapper.getComponent(VList).text()).toContain(en['json.true'])
      expect(wrapper.get('pre').text()).toBe('First line\n  Second line')
      expect(wrapper.text()).not.toContain('attempts')
      const history = wrapper
        .findAllComponents(VExpansionPanelTitle)
        .find((title) => title.text().startsWith('history'))!
      await history.trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('attempts')
      await wrapper.setProps({ data: { delivery: { details: { history: { attempts: 9 } } } } })
      expect(wrapper.text()).not.toContain('attempts')
    } finally {
      wrapper.unmount()
    }
  })
})

describe('JSON node conversion', () => {
  it('uses collision-free IDs and permits repeated objects that are not circular', () => {
    const shared = { value: 1 }
    const root = createJsonNode({ 'a.b': shared, a: { b: shared }, '': null })
    expect(root.children?.[0]?.id).not.toBe(root.children?.[1]?.children?.[0]?.id)
    expect(root.children?.[2]?.key).toBe('')
    expect(root.children?.[0]?.children?.[0]?.display).toBe('1')
  })

  it.each([NaN, Infinity, 1n, { missing: undefined }, [undefined], new Date(), new Map(), () => 1])(
    'rejects values that JSON would lose or alter: %s',
    (data) => expect(() => createJsonNode(data)).toThrow(TypeError),
  )

  it('matches flat records with reordered keys, but falls back for heterogeneous or nested records', () => {
    const records = createJsonNode([
      { a: 1, b: 'first' },
      { b: null, a: 2 },
    ])
    expect(getJsonRecordTable(records)?.rows[1]?.cells.map((cell) => cell.display)).toEqual([
      '2',
      'null',
    ])
    expect(getJsonRecordTable(createJsonNode([{ a: 1 }, { b: 2 }]))).toBeUndefined()
    expect(getJsonRecordTable(createJsonNode([{ a: { nested: 1 } }]))).toBeUndefined()
    expect(getJsonRecordTable(createJsonNode([{}, {}]))).toBeUndefined()
  })
})
