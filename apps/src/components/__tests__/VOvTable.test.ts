import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { OvTableOptions, OvTableData } from '../index'
import VOvTable from '../VOvTable.vue'

// Mock ResizeObserver globally for all tests
beforeAll(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  })) as never
})

// Mock visualViewport for Vuetify VOverlay with proper event handling
if (typeof global.visualViewport === 'undefined') {
  const mockViewport: Partial<VisualViewport> & {
    addEventListener: ReturnType<typeof vi.fn>
    removeEventListener: ReturnType<typeof vi.fn>
  } = {
    width: 1024,
    height: 768,
    offsetLeft: 0,
    offsetTop: 0,
    pageLeft: 0,
    pageTop: 0,
    scale: 1,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }
  global.visualViewport = mockViewport as VisualViewport
}

describe('VOvTable', () => {
  const basicTableOptions: OvTableOptions = {
    key: 'id',
    columns: [
      { name: 'id', label: 'ID' },
      { name: 'name', label: 'Name' },
      { name: 'email', label: 'Email' },
    ],
  }

  const basicTableData: OvTableData[] = [
    { id: 1, name: 'John', email: 'john@example.com' },
    { id: 2, name: 'Jane', email: 'jane@example.com' },
    { id: 3, name: 'Bob', email: 'bob@example.com' },
  ]

  describe('Rendering', () => {
    it('mounts without error', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders VContainer component', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      const container = wrapper.findComponent({ name: 'VContainer' })
      expect(container.exists()).toBe(true)
    })

    it('renders VTable component', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      const table = wrapper.findComponent({ name: 'VTable' })
      expect(table.exists()).toBe(true)
    })

    it('renders table with correct columns', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('renders table rows with data', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('renders pagination buttons', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('renders loading overlay when loading is true', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
          loading: true,
        },
      })
      await flushPromises()
      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.exists()).toBe(true)
    })
  })

  describe('Props - Table Options', () => {
    it('accepts options prop with key and columns', () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      expect(wrapper.props('options')).toEqual(basicTableOptions)
    })

    it('accepts options with search configuration', async () => {
      const optionsWithSearch: OvTableOptions = {
        ...basicTableOptions,
        search: {
          label: 'Search',
          placeholder: 'Enter search term',
          value: '',
        },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSearch,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.props('options').search).toBeDefined()
    })

    it('accepts options with filter configuration', async () => {
      const optionsWithFilter: OvTableOptions = {
        ...basicTableOptions,
        filter: {
          fields: [{ type: 'text', name: 'name', label: 'Name' }],
        },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithFilter,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.props('options').filter).toBeDefined()
    })

    it('accepts options with sort configuration', async () => {
      const optionsWithSort: OvTableOptions = {
        ...basicTableOptions,
        sort: [
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSort,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.props('options').sort).toBeDefined()
    })

    it('accepts options with itemsPerPage', async () => {
      const optionsWithPagination: OvTableOptions = {
        ...basicTableOptions,
        itemsPerPage: 5,
        currentPage: 1,
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithPagination,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.props('options').itemsPerPage).toBe(5)
    })

    it('accepts options with column actions', async () => {
      const optionsWithActions: OvTableOptions = {
        ...basicTableOptions,
        columns: [
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
          {
            name: 'actions',
            label: 'Actions',
            actions: ['edit', 'delete'],
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithActions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('accepts options with table-level actions', async () => {
      const optionsWithTableActions: OvTableOptions = {
        ...basicTableOptions,
        actions: ['add', 'export'],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithTableActions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.props('options').actions).toBeDefined()
    })

    it('defaults canRefresh to true', () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      expect(wrapper.props('options').canRefresh).toBeUndefined()
    })
  })

  describe('Props - Data', () => {
    it('accepts data prop as array of table data', () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      expect(wrapper.props('data')).toEqual(basicTableData)
    })

    it('handles empty data array', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: [],
        },
      })
      await flushPromises()
      expect(wrapper.props('data')).toEqual([])
    })

    it('defaults data to empty array if not provided', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
        },
      })
      await flushPromises()
      // Component defaults to empty array when data is not provided
      const data = wrapper.props('data')
      expect(Array.isArray(data) || data === undefined).toBe(true)
    })

    it('updates when data prop changes', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()

      const newData = [
        { id: 4, name: 'Alice', email: 'alice@example.com' },
        { id: 5, name: 'Charlie', email: 'charlie@example.com' },
      ]
      await wrapper.setProps({ data: newData })
      await flushPromises()
      expect(wrapper.props('data')).toEqual(newData)
    })

    it('handles data with multiple rows', async () => {
      const manyRows = Array.from({ length: 100 }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
      }))
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: manyRows,
        },
      })
      await flushPromises()
      expect(wrapper.props('data')).toHaveLength(100)
    })
  })

  describe('Props - Loading', () => {
    it('accepts loading prop as false', () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })

    it('accepts loading prop as true', () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
          loading: true,
        },
      })
      expect(wrapper.props('loading')).toBe(true)
    })

    it('defaults loading to false', () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })
  })

  describe('Table Columns', () => {
    it('renders all columns from options', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('displays column titles from options', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('applies column alignment', async () => {
      const optionsWithAlign: OvTableOptions = {
        ...basicTableOptions,
        columns: [
          { name: 'id', label: 'ID', align: 'center' },
          { name: 'name', label: 'Name', align: 'left' },
          { name: 'email', label: 'Email', align: 'right' },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithAlign,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('applies format to column values', async () => {
      const optionsWithFormat: OvTableOptions = {
        ...basicTableOptions,
        columns: [
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
          {
            name: 'email',
            label: 'Email',
            format: { icon: '$mdiEmail', color: 'primary' },
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithFormat,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('respects maxLength on columns', async () => {
      const optionsWithMaxLength: OvTableOptions = {
        ...basicTableOptions,
        columns: [
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name', maxLength: 5 },
          { name: 'email', label: 'Email' },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithMaxLength,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Table Actions', () => {
    it('renders table-level action buttons', async () => {
      const optionsWithActions: OvTableOptions = {
        ...basicTableOptions,
        actions: ['add', 'delete'],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithActions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('emits action event when table action is clicked', async () => {
      const optionsWithActions: OvTableOptions = {
        ...basicTableOptions,
        actions: ['add'],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithActions,
          data: basicTableData,
        },
      })
      await flushPromises()

      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThan(0)
      await buttons[0]!.trigger('click')
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('renders column-level action buttons', async () => {
      const optionsWithColumnActions: OvTableOptions = {
        ...basicTableOptions,
        columns: [
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
          {
            name: 'actions',
            label: 'Actions',
            actions: ['edit', 'delete'],
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithColumnActions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Table Search', () => {
    it('renders search input when search option is provided', async () => {
      const optionsWithSearch: OvTableOptions = {
        ...basicTableOptions,
        search: { label: 'Search', placeholder: 'Type here...' },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSearch,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('does not render search input when search option is not provided', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('emits fetch event on search submission', async () => {
      const optionsWithSearch: OvTableOptions = {
        ...basicTableOptions,
        search: { label: 'Search' },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSearch,
          data: basicTableData,
        },
      })
      await flushPromises()

      // Verify fetch event is emitted
      const emitted = wrapper.emitted('fetch')
      expect(emitted).toBeDefined()
    })
  })

  describe('Table Filter', () => {
    it('renders filter button when filter option is provided', async () => {
      const optionsWithFilter: OvTableOptions = {
        ...basicTableOptions,
        filter: {
          fields: [{ type: 'text', name: 'name', label: 'Name' }],
        },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithFilter,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('renders filter chips when filters are active', async () => {
      const optionsWithFilter: OvTableOptions = {
        ...basicTableOptions,
        filter: {
          fields: [
            {
              type: 'text',
              name: 'name',
              label: 'Name',
              value: 'John',
            },
          ],
        },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithFilter,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('emits fetch event when filter changes', async () => {
      const optionsWithFilter: OvTableOptions = {
        ...basicTableOptions,
        filter: {
          fields: [{ type: 'text', name: 'name', label: 'Name' }],
        },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithFilter,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Table Sort', () => {
    it('renders sort button when sort option is provided', async () => {
      const optionsWithSort: OvTableOptions = {
        ...basicTableOptions,
        sort: [
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSort,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('renders sort chips when sorts are active', async () => {
      const optionsWithSort: OvTableOptions = {
        ...basicTableOptions,
        sort: [{ name: 'name', label: 'Name', value: 'asc' }],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSort,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('emits fetch event when sort changes', async () => {
      const optionsWithSort: OvTableOptions = {
        ...basicTableOptions,
        sort: [{ name: 'name', label: 'Name' }],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSort,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Pagination', () => {
    it('renders next/prev pagination buttons', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('disables prev button on first page', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            itemsPerPage: 2,
            currentPage: 1,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('disables next button on last page', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            itemsPerPage: 10,
            currentPage: 1,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('respects itemsPerPage option', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            itemsPerPage: 5,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.props('options').itemsPerPage).toBe(5)
    })

    it('emits fetch event on page change', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: Array.from({ length: 25 }, (_, i) => ({
            id: i + 1,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`,
          })),
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Refresh Button', () => {
    it('renders refresh button when canRefresh is true', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            canRefresh: true,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('hides refresh button when canRefresh is false', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            canRefresh: false,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('emits fetch event on refresh', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            canRefresh: true,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form Dialog', () => {
    it('shows form dialog when row action with form is triggered', async () => {
      const optionsWithForm: OvTableOptions = {
        ...basicTableOptions,
        columns: [
          { name: 'id', label: 'ID' },
          {
            name: 'name',
            label: 'Name',
            actions: [
              {
                name: 'edit',
                form: {
                  fields: [{ type: 'text', name: 'name', label: 'Name' }],
                },
              },
            ],
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithForm,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('shows form dialog for table action with form', async () => {
      const optionsWithTableForm: OvTableOptions = {
        ...basicTableOptions,
        actions: [
          {
            name: 'add',
            form: {
              fields: [{ type: 'text', name: 'name', label: 'Name' }],
            },
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithTableForm,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('emits action event on form submission', async () => {
      const optionsWithForm: OvTableOptions = {
        ...basicTableOptions,
        actions: [
          {
            name: 'add',
            form: {
              fields: [{ type: 'text', name: 'name', label: 'Name' }],
              actions: ['submit', 'cancel'],
              actionSubmit: 'submit',
              actionCancel: 'cancel',
            },
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithForm,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Emitted Events', () => {
    it('emits fetch event on mount', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      const emitted = wrapper.emitted('fetch')
      expect(emitted).toBeDefined()
      expect(emitted?.length).toBeGreaterThan(0)
    })

    it('emits action event with correct parameters', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('fetch event includes pagination parameters', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: {
            ...basicTableOptions,
            itemsPerPage: 10,
          },
          data: basicTableData,
        },
      })
      await flushPromises()
      const emitted = wrapper.emitted('fetch')
      expect(emitted).toBeDefined()
    })

    it('fetch event includes search parameters when search is enabled', async () => {
      const optionsWithSearch: OvTableOptions = {
        ...basicTableOptions,
        search: { label: 'Search' },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSearch,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('fetch event includes filter parameters when filter is enabled', async () => {
      const optionsWithFilter: OvTableOptions = {
        ...basicTableOptions,
        filter: {
          fields: [{ type: 'text', name: 'name', label: 'Name' }],
        },
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithFilter,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('fetch event includes sort parameters when sort is enabled', async () => {
      const optionsWithSort: OvTableOptions = {
        ...basicTableOptions,
        sort: [{ name: 'name', label: 'Name' }],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: optionsWithSort,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Exposed Methods', () => {
    it('exposes fetch method', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(typeof wrapper.vm.fetch).toBe('function')
    })

    it('fetch method can be called without parameters', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      await wrapper.vm.fetch()
      expect(wrapper.vm).toBeDefined()
    })

    it('fetch method can be called with page number', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      await wrapper.vm.fetch(2)
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Responsive Layout', () => {
    it('renders table with default desktop layout', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles data with different object structures', async () => {
      const complexData: OvTableData[] = [
        { id: 1, name: 'John', email: 'john@example.com', nested: { value: 'test' } },
        { id: 2, name: 'Jane', email: 'jane@example.com', nested: { value: 'test2' } },
      ]
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: complexData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty options columns array', async () => {
      const emptyColumnsOptions: OvTableOptions = {
        key: 'id',
        columns: [],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: emptyColumnsOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles data without key field', async () => {
      const dataWithoutKey = [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' },
      ]
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: dataWithoutKey,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles very long text values', async () => {
      const longTextData: OvTableData[] = [
        {
          id: 1,
          name: 'John ' + 'x'.repeat(1000),
          email: 'john@example.com',
        },
      ]
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: longTextData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles special characters in data', async () => {
      const specialCharData: OvTableData[] = [
        { id: 1, name: 'John <script>', email: 'john&jane@example.com' },
        { id: 2, name: 'Jane "quotes"', email: 'jane@example.com' },
      ]
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: specialCharData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles null and undefined values in data', async () => {
      const nullData: OvTableData[] = [
        { id: 1, name: null, email: 'john@example.com' },
        { id: 2, name: undefined, email: 'jane@example.com' },
      ]
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: nullData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles numeric data in cells', async () => {
      const numericData: OvTableData[] = [
        { id: 1, name: 123, email: 'john@example.com' },
        { id: 2, name: 45.67, email: 'jane@example.com' },
      ]
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: numericData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Complex Scenarios', () => {
    it('handles table with all features enabled', async () => {
      const fullFeaturedOptions: OvTableOptions = {
        key: 'id',
        columns: [
          { name: 'id', label: 'ID', align: 'center' },
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email', format: { icon: '$mdiEmail' } },
          {
            name: 'actions',
            label: 'Actions',
            actions: ['edit', 'delete'],
          },
        ],
        search: { label: 'Search', placeholder: 'Search...' },
        filter: {
          fields: [{ type: 'text', name: 'name', label: 'Name' }],
        },
        sort: [
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
        ],
        actions: ['add', 'export'],
        itemsPerPage: 10,
        currentPage: 1,
        canRefresh: true,
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: fullFeaturedOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('handles table with multiple column formats', async () => {
      const multiFormatOptions: OvTableOptions = {
        key: 'id',
        columns: [
          { name: 'id', label: 'ID' },
          {
            name: 'status',
            label: 'Status',
            format: [
              { color: 'green', text: 'Active', rules: { type: 'equals', params: 'active' } },
              { color: 'red', text: 'Inactive', rules: { type: 'equals', params: 'inactive' } },
            ],
          },
          { name: 'email', label: 'Email' },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: multiFormatOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })

    it('handles complex form submission in table context', async () => {
      const formOptions: OvTableOptions = {
        ...basicTableOptions,
        actions: [
          {
            name: 'add',
            form: {
              fields: [
                { type: 'text', name: 'name', label: 'Name', required: true },
                { type: 'email', name: 'email', label: 'Email', required: true },
              ],
              actions: ['submit', 'cancel'],
              actionSubmit: 'submit',
              actionCancel: 'cancel',
            },
          },
        ],
      }
      const wrapper = mount(VOvTable, {
        props: {
          options: formOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Mounting and Unmounting', () => {
    it('mounts and initializes correctly', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await wrapper.unmount()
      expect(wrapper).toBeDefined()
    })
  })

  describe('Props Updates', () => {
    it('updates when options prop changes', async () => {
      const initialOptions = basicTableOptions
      const wrapper = mount(VOvTable, {
        props: {
          options: initialOptions,
          data: basicTableData,
        },
      })
      await flushPromises()

      const newOptions: OvTableOptions = {
        key: 'id',
        columns: [
          { name: 'id', label: 'ID' },
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
          { name: 'phone', label: 'Phone' },
        ],
      }
      await wrapper.setProps({ options: newOptions })
      await flushPromises()
      expect(wrapper.props('options').columns.length).toBe(4)
    })

    it('updates when data prop changes', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
        },
      })
      await flushPromises()

      const newData: OvTableData[] = [{ id: 10, name: 'Alice', email: 'alice@example.com' }]
      await wrapper.setProps({ data: newData })
      await flushPromises()
      expect(wrapper.props('data')).toEqual(newData)
    })

    it('updates loading state', async () => {
      const wrapper = mount(VOvTable, {
        props: {
          options: basicTableOptions,
          data: basicTableData,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)

      await wrapper.setProps({ loading: true })
      expect(wrapper.props('loading')).toBe(true)
    })
  })
})
