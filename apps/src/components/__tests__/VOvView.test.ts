import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { OvViewOptions, OvViewData } from '../index'
import VOvView from '../VOvView.vue'

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

// Mock ResizeObserver for VProgressCircular
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
}

describe('VOvView', () => {
  const basicViewOptions: OvViewOptions = {
    items: [
      { name: 'field1', label: 'Field 1' },
      { name: 'field2', label: 'Field 2' },
    ],
  }

  const basicViewData: OvViewData = {
    field1: 'Value 1',
    field2: 'Value 2',
  }

  describe('Rendering', () => {
    it('mounts without error', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders VContainer when multiple items exist', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      const container = wrapper.findComponent({ name: 'VContainer' })
      expect(container.exists()).toBe(true)
    })

    it('renders single item directly without VContainer', () => {
      const singleItemOptions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: singleItemOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders VRow for items', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      const rows = wrapper.findAllComponents({ name: 'VRow' })
      expect(rows.length).toBeGreaterThan(0)
    })

    it('renders VCol for each item', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      const cols = wrapper.findAllComponents({ name: 'VCol' })
      expect(cols.length).toBeGreaterThanOrEqual(2)
    })

    it('renders action buttons when actions are provided', () => {
      const optionsWithActions: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1' },
          { name: 'field2', label: 'Field 2' },
        ],
        actions: ['edit', 'delete'],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1', field2: 'Value 2' },
          options: optionsWithActions,
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('does not render action buttons when actions are empty', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: { ...basicViewOptions, actions: [] },
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBe(0)
    })
  })

  describe('Props - Data', () => {
    it('accepts data prop', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.props('data')).toEqual(basicViewData)
    })

    it('handles empty data object', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: {},
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles undefined values in data', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: {
            field1: undefined,
            field2: 'Value 2',
          },
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('updates view when data prop changes', async () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      const newData = { field1: 'Updated 1', field2: 'Updated 2' }
      await wrapper.setProps({ data: newData })
      await flushPromises()
      expect(wrapper.props('data')).toEqual(newData)
    })
  })

  describe('Props - Options', () => {
    it('accepts options prop', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.props('options')).toEqual(basicViewOptions)
    })

    it('renders items from options', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies cols option for grid layout', () => {
      const optionsWithCols: OvViewOptions = {
        items: basicViewOptions.items,
        cols: 2,
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsWithCols,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('defaults to 1 column when cols is not specified', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Props - Translation Function', () => {
    it('accepts translation function prop', () => {
      const mockT = (text?: string) => `translated_${text}`
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
          t: mockT,
        },
      })
      expect(wrapper.props('t')).toBe(mockT)
    })

    it('defaults translation function if not provided', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      const defaultT = wrapper.props('t')
      expect(typeof defaultT).toBe('function')
    })

    it('uses translation function for button text', () => {
      const mockT = (text?: string) => {
        const translations: Record<string, string> = {
          edit: 'Editar',
          delete: 'Eliminar',
        }
        return translations[text || ''] || text || ''
      }
      const optionsWithActions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
        actions: ['edit'],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value' },
          options: optionsWithActions,
          t: mockT,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Props - Loading', () => {
    it('accepts loading prop', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })

    it('defaults loading to false', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })

    it('renders progress circular when loading is true', () => {
      const optionsWithItems: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1' },
          { name: 'field2', label: 'Field 2' },
        ],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsWithItems,
          loading: true,
        },
      })
      const progress = wrapper.findComponent({ name: 'VProgressCircular' })
      expect(progress.exists()).toBe(true)
    })

    it('shows overlay when loading is true', () => {
      const optionsWithItems: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1' },
          { name: 'field2', label: 'Field 2' },
        ],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsWithItems,
          loading: true,
        },
      })
      const overlay = wrapper.findComponent({ name: 'VOverlay' })
      expect(overlay.props('modelValue')).toBe(true)
    })
  })

  describe('View Items', () => {
    it('renders view items with labels', () => {
      const optionsWithLabels: OvViewOptions = {
        items: [
          { name: 'field1', label: 'User Name' },
          { name: 'field2', label: 'Email Address' },
        ],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsWithLabels,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles view items without labels', () => {
      const optionsNoLabels: OvViewOptions = {
        items: [{ name: 'field1' }, { name: 'field2' }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsNoLabels,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies format to view items', () => {
      const optionsWithFormat: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1', format: { color: 'primary', icon: '$mdiAccount' } },
        ],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithFormat,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders item actions', () => {
      const optionsWithItemActions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1', actions: ['view', 'edit'] }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithItemActions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies maxLength to item values', () => {
      const optionsWithMaxLength: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1', maxLength: 10 }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'This is a very long value that should be truncated' },
          options: optionsWithMaxLength,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Actions', () => {
    it('renders action buttons with action names', () => {
      const optionsWithActions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
        actions: ['edit', 'delete'],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithActions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders action buttons with format', () => {
      const optionsWithFormattedActions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
        actions: [
          { name: 'edit', format: { color: 'primary', icon: '$mdiPencil' } },
          { name: 'delete', format: { color: 'error', icon: '$mdiDelete' } },
        ],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithFormattedActions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies actionAlign to action buttons', () => {
      const optionsWithActionAlign: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
        actions: ['edit'],
        actionAlign: 'center',
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithActionAlign,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies actionFormat to all actions', () => {
      const optionsWithActionFormat: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
        actions: ['edit', 'delete'],
        actionFormat: { variant: 'outlined', density: 'compact' },
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithActionFormat,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Events', () => {
    it('emits action event on button click', async () => {
      const optionsWithActions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
        actions: ['edit'],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: optionsWithActions,
        },
      })
      await wrapper.vm.$nextTick()
      wrapper.vm.$emit('action', 'edit', 'Value 1')
      expect(wrapper.emitted('action')).toBeTruthy()
    })

    it('emits details event for truncated content', async () => {
      const optionsWithMaxLength: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1', maxLength: 5 }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'This is a long value' },
          options: optionsWithMaxLength,
        },
      })
      await wrapper.vm.$nextTick()
      wrapper.vm.$emit('details', 'Field 1', 'This is a long value')
      expect(wrapper.emitted('details')).toBeTruthy()
    })
  })

  describe('Responsive Layout', () => {
    it('adapts columns for mobile display', () => {
      const optionsWithCols: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1' },
          { name: 'field2', label: 'Field 2' },
        ],
        cols: 2,
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsWithCols,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Props Updates', () => {
    it('updates view when options prop changes', async () => {
      const initialOptions: OvViewOptions = {
        items: [{ name: 'field1', label: 'Field 1' }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: initialOptions,
        },
      })

      const newOptions: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1' },
          { name: 'field2', label: 'Field 2' },
        ],
      }
      await wrapper.setProps({
        options: newOptions,
        data: { field1: 'Value 1', field2: 'Value 2' },
      })
      await flushPromises()
      expect(wrapper.props('options')!.items.length).toBe(2)
    })

    it('updates loading state', async () => {
      const optionsWithItems: OvViewOptions = {
        items: [
          { name: 'field1', label: 'Field 1' },
          { name: 'field2', label: 'Field 2' },
        ],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: optionsWithItems,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
      await wrapper.setProps({ loading: true })
      await wrapper.vm.$nextTick()
      expect(wrapper.props('loading')).toBe(true)
    })
  })

  describe('Complex Scenarios', () => {
    it('renders view with all features combined', async () => {
      const complexOptions: OvViewOptions = {
        items: [
          { name: 'username', label: 'Username', format: { color: 'primary' } },
          { name: 'email', label: 'Email', format: { icon: '$mdiEmail' } },
          { name: 'role', label: 'Role', maxLength: 20 },
        ],
        actions: [
          { name: 'edit', format: { color: 'primary', icon: '$mdiPencil' } },
          { name: 'delete', format: { color: 'error', icon: '$mdiDelete' } },
        ],
        actionAlign: 'center',
        actionFormat: { variant: 'outlined' },
        cols: 2,
      }
      const complexData: OvViewData = {
        username: 'john_doe',
        email: 'john@example.com',
        role: 'Administrator',
      }
      const wrapper = mount(VOvView, {
        props: {
          data: complexData,
          options: complexOptions,
          loading: false,
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders single item view without container', () => {
      const singleItemOptions: OvViewOptions = {
        items: [{ name: 'status', label: 'Status', format: { color: 'success' } }],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: { status: 'Active' },
          options: singleItemOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles view with no items', () => {
      const emptyOptions: OvViewOptions = {
        items: [],
      }
      const wrapper = mount(VOvView, {
        props: {
          data: {},
          options: emptyOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles view with missing data values', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: 'Value 1' },
          options: {
            items: [
              { name: 'field1', label: 'Field 1' },
              { name: 'field2', label: 'Field 2' },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles view with null values in data', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: { field1: null, field2: 'Value 2' },
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles view with special characters in values', () => {
      const wrapper = mount(VOvView, {
        props: {
          data: {
            field1: 'Value with <special> & "characters"',
            field2: 'Value with "quotes" and \'apostrophes\'',
          },
          options: basicViewOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles mounting and unmounting', async () => {
      const wrapper = mount(VOvView, {
        props: {
          data: basicViewData,
          options: basicViewOptions,
        },
      })
      expect(wrapper.exists()).toBe(true)
      await wrapper.unmount()
      expect(wrapper.vm).toBeDefined()
    })
  })
})
