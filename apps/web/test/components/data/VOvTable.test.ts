import { describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { VBtn } from 'vuetify/components'
import VOvTable from '@/components/data/VOvTable.vue'
import { globalPlugins } from '../../support/components.setup'
import type { OvFilterValue, OvTableOptions, OvTableData } from '@/components'
import { useCursorQuery, type CursorQueryOptions } from '@/capabilities/http/cursor-query'
import type { HttpResponse } from '@/capabilities/http/core'

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
  const fetch = vi.fn<CursorQueryOptions<OvTableData>['fetch']>()
  fetch.mockResolvedValueOnce(cursorPage('Alice', 'after-alice'))
  const wrapper = mount(
    defineComponent({
      setup() {
        const query = useCursorQuery({ fetch })
        return () =>
          h(VOvTable, {
            options: { ...baseOptions, search: {} },
            items: query.items.value,
            nextCursor: query.nextCursor.value,
            loading: query.loading.value,
            onFetch: async (
              _data: OvTableData[],
              cursor: string | undefined,
              limit: number,
              search?: string,
              _filter?: OvFilterValue,
              _sort?: string,
              complete?: (success: boolean) => void,
            ) => {
              complete?.(await query.load({ cursor, limit, search }))
            },
          })
      },
    }),
    { global: { plugins: globalPlugins } },
  )
  await flushPromises()
  const table = wrapper.findComponent(VOvTable)
  const button = (icon: string) =>
    table.findAllComponents(VBtn).find((btn) => btn.props('icon') === icon)!
  return { wrapper, table, fetch, button }
}

describe('VOvTable', () => {
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

  it('emits fetch on mount', () => {
    const wrapper = mountTable(baseOptions, [])
    expect(wrapper.emitted('fetch')).toBeTruthy()
  })
})
