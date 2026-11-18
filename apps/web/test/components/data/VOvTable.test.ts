import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { VBtn, VTextField } from 'vuetify/components'
import VOvForm from '@/components/forms/VOvForm.vue'
import VOvTable from '@/components/data/VOvTable.vue'
import { globalPlugins } from '../../support/components.setup'
import type {
  OvFormSelectionField,
  OvTableOptions,
  OvTableData,
  OvTableFetchRequest,
  OvTablePage,
} from '@/components'
import type { HttpResponse } from '@/capabilities/http/core'
import { useUi } from '@/capabilities/ui'
import { createState } from '@/capabilities/state'

function mountTable(options: OvTableOptions, items: OvTableData[] = []) {
  return mount(VOvTable, {
    props: { options, items },
    global: { plugins: globalPlugins },
  })
}

const sampleData: OvTableData[] = [
  { name: 'Alice', email: 'alice@test.com', status: 'active' },
  { name: 'Bob', email: 'bob@test.com', status: 'blocked' },
  { name: 'Charlie', email: 'charlie@test.com', status: 'active' },
]

const baseOptions: OvTableOptions = {
  key: 'name',
  columns: [{ name: 'name' }, { name: 'email' }, { name: 'status' }],
  itemsPerPage: 10,
  mobileItemsPerPage: 10,
}

type PageResponse = HttpResponse<{ items: OvTableData[]; nextCursor?: string }>
const cursorPage = (name: string, nextCursor?: string): PageResponse => ({
  data: { items: [{ name }], nextCursor },
  error: null,
  status: 200,
  headers: null,
})

async function mountCursorTable() {
  const fetch = vi.fn<(request: Omit<OvTableFetchRequest, 'complete'>) => Promise<PageResponse>>()
  fetch.mockResolvedValueOnce(cursorPage('Alice', 'after-alice'))
  const ui = useUi(createState())
  const wrapper = mount(VOvTable, {
    props: {
      options: { ...baseOptions, search: {} },
      onFetch: async ({ complete, ...request }: OvTableFetchRequest) => {
        const result = await ui.action('test.table', async () => {
          const response = await fetch(request)
          if (request.signal.aborted) return
          if (response.error) throw response.error
          if (!response.data) throw new Error('Missing page')
          return response.data
        })
        complete(result.ok ? result.data : undefined)
      },
    },
    global: { plugins: globalPlugins },
  })
  await flushPromises()
  const table = wrapper
  const button = (icon: string) =>
    table.findAllComponents(VBtn).find((btn) => btn.props('icon') === icon)!
  return { wrapper, table, fetch, button }
}

function mountManagedTable(options: OvTableOptions = baseOptions) {
  const onFetch = vi.fn<(request: OvTableFetchRequest) => void>()
  const wrapper = mount(VOvTable, {
    props: { options, onFetch },
    global: { plugins: globalPlugins },
  })
  const request = () => onFetch.mock.lastCall![0]
  return { wrapper, onFetch, request }
}

describe('VOvTable', () => {
  it.each([true, false])('converts only opt-in date filters (enabled: %s)', (enabled) => {
    const start = '2026-11-01T10:00'
    const { wrapper, request } = mountManagedTable({
      ...baseOptions,
      filter: {
        fields: [
          { type: 'datetime', name: 'start', value: start, filterUtc: enabled },
          { type: 'datetime', name: 'end', filterUtc: enabled, value: '' },
          { type: 'datetime', name: 'other', value: start },
        ],
      },
    })
    try {
      expect(request().filter).toEqual({
        start: [enabled ? new Date(start).toISOString() : start],
        other: [start],
        ...(enabled ? {} : { end: [''] }),
      })
      expect(wrapper.text()).toContain('2026-11-01 10:00')
      expect(wrapper.text()).not.toContain(new Date(start).toISOString())
    } finally {
      wrapper.unmount()
    }
  })

  it('keeps the filter dialog open for invalid ranges, then fetches after correction', async () => {
    const onFetch = vi.fn<(request: OvTableFetchRequest) => void>(({ complete }) =>
      complete({ items: [] }),
    )
    const wrapper = mount(VOvTable, {
      props: {
        options: {
          ...baseOptions,
          filter: {
            fields: [
              {
                type: 'datetime',
                name: 'start',
                filterUtc: true,
                rules: [{ type: 'date', params: undefined, message: 'Invalid date' }],
              },
              {
                type: 'datetime',
                name: 'end',
                filterUtc: true,
                rules: [
                  { type: 'date', params: undefined, message: 'Invalid date' },
                  { type: 'date-on-or-after', params: 'start', message: 'Invalid range' },
                ],
              },
            ],
          },
        },
        onFetch,
      },
      global: {
        plugins: globalPlugins,
        stubs: {
          VDialog: { props: ['modelValue'], template: '<div v-if="modelValue"><slot /></div>' },
        },
      },
    })
    try {
      const filterButton = wrapper
        .findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiFilterPlus')!
      await filterButton.trigger('click')
      const form = wrapper.getComponent(VOvForm)
      const start = '2026-11-01T10:00'
      const end = '2026-11-18T12:00'
      const startField = form
        .findAllComponents(VTextField)
        .find((field) => field.props('id') === 'start')!
      startField.vm.$emit('update:modelValue', 'invalid-date')
      await flushPromises()
      await form.vm.handleAction('apply')
      expect(wrapper.get('#start-messages').text()).toBe('Invalid date')
      expect(onFetch).toHaveBeenCalledTimes(1)

      await form.get('input#start').setValue(end)
      await form.get('input#end').setValue(start)
      await form.vm.handleAction('apply')
      expect(wrapper.get('#end-messages').text()).toBe('Invalid range')
      expect(wrapper.find('#start-messages .v-messages__message').exists()).toBe(false)
      expect(onFetch).toHaveBeenCalledTimes(1)

      await form.get('input#start').setValue(start)
      await form.get('input#end').setValue(end)
      await form.vm.handleAction('apply')
      await flushPromises()
      expect(onFetch).toHaveBeenCalledTimes(2)
      expect(onFetch.mock.lastCall?.[0].filter).toEqual({
        start: [new Date(start).toISOString()],
        end: [new Date(end).toISOString()],
      })
      expect(wrapper.findComponent(VOvForm).exists()).toBe(false)
    } finally {
      wrapper.unmount()
    }
  })

  it('passes async autocomplete to the filter dialog and uses the selected label on its chip', async () => {
    const fetchItems = vi
      .fn<NonNullable<OvFormSelectionField['fetchItems']>>()
      .mockResolvedValue([{ title: 'Ada (ada@example.test)', value: 'ada-id' }])
    const wrapper = mount(VOvTable, {
      props: {
        items: sampleData,
        options: {
          ...baseOptions,
          filter: {
            fields: [
              {
                type: 'autocomplete',
                name: 'userId',
                value: 'ada-id',
                items: [{ title: 'Ada (ada@example.test)', value: 'ada-id' }],
                fetchItems,
              },
            ],
          },
        },
      },
      global: {
        plugins: globalPlugins,
        stubs: { VDialog: { template: '<div><slot /></div>' } },
      },
    })
    try {
      expect(wrapper.text()).toContain('Ada (ada@example.test)')
      expect(wrapper.text()).not.toContain('ada-id')
      const filterButton = wrapper
        .findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiFilterPlus')!
      await filterButton.trigger('click')
      expect(wrapper.getComponent(VOvForm).props('options').fields[0]).toMatchObject({ fetchItems })
    } finally {
      wrapper.unmount()
    }
  })

  it.each([
    { width: 1440, limit: 5 },
    { width: 480, limit: 1 },
  ])('requests $limit rows by default at viewport width $width', ({ width, limit }) => {
    const originalWidth = window.innerWidth
    window.innerWidth = width
    window.dispatchEvent(new Event('resize'))
    const { wrapper, request } = mountManagedTable({ key: 'name', columns: [{ name: 'name' }] })
    try {
      expect(request().limit).toBe(limit)
    } finally {
      wrapper.unmount()
      window.innerWidth = originalWidth
      window.dispatchEvent(new Event('resize'))
    }
  })

  it('formats raw timestamp columns through the shared renderer', () => {
    const timestamp = '2026-11-11T03:03:34.956221Z'
    const wrapper = mountTable(
      {
        key: 'id',
        columns: [{ name: 'createdAt', format: { tsFormat: 'datetime' } }],
        itemsPerPage: 5,
        mobileItemsPerPage: 5,
      },
      [{ id: 'one', createdAt: timestamp }],
    )
    try {
      expect(wrapper.text()).toContain(
        new Intl.DateTimeFormat('en', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        }).format(new Date(timestamp)),
      )
    } finally {
      wrapper.unmount()
    }
  })

  describe('VOvTable cursor navigation', () => {
    it('still accepts externally supplied rows and continuation overrides', async () => {
      const { wrapper, request } = mountManagedTable()
      try {
        request().complete({ items: [{ name: 'Fetched' }] })
        await wrapper.setProps({
          items: [{ name: 'External' }],
          nextCursor: 'external-cursor',
        })
        expect(wrapper.text()).toContain('External')
        expect(wrapper.text()).not.toContain('Fetched')
        const next = wrapper.vm.fetch('next')
        expect(request().cursor).toBe('external-cursor')
        request().complete()
        expect(await next).toBe(false)
        expect(wrapper.text()).toContain('External')
      } finally {
        wrapper.unmount()
      }
    })

    it('owns page data and continuation and ignores duplicate completions', async () => {
      const { wrapper, request } = mountManagedTable()
      try {
        const first = request()
        first.complete({ items: [{ name: 'Alice' }], nextCursor: 'opaque' })
        first.complete({ items: [{ name: 'Duplicate' }] })
        await flushPromises()
        expect(wrapper.text()).toContain('Alice')
        expect(wrapper.text()).not.toContain('Duplicate')
        const next = wrapper.vm.fetch('next')
        expect(request().cursor).toBe('opaque')
        request().complete({ items: [{ name: 'Bob' }] })
        expect(await next).toBe(true)
        await flushPromises()
        expect(wrapper.text()).toContain('Bob')
        expect(wrapper.text()).not.toContain('Alice')
        expect(await wrapper.vm.fetch('next')).toBe(false)
      } finally {
        wrapper.unmount()
      }
    })

    it('normalizes search and ignores late completions after supersession or unmount', async () => {
      const { wrapper, request } = mountManagedTable({ ...baseOptions, search: {} })
      const initial = request()
      const latest = wrapper.vm.fetch('first')
      expect(initial.signal.aborted).toBe(true)
      initial.complete({ items: [{ name: 'Stale' }] })
      request().complete({ items: [{ name: 'Current' }] })
      expect(await latest).toBe(true)
      await wrapper.find('input').setValue('  ada  ')
      await wrapper.find('input').trigger('keydown', { key: 'Enter' })
      expect(request().search).toBe('ada')
      const pending = request()
      wrapper.unmount()
      expect(pending.signal.aborted).toBe(true)
      pending.complete({ items: [{ name: 'Late' }] })
      expect(await wrapper.vm.fetch()).toBe(false)
    })

    it.each([
      { items: Array.from({ length: 11 }, () => ({ name: 'Overflow' })) },
      { items: [{ name: 'Invalid' }], nextCursor: '' },
      { items: [{ name: 'Invalid' }], nextCursor: '   ' },
      { items: [], nextCursor: 'opaque' },
    ] satisfies OvTablePage[])('rejects invalid pages without publishing rows', async (page) => {
      const report = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { wrapper, request } = mountManagedTable()
      try {
        request().complete({ items: [{ name: 'Alice' }], nextCursor: 'opaque' })
        const next = wrapper.vm.fetch('next')
        request().complete(page)
        expect(await next).toBe(false)
        await flushPromises()
        expect(report).toHaveBeenCalledWith('Invalid table page response', page)
        expect(wrapper.text()).toContain('Alice')
        const retry = wrapper.vm.fetch('next')
        expect(request().cursor).toBe('opaque')
        request().complete()
        expect(await retry).toBe(false)
      } finally {
        wrapper.unmount()
        report.mockRestore()
      }
    })

    it('rejects a repeated cursor and accepts a short nonterminal page', async () => {
      const report = vi.spyOn(console, 'error').mockImplementation(() => {})
      const { wrapper, request } = mountManagedTable()
      try {
        request().complete({ items: [{ name: 'Alice' }], nextCursor: 'opaque' })
        const next = wrapper.vm.fetch('next')
        request().complete({ items: [{ name: 'Invalid' }], nextCursor: 'opaque' })
        expect(await next).toBe(false)
        expect(report).toHaveBeenCalledOnce()
        const retry = wrapper.vm.fetch('next')
        request().complete({ items: [{ name: 'Bob' }], nextCursor: 'another' })
        expect(await retry).toBe(true)
        const last = wrapper.vm.fetch('next')
        expect(request().cursor).toBe('another')
        request().complete({ items: [] })
        expect(await last).toBe(true)
      } finally {
        wrapper.unmount()
        report.mockRestore()
      }
    })

    it.each([0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])(
      'reports invalid page limit %s without emitting a request',
      (limit) => {
        const report = vi.spyOn(console, 'error').mockImplementation(() => {})
        const { wrapper, onFetch } = mountManagedTable({
          ...baseOptions,
          itemsPerPage: limit,
          mobileItemsPerPage: limit,
        })
        try {
          expect(onFetch).not.toHaveBeenCalled()
          expect(report).toHaveBeenCalledWith('Table page limit must be a positive safe integer')
        } finally {
          wrapper.unmount()
          report.mockRestore()
        }
      },
    )

    it('keeps the successful page after failed Next, retries the same cursor, then returns Previous', async () => {
      const { wrapper, table, fetch, button } = await mountCursorTable()
      try {
        const pending = Promise.withResolvers<PageResponse>()
        fetch.mockReturnValueOnce(pending.promise)
        const next = table.vm.fetch('next')
        expect(await table.vm.fetch('next')).toBe(false)
        expect(await table.vm.fetch('prev')).toBe(false)
        expect(await table.vm.fetch()).toBe(false)
        await flushPromises()
        expect(button('$mdiChevronRight').props('disabled')).toBe(true)
        expect(button('$mdiChevronLeft').props('disabled')).toBe(true)
        expect(button('$mdiRefresh').props('disabled')).toBe(true)
        expect(table.text()).toContain('Alice')
        expect(fetch).toHaveBeenCalledTimes(2)
        pending.reject(new Error('Offline'))
        expect(await next).toBe(false)
        await flushPromises()
        expect(table.text()).toContain('Alice')
        expect(button('$mdiChevronLeft').props('disabled')).toBe(true)
        expect(button('$mdiChevronRight').props('disabled')).toBe(false)
        fetch.mockResolvedValueOnce(cursorPage('Bob', 'after-bob'))
        expect(await table.vm.fetch('next')).toBe(true)
        await flushPromises()
        expect(fetch.mock.lastCall?.[0].cursor).toBe('after-alice')
        expect(table.text()).toContain('Bob')
        fetch.mockResolvedValueOnce(cursorPage('Alice', 'after-alice'))
        expect(await table.vm.fetch('prev')).toBe(true)
        await flushPromises()
        expect(fetch.mock.lastCall?.[0].cursor).toBeUndefined()
        expect(table.text()).toContain('Alice')
        expect(button('$mdiChevronLeft').props('disabled')).toBe(true)
      } finally {
        wrapper.unmount()
      }
    })

    it('does not pop history after failed Previous or add history on refresh', async () => {
      const { wrapper, table, fetch, button } = await mountCursorTable()
      try {
        fetch.mockResolvedValueOnce(cursorPage('Bob', 'after-bob'))
        await table.vm.fetch('next')
        await flushPromises()
        fetch.mockResolvedValueOnce(cursorPage('Charlie'))
        await table.vm.fetch('next')
        await flushPromises()
        fetch.mockRejectedValueOnce(new Error('Offline'))
        expect(await table.vm.fetch('prev')).toBe(false)
        await flushPromises()
        expect(table.text()).toContain('Charlie')
        expect(fetch.mock.lastCall?.[0].cursor).toBe('after-alice')
        fetch.mockResolvedValueOnce(cursorPage('Charlie'))
        await table.vm.fetch()
        expect(fetch.mock.lastCall?.[0].cursor).toBe('after-bob')
        fetch.mockResolvedValueOnce(cursorPage('Bob', 'after-bob'))
        await table.vm.fetch('prev')
        await flushPromises()
        expect(fetch.mock.lastCall?.[0].cursor).toBe('after-alice')
        fetch.mockResolvedValueOnce(cursorPage('Alice', 'after-alice'))
        await table.vm.fetch('prev')
        await flushPromises()
        expect(fetch.mock.lastCall?.[0].cursor).toBeUndefined()
        expect(button('$mdiChevronLeft').props('disabled')).toBe(true)
      } finally {
        wrapper.unmount()
      }
    })

    it('supersedes pending navigation on search and retries a failed new search from the first page', async () => {
      const { wrapper, table, fetch, button } = await mountCursorTable()
      try {
        fetch.mockResolvedValueOnce(cursorPage('Bob', 'after-bob'))
        await table.vm.fetch('next')
        await flushPromises()
        const stale = Promise.withResolvers<PageResponse>()
        const current = Promise.withResolvers<PageResponse>()
        fetch.mockReturnValueOnce(stale.promise).mockReturnValueOnce(current.promise)
        const next = table.vm.fetch('next')
        await table.find('input').setValue('new')
        await table.find('input').trigger('keydown', { key: 'Enter' })
        expect(await next).toBe(false)
        expect(fetch.mock.calls[2]?.[0].signal.aborted).toBe(true)
        expect(fetch.mock.lastCall?.[0]).toMatchObject({ cursor: undefined, search: 'new' })
        stale.resolve(cursorPage('Stale', 'stale-cursor'))
        await flushPromises()
        expect(table.text()).not.toContain('Stale')
        expect(button('$mdiChevronRight').props('disabled')).toBe(true)
        current.resolve(cursorPage('New', 'after-new'))
        await flushPromises()
        expect(table.text()).toContain('New')
        expect(button('$mdiChevronLeft').props('disabled')).toBe(true)
        fetch.mockResolvedValueOnce(cursorPage('New second'))
        await table.vm.fetch('next')
        await flushPromises()
        expect(fetch.mock.lastCall?.[0].cursor).toBe('after-new')
        await table.find('input').setValue('other')
        fetch.mockRejectedValueOnce(new Error('Offline'))
        await table.find('input').trigger('keydown', { key: 'Enter' })
        await flushPromises()
        expect(table.text()).toContain('New second')
        fetch.mockResolvedValueOnce(cursorPage('Other'))
        await table.vm.fetch()
        await flushPromises()
        expect(fetch.mock.lastCall?.[0]).toMatchObject({ cursor: undefined, search: 'other' })
        expect(table.text()).toContain('Other')
        expect(table.text()).not.toContain('New second')
        expect(button('$mdiChevronLeft')).toBeUndefined()
      } finally {
        wrapper.unmount()
      }
    })

    it('settles pending navigation on unmount and ignores late completion', async () => {
      const { wrapper, table, fetch } = await mountCursorTable()
      const pending = Promise.withResolvers<PageResponse>()
      fetch.mockReturnValueOnce(pending.promise)
      const next = table.vm.fetch('next')
      wrapper.unmount()
      expect(await next).toBe(false)
      expect(fetch.mock.lastCall?.[0].signal.aborted).toBe(true)
      pending.resolve(cursorPage('Late'))
      await flushPromises()
    })
  })

  it('renders table with column headers', () => {
    const wrapper = mountTable(baseOptions, sampleData)
    expect(wrapper.text()).toContain('name')
    expect(wrapper.text()).toContain('email')
    expect(wrapper.text()).toContain('status')
  })

  it('renders row data', () => {
    const wrapper = mountTable(baseOptions, sampleData)
    expect(wrapper.text()).toContain('Alice')
    expect(wrapper.text()).toContain('bob@test.com')
    expect(wrapper.text()).toContain('blocked')
  })

  it('renders search bar when search option is set', () => {
    const wrapper = mountTable({ ...baseOptions, search: { placeholder: 'Search...' } }, sampleData)
    const input = wrapper.find('input')
    expect(input.exists()).toBe(true)
  })

  it('renders with formatted columns', () => {
    const wrapper = mountTable(
      {
        key: 'name',
        columns: [
          { name: 'name' },
          {
            name: 'status',
            format: [
              {
                rules: { type: 'equals', params: 'active' },
                color: 'green',
              },
              { color: 'red' },
            ],
          },
        ],
        itemsPerPage: 10,
        mobileItemsPerPage: 10,
      },
      sampleData,
    )
    expect(wrapper.text()).toContain('active')
    expect(wrapper.text()).toContain('blocked')
  })

  it('renders empty state when no data', () => {
    const wrapper = mountTable(baseOptions, [])
    // Table component should render without errors
    expect(wrapper.html()).toBeTruthy()
  })

  it('renders row actions', () => {
    const wrapper = mountTable(
      {
        key: 'name',
        columns: [
          { name: 'name' },
          {
            name: 'actions',
            actions: [
              {
                name: 'edit',
                title: 'Edit record',
                format: { icon: '$edit' },
              },
            ],
          },
        ],
        itemsPerPage: 10,
        mobileItemsPerPage: 10,
      },
      sampleData,
    )
    expect(wrapper.html()).toContain('button')
  })

  it('renders action with title attribute', () => {
    const wrapper = mountTable(
      {
        key: 'name',
        columns: [
          { name: 'name' },
          {
            name: 'actions',
            actions: [
              {
                name: 'edit',
                title: 'Edit record',
                format: { icon: '$edit' },
              },
            ],
          },
        ],
        itemsPerPage: 10,
        mobileItemsPerPage: 10,
      },
      sampleData,
    )
    expect(wrapper.html()).toContain('edit')
  })

  it('emits a single fetch request object on mount', () => {
    const wrapper = mountTable({
      ...baseOptions,
      search: { value: 'Alice' },
      filter: { fields: [{ type: 'text', name: 'status', value: 'active' }] },
      sort: [{ name: 'name', value: 'desc' }],
    })
    const events = wrapper.emitted('fetch')!
    expect(events[0]).toHaveLength(1)
    expect(events[0]?.[0]).toEqual({
      cursor: undefined,
      limit: 10,
      search: 'Alice',
      filter: { status: ['active'] },
      sort: '-name',
      signal: expect.any(AbortSignal),
      complete: expect.any(Function),
    })
    wrapper.unmount()
  })
})
