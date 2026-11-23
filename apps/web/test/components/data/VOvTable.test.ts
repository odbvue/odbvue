import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { mdiPencil } from '@mdi/js'
import {
  VAutocomplete,
  VBtn,
  VChip,
  VDialog,
  VOverlay,
  VProgressLinear,
  VTextField,
} from 'vuetify/components'
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

function storedState() {
  return {
    version: 1,
    search: '',
    filter: { status: null, removed: 'ignored' },
    sort: [{ name: 'email', value: 'desc' }, { name: 'name' }, { name: 'removed', value: 'asc' }],
    pageSizes: { desktop: 7, mobile: 2 },
  }
}

describe('VOvTable', () => {
  describe('session preferences', () => {
    const stateKey = 'test.table.preferences'
    const options = (): OvTableOptions => ({
      ...baseOptions,
      stateKey,
      search: { value: 'default' },
      filter: { fields: [{ type: 'text', name: 'status', value: 'active' }] },
      sort: [{ name: 'name', value: 'asc' }, { name: 'email' }],
    })

    let originalWidth: number
    beforeEach(() => {
      sessionStorage.clear()
      originalWidth = window.innerWidth
      window.innerWidth = 1440
      window.dispatchEvent(new Event('resize'))
    })
    afterEach(() => {
      sessionStorage.clear()
      window.innerWidth = originalWidth
      window.dispatchEvent(new Event('resize'))
      vi.restoreAllMocks()
    })

    it.each([
      { width: 1440, limit: 7 },
      { width: 480, limit: 2 },
    ])(
      'restores preferences before a fresh first fetch at width $width',
      async ({ width, limit }) => {
        window.innerWidth = width
        window.dispatchEvent(new Event('resize'))
        await flushPromises()
        sessionStorage.setItem(
          stateKey,
          JSON.stringify({
            ...storedState(),
            pageCursor: 'stale',
            cursorStack: ['stale'],
          }),
        )
        const originalOptions = options()
        const { wrapper, onFetch, request } = mountManagedTable(originalOptions)
        try {
          await flushPromises()
          expect(onFetch).toHaveBeenCalledTimes(1)
          expect(request()).toMatchObject({
            cursor: undefined,
            search: undefined,
            filter: {},
            sort: '-email',
            limit,
          })
          expect(wrapper.getComponent(VTextField).props('modelValue')).toBe('')
          expect(originalOptions.filter?.fields[0]?.value).toBe('active')
          expect(originalOptions.sort?.[0]?.value).toBe('asc')
        } finally {
          wrapper.unmount()
        }
      },
    )

    it('automatically saves edits while mounted, then restores them on remount without cursors', async () => {
      const { wrapper, request } = mountManagedTable(options())
      request().complete({ items: [{ name: 'one' }], nextCursor: 'next-page' })
      await flushPromises()
      const next = wrapper
        .findAllComponents(VBtn)
        .find((button) => button.props('icon') === '$mdiChevronRight')!
      await next.trigger('click')
      request().complete({ items: [{ name: 'two' }] })
      await wrapper.getComponent(VTextField).setValue('remember me')
      await wrapper.findAllComponents(VChip)[0]!.vm.$emit('click:close')
      await flushPromises()
      request().complete({ items: [] })
      const sortChip = wrapper.findAllComponents(VChip)[0]!
      await sortChip.trigger('click')
      await flushPromises()
      request().complete({ items: [] })
      expect(request().cursor).toBeUndefined()
      const saved = JSON.parse(sessionStorage.getItem(stateKey)!)
      expect(saved).toMatchObject({
        search: 'remember me',
        filter: { status: null },
        sort: [{ name: 'name', value: 'desc' }, { name: 'email' }],
      })
      expect(Object.keys(saved).toSorted()).toEqual([
        'filter',
        'pageSizes',
        'search',
        'sort',
        'version',
      ])
      wrapper.unmount()

      const restored = mountManagedTable(options())
      try {
        expect(restored.request()).toMatchObject({
          cursor: undefined,
          search: 'remember me',
          filter: {},
          sort: '-name',
        })
      } finally {
        restored.wrapper.unmount()
      }
    })

    it('resets preferences to unmodified configured defaults and refetches the first page', async () => {
      sessionStorage.setItem(stateKey, JSON.stringify(storedState()))
      const { wrapper, request } = mountManagedTable(options())
      try {
        request().complete({ items: [] })
        await flushPromises()
        expect(
          wrapper
            .findAllComponents(VBtn)
            .filter((button) => button.element.closest('tfoot'))
            .map((button) => button.props('icon')),
        ).toEqual(['$mdiRefresh'])
        const reset = wrapper.vm.resetState()
        expect(request()).toMatchObject({
          cursor: undefined,
          search: 'default',
          filter: { status: ['active'] },
          sort: 'name',
          limit: 10,
        })
        request().complete({ items: [] })
        expect(await reset).toBe(true)
        expect(JSON.parse(sessionStorage.getItem(stateKey)!)).toMatchObject({
          search: 'default',
          filter: { status: 'active' },
          pageSizes: { desktop: 10, mobile: 10 },
        })
      } finally {
        wrapper.unmount()
      }
    })

    it.each([false, true])(
      'restores selected autocomplete titles for chips and the filter dialog (multiple: %s)',
      async (multiple) => {
        const choices = [
          { title: 'Ada (ada@example.test)', value: 'ada-id' },
          { title: 'Grace (grace@example.test)', value: 'grace-id' },
          { title: 'Unselected user', value: 'other-id' },
        ]
        const value = multiple ? ['ada-id', 'grace-id'] : 'ada-id'
        const fetchItems = vi
          .fn<NonNullable<OvFormSelectionField['fetchItems']>>()
          .mockResolvedValue(choices)
        const tableOptions = (items: typeof choices = []): OvTableOptions => ({
          ...baseOptions,
          stateKey,
          filter: {
            fields: [
              {
                type: 'autocomplete',
                name: 'userId',
                multiple,
                items,
                fetchItems,
                minSearchLength: 1,
              },
            ],
          },
        })
        const onFetch = vi.fn<(request: OvTableFetchRequest) => void>(({ complete }) =>
          complete({ items: [] }),
        )
        const mountAutocompleteTable = () =>
          mount(VOvTable, {
            props: { options: tableOptions(), onFetch },
            global: {
              plugins: globalPlugins,
              stubs: {
                VDialog: {
                  props: ['modelValue'],
                  template: '<div v-if="modelValue"><slot /></div>',
                },
              },
            },
          })
        const wrapper = mountAutocompleteTable()
        try {
          await wrapper.setProps({ options: tableOptions(choices) })
          await wrapper
            .findAllComponents(VBtn)
            .find((button) => button.props('icon') === '$mdiFilterPlus')!
            .trigger('click')
          const form = wrapper.getComponent(VOvForm)
          form.getComponent(VAutocomplete).vm.$emit('update:modelValue', value)
          await flushPromises()
          await form.vm.handleAction('apply')
          await flushPromises()
          expect(JSON.parse(sessionStorage.getItem(stateKey)!).filterItems).toEqual({
            userId: multiple ? choices.slice(0, 2) : choices.slice(0, 1),
          })
        } finally {
          wrapper.unmount()
        }

        const restored = mountAutocompleteTable()
        try {
          await flushPromises()
          const chips = restored.findAllComponents(VChip)
          expect(chips.map((chip) => chip.get('strong').text())).toEqual(
            (multiple ? choices.slice(0, 2) : choices.slice(0, 1)).map((item) => item.title),
          )
          expect(onFetch.mock.lastCall?.[0].filter).toEqual({
            userId: multiple ? value : [value],
          })
          expect(fetchItems).not.toHaveBeenCalled()
          await restored
            .findAllComponents(VBtn)
            .find((button) => button.props('icon') === '$mdiFilterPlus')!
            .trigger('click')
          const autocomplete = restored.getComponent(VOvForm).getComponent(VAutocomplete)
          expect(autocomplete.props('items')).toEqual(
            multiple ? choices.slice(0, 2) : choices.slice(0, 1),
          )
          await restored.setProps({
            options: tableOptions([{ ...choices[0]!, title: 'Updated display name' }]),
          })
          expect(restored.findAllComponents(VChip)[0]!.get('strong').text()).toBe(
            'Updated display name',
          )
        } finally {
          restored.unmount()
        }
      },
    )

    it.each(['{invalid', 'null', JSON.stringify({ ...storedState(), pageSizes: { desktop: 0 } })])(
      'warns and uses defaults for invalid saved state: %s',
      (raw) => {
        sessionStorage.setItem(stateKey, raw)
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { wrapper, request } = mountManagedTable(options())
        try {
          expect(warn).toHaveBeenCalledWith(
            'Unable to restore table session state',
            expect.any(Error),
          )
          expect(request()).toMatchObject({
            search: 'default',
            filter: { status: ['active'] },
            limit: 10,
          })
        } finally {
          wrapper.unmount()
        }
      },
    )

    it('does not access storage when persistence is not enabled', async () => {
      const get = vi.spyOn(Storage.prototype, 'getItem')
      const set = vi.spyOn(Storage.prototype, 'setItem')
      const { wrapper } = mountManagedTable({ ...baseOptions, search: {} })
      await wrapper.getComponent(VTextField).setValue('transient')
      wrapper.unmount()
      expect(get).not.toHaveBeenCalled()
      expect(set).not.toHaveBeenCalled()
    })

    it('keeps working when storage reads and writes fail', async () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new DOMException('Denied', 'SecurityError')
      })
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new DOMException('Quota', 'QuotaExceededError')
      })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { wrapper, request } = mountManagedTable(options())
      try {
        expect(request().search).toBe('default')
        await wrapper.getComponent(VTextField).setValue('still usable')
        expect(warn).toHaveBeenCalledWith(
          'Unable to save table session state',
          expect.any(DOMException),
        )
      } finally {
        wrapper.unmount()
      }
    })

    it('honors the existing state-key prop over options.stateKey and isolates keys', () => {
      sessionStorage.setItem(
        'test.other',
        JSON.stringify({ ...storedState(), search: 'other table' }),
      )
      const onFetch = vi.fn<(request: OvTableFetchRequest) => void>()
      const wrapper = mount(VOvTable, {
        props: { options: options(), stateKey: 'test.other', onFetch },
        global: { plugins: globalPlugins },
      })
      try {
        expect(onFetch.mock.lastCall?.[0].search).toBe('other table')
        expect(sessionStorage.getItem(stateKey)).toBeNull()
      } finally {
        wrapper.unmount()
      }
    })
  })

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

  it('prefills an ordinary row form and keeps a write-only draft out of rows after refetch', async () => {
    const ordinary = { name: 'Ordinary', value: 'original', editMode: 'value' }
    const writeOnly = { name: 'Secret', value: null, editMode: 'secret' }
    const protectedRow = { name: 'Protected', value: null, editMode: 'none' }
    const items = [ordinary, writeOnly, protectedRow]
    const { wrapper, onFetch, request } = mountManagedTable({
      key: 'name',
      columns: [
        { name: 'name' },
        { name: 'value' },
        {
          name: 'actions',
          actions: [
            {
              name: 'edit',
              title: 'Edit',
              key: 'editMode',
              format: [
                { rules: { type: 'equals', params: 'value' }, icon: mdiPencil },
                { hidden: true },
              ],
              form: (row) => ({
                fields: [{ name: 'value', type: row.name === 'Ordinary' ? 'textarea' : 'text' }],
                actions: ['cancel'],
                actionCancel: 'cancel',
              }),
            },
            {
              name: 'replace',
              title: 'Replace',
              key: 'editMode',
              format: [
                { rules: { type: 'equals', params: 'secret' }, icon: mdiPencil },
                { hidden: true },
              ],
              form: {
                fields: [{ name: 'replacement', type: 'password', value: '' }],
                actions: ['save', 'cancel'],
                actionSubmit: 'save',
                actionCancel: 'cancel',
              },
            },
          ],
        },
      ],
      mobileItemsPerPage: 3,
    })
    request().complete({ items })
    await flushPromises()
    expect(wrapper.findAll('button[aria-label="Replace"]')).toHaveLength(1)
    expect(wrapper.findAll('button[aria-label="Edit"]')).toHaveLength(1)
    await wrapper.get('button[aria-label="Edit"]').trigger('click')
    await flushPromises()
    let form = wrapper.getComponent(VOvForm)
    expect(form.get<HTMLTextAreaElement>('textarea').element.value).toBe('original')
    await form.vm.handleAction('cancel')

    const openReplacement = async () => {
      await wrapper.get('button[aria-label="Replace"]').trigger('click')
      await flushPromises()
      return wrapper.getComponent(VOvForm)
    }
    form = await openReplacement()
    const input = form.get<HTMLInputElement>('input[type="password"]')
    expect(input.element.value).toBe('')
    await input.setValue('test-replacement')
    await form.vm.handleAction('save')
    const [action, rows, submission, complete] = wrapper.emitted('action')![0]!
    expect(action).toBe('replace')
    expect(rows).toEqual(items)
    expect(submission).toMatchObject({ name: 'Secret', replacement: 'test-replacement' })
    expect(complete).toBeTypeOf('function')
    if (typeof complete !== 'function') throw new Error('Missing action callback')
    complete(undefined, true)
    await flushPromises()
    expect(onFetch).toHaveBeenCalledTimes(2)
    request().complete({ items })
    await flushPromises()
    expect(wrapper.text()).not.toContain('test-replacement')
    form = await openReplacement()
    expect(form.get<HTMLInputElement>('input[type="password"]').element.value).toBe('')
    wrapper.unmount()
  })

  it('keeps save feedback in the dialog and closes it before refetching with settled loading props', async () => {
    const items = [{ name: 'Original' }]
    const { wrapper, onFetch, request } = mountManagedTable({
      key: 'name',
      columns: [{ name: 'name' }],
      actions: [
        {
          name: 'edit',
          form: {
            fields: [{ name: 'name', type: 'text' }],
            actions: ['save', 'cancel'],
            actionSubmit: 'save',
            actionCancel: 'cancel',
          },
        },
      ],
    })
    try {
      request().complete({ items })
      await flushPromises()
      await wrapper.get('button[name="edit"]').trigger('click')
      await flushPromises()
      const form = wrapper.getComponent(VOvForm)
      await form.vm.handleAction('save')
      const complete = wrapper.emitted('action')![0]![3]
      if (typeof complete !== 'function') throw new Error('Missing action callback')
      await wrapper.setProps({ loading: true })
      expect(form.props('loading')).toBe(true)
      expect(
        wrapper.findAllComponents(VProgressLinear).filter((progress) => progress.props('active')),
      ).toHaveLength(0)
      expect(form.getComponent(VOverlay).props('modelValue')).toBe(false)
      expect(
        wrapper.findAllComponents(VOverlay).filter((overlay) => overlay.props('modelValue')),
      ).toHaveLength(2)
      const dialog = wrapper
        .findAllComponents(VDialog)
        .find((candidate) => candidate.props('modelValue'))!
      expect(dialog.props('persistent')).toBe(true)
      const buttons = dialog.findAllComponents(VBtn)
      expect(buttons.every((button) => !button.props('loading'))).toBe(true)
      expect(buttons.every((button) => button.props('disabled'))).toBe(true)

      onFetch.mockImplementation(() => {
        expect(wrapper.findComponent(VOvForm).exists()).toBe(false)
      })
      const settled = wrapper.setProps({ loading: false })
      complete(undefined, true)
      await settled
      await flushPromises()
      expect(onFetch).toHaveBeenCalledTimes(2)
      expect(
        wrapper.findAllComponents(VOverlay).filter((overlay) => overlay.props('modelValue')),
      ).toHaveLength(1)
      expect(wrapper.text()).toContain('Original')
      expect(wrapper.get('table').element.closest('[inert]')).not.toBeNull()
      request().complete()
      await flushPromises()
      expect(
        wrapper.findAllComponents(VOverlay).filter((overlay) => overlay.props('modelValue')),
      ).toHaveLength(0)
      expect(wrapper.text()).toContain('Original')
    } finally {
      wrapper.unmount()
    }
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
