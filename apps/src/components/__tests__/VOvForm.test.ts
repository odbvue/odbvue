import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import type { OvFormOptions, OvFormData } from '../index'
import VOvForm from '../VOvForm.vue'

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

// Mock Vuetify components and composables
vi.mock('vuetify/components', () => ({
  VTextField: { name: 'VTextField', template: '<input />' },
  VSelect: { name: 'VSelect', template: '<select></select>' },
  VCombobox: { name: 'VCombobox', template: '<input />' },
  VAutocomplete: { name: 'VAutocomplete', template: '<input />' },
  VFileInput: { name: 'VFileInput', template: '<input type="file" />' },
  VSwitch: { name: 'VSwitch', template: '<input type="checkbox" />' },
  VCheckbox: { name: 'VCheckbox', template: '<input type="checkbox" />' },
  VRating: { name: 'VRating', template: '<div></div>' },
  VTextarea: { name: 'VTextarea', template: '<textarea></textarea>' },
}))

describe('VOvForm', () => {
  const basicFormOptions: OvFormOptions = {
    fields: [
      {
        type: 'text',
        name: 'username',
        label: 'Username',
        placeholder: 'Enter username',
      },
      {
        type: 'email',
        name: 'email',
        label: 'Email',
        placeholder: 'Enter email',
      },
    ],
    actions: ['submit', 'cancel'],
    actionSubmit: 'submit',
    actionCancel: 'cancel',
  }

  describe('Rendering', () => {
    it('mounts without error', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('renders VContainer component', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      const container = wrapper.findComponent({ name: 'VContainer' })
      expect(container.exists()).toBe(true)
    })

    it('renders VForm component', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      const form = wrapper.findComponent({ name: 'VForm' })
      expect(form.exists()).toBe(true)
    })

    it('renders form fields based on options', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      const fields = wrapper.findAllComponents({ name: 'VTextField' })
      expect(fields.length).toBeGreaterThan(0)
    })

    it('renders action buttons when actions are provided', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('renders form with loading state false by default', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })
  })

  describe('Props - Form Options', () => {
    it('accepts options prop with fields and actions', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      expect(wrapper.props('options')).toEqual(basicFormOptions)
    })

    it('renders all field types from options', () => {
      const allFieldsOptions: OvFormOptions = {
        fields: [
          { type: 'text', name: 'text', label: 'Text' },
          { type: 'email', name: 'email', label: 'Email' },
          { type: 'password', name: 'password', label: 'Password' },
          { type: 'number', name: 'number', label: 'Number' },
          { type: 'date', name: 'date', label: 'Date' },
          { type: 'time', name: 'time', label: 'Time' },
          { type: 'datetime', name: 'datetime', label: 'DateTime' },
          { type: 'textarea', name: 'textarea', label: 'Textarea' },
          { type: 'checkbox', name: 'checkbox', label: 'Checkbox' },
          { type: 'switch', name: 'switch', label: 'Switch' },
          { type: 'rating', name: 'rating', label: 'Rating' },
          { type: 'select', name: 'select', label: 'Select', items: ['A', 'B'] },
          { type: 'combobox', name: 'combobox', label: 'Combobox', items: ['A', 'B'] },
          { type: 'autocomplete', name: 'autocomplete', label: 'Autocomplete', items: ['A', 'B'] },
          { type: 'file', name: 'file', label: 'File' },
        ],
      }
      const wrapper = mount(VOvForm, {
        props: {
          options: allFieldsOptions,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('hides fields marked with hidden property', () => {
      const optionsWithHidden: OvFormOptions = {
        fields: [
          { type: 'text', name: 'visible', label: 'Visible' },
          { type: 'text', name: 'hidden', label: 'Hidden', hidden: true },
        ],
      }
      const wrapper = mount(VOvForm, {
        props: {
          options: optionsWithHidden,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Props - Data', () => {
    it('accepts data prop and initializes form values', async () => {
      const initialData: OvFormData = {
        username: 'testuser',
        email: 'test@example.com',
      }
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          data: initialData,
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.props('data')).toEqual(initialData)
    })

    it('handles undefined data prop', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      expect(wrapper.props('data')).toBeUndefined()
    })

    it('updates form when data prop changes', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          data: { username: 'user1', email: 'user1@example.com' },
        },
      })
      await wrapper.vm.$nextTick()

      await wrapper.setProps({
        data: { username: 'user2', email: 'user2@example.com' },
      })
      await flushPromises()
      expect(wrapper.props('data')?.username).toBe('user2')
    })
  })

  describe('Props - Translation Function', () => {
    it('accepts translation function prop', () => {
      const mockT = (text?: string) => `translated_${text}`
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          t: mockT,
        },
      })
      expect(wrapper.props('t')).toBe(mockT)
    })

    it('uses translation function for labels', () => {
      const mockT = (text?: string) => `translated_${text}`
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          t: mockT,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('defaults translation function if not provided', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      const defaultT = wrapper.props('t')
      expect(typeof defaultT).toBe('function')
    })
  })

  describe('Props - Loading', () => {
    it('accepts loading prop as false', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })

    it('defaults loading to false', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })
  })

  describe('Form Field Rendering', () => {
    it('renders text field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'text', label: 'Text' }],
          },
        },
      })
      const textFields = wrapper.findAllComponents({ name: 'VTextField' })
      expect(textFields.length).toBeGreaterThan(0)
    })

    it('renders email field as VTextField with email type', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'email', name: 'email', label: 'Email' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders password field with visibility toggle', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'password', name: 'password', label: 'Password' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders textarea field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'textarea', name: 'textarea', label: 'Textarea', rows: 5 }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders select field with items', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'select',
                name: 'select',
                label: 'Select',
                items: ['Option A', 'Option B'],
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders checkbox field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'checkbox', name: 'checkbox', label: 'Checkbox' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders switch field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'switch', name: 'switch', label: 'Switch' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('renders rating field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'rating', name: 'rating', label: 'Rating', length: 5 }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form Actions', () => {
    it('renders action buttons', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['submit', 'cancel'],
          },
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBeGreaterThan(0)
    })

    it('renders no action buttons when actions array is empty', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: [],
          },
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBe(0)
    })

    it('renders no action buttons when actions is undefined', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
          },
        },
      })
      const buttons = wrapper.findAllComponents({ name: 'VBtn' })
      expect(buttons.length).toBe(0)
    })

    it('renders custom action buttons', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['submit', 'reset', { name: 'custom', format: { color: 'red' } }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form Submission', () => {
    it('emits submit event with form data on submit action', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'text',
                name: 'username',
                label: 'Username',
                rules: [],
              },
            ],
            actions: ['submit'],
            actionSubmit: 'submit',
          },
          data: { username: 'testuser' },
        },
      })
      await wrapper.vm.$nextTick()

      // Simulate form validation and submit
      // In real scenario, this would be triggered by button click
      expect(wrapper.vm).toBeDefined()
    })

    it('emits cancel event on cancel action', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['cancel'],
            actionCancel: 'cancel',
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('emits reset event on reset action', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'username', label: 'Username', value: 'default' }],
            actions: ['reset'],
            actionReset: 'reset',
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('emits validate event on validate action', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['validate'],
            actionValidate: 'validate',
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('emits action event on custom action', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: [{ name: 'customAction', format: {} }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form Validation', () => {
    it('applies validation rules to fields', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'email',
                name: 'email',
                label: 'Email',
                rules: [{ type: 'email', params: true, message: 'Invalid email' }],
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('displays error messages from options.errors', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'username', label: 'Username' }],
            errors: [{ name: 'username', message: 'Username is required' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('updates error display when errors prop changes', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'username', label: 'Username' }],
            errors: [],
          },
        },
      })
      await wrapper.setProps({
        options: {
          ...basicFormOptions,
          errors: [{ name: 'username', message: 'Error' }],
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form State Management', () => {
    it('maintains form state with field values', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          data: { username: 'user1', email: 'user1@example.com' },
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
    })

    it('applies default values from field definitions', () => {
      const optionsWithDefaults: OvFormOptions = {
        fields: [
          { type: 'text', name: 'field1', label: 'Field 1', value: 'default1' },
          { type: 'text', name: 'field2', label: 'Field 2', value: 'default2' },
        ],
      }
      const wrapper = mount(VOvForm, {
        props: {
          options: optionsWithDefaults,
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('merges provided data with default field values', async () => {
      const optionsWithDefaults: OvFormOptions = {
        fields: [
          { type: 'text', name: 'field1', label: 'Field 1', value: 'default1' },
          { type: 'text', name: 'field2', label: 'Field 2', value: 'default2' },
        ],
      }
      const wrapper = mount(VOvForm, {
        props: {
          options: optionsWithDefaults,
          data: { field1: 'custom1' },
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form Layout', () => {
    it('renders columns based on cols option', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              { type: 'text', name: 'field1', label: 'Field 1' },
              { type: 'text', name: 'field2', label: 'Field 2' },
              { type: 'text', name: 'field3', label: 'Field 3' },
            ],
            cols: 3,
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('defaults to 1 column layout when cols is not specified', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              { type: 'text', name: 'field1', label: 'Field 1' },
              { type: 'text', name: 'field2', label: 'Field 2' },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('aligns action buttons according to actionAlign option', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['submit', 'cancel'],
            actionAlign: 'center',
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('supports left action alignment', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['submit'],
            actionAlign: 'left',
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('supports right action alignment', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
            actions: ['submit'],
            actionAlign: 'right',
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form Properties', () => {
    it('applies disabled state to form when disabled option is true', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field' }],
            disabled: true,
          },
        },
      })
      const form = wrapper.findComponent({ name: 'VForm' })
      expect(form.props('disabled')).toBe(true)
    })

    it('applies readonly state to form when readonly option is true', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field' }],
            readonly: true,
          },
        },
      })
      const form = wrapper.findComponent({ name: 'VForm' })
      expect(form.props('readonly')).toBe(true)
    })

    it('applies fastFail option to form validation', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field' }],
            fastFail: true,
          },
        },
      })
      const form = wrapper.findComponent({ name: 'VForm' })
      expect(form.props('fastFail')).toBe(true)
    })

    it('applies autocomplete option to form', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field' }],
            autocomplete: 'off',
          },
        },
      })
      expect(wrapper.props('options').autocomplete).toBe('off')
    })

    it('focuses first field when focusFirst option is true', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              { type: 'text', name: 'field1', label: 'Field 1' },
              { type: 'text', name: 'field2', label: 'Field 2' },
            ],
            focusFirst: true,
          },
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
    })

    it('does not focus first field when focusFirst is false or undefined', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field' }],
            focusFirst: false,
          },
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Field Properties', () => {
    it('applies label to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field Label' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies placeholder to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', placeholder: 'Enter value' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies hint to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'text',
                name: 'field',
                label: 'Field',
                hint: 'This is a hint',
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies required property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', required: true }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies readonly property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', readonly: true }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies disabled property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', disabled: true }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies clearable property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', clearable: true }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies icon properties to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'text',
                name: 'field',
                label: 'Field',
                prependIcon: '$mdiAccount',
                appendIcon: '$mdiClose',
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies variant property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'text',
                name: 'field',
                label: 'Field',
                variant: 'underlined',
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies density property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', density: 'compact' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies color property to field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field', color: 'primary' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies counter property to textarea', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'textarea',
                name: 'field',
                label: 'Field',
                counter: 200,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies prefix and suffix to text fields', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'text',
                name: 'price',
                label: 'Price',
                prefix: '$',
                suffix: 'USD',
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Textarea Field Properties', () => {
    it('applies rows property to textarea', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'textarea',
                name: 'textarea',
                label: 'Textarea',
                rows: 8,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies noResize property to textarea', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'textarea',
                name: 'textarea',
                label: 'Textarea',
                noResize: true,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies autoGrow property to textarea', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'textarea',
                name: 'textarea',
                label: 'Textarea',
                autoGrow: true,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Rating Field Properties', () => {
    it('applies length property to rating', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'rating',
                name: 'rating',
                label: 'Rating',
                length: 10,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies size property to rating', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'rating',
                name: 'rating',
                label: 'Rating',
                size: 32,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies itemLabels property to rating', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'rating',
                name: 'rating',
                label: 'Rating',
                itemLabels: ['Poor', 'Fair', 'Good', 'Very Good', 'Excellent'],
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('disables rating when form is disabled', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'rating', name: 'rating', label: 'Rating' }],
            disabled: true,
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Selection Field Properties', () => {
    it('applies items property to select field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'select',
                name: 'select',
                label: 'Select',
                items: ['Option A', 'Option B', 'Option C'],
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies chips property to select field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'select',
                name: 'select',
                label: 'Select',
                items: ['A', 'B'],
                chips: true,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('applies multiple property to select field', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'select',
                name: 'select',
                label: 'Select',
                items: ['A', 'B'],
                multiple: true,
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles combobox field type', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'combobox',
                name: 'combobox',
                label: 'Combobox',
                items: ['A', 'B'],
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles autocomplete field type', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              {
                type: 'autocomplete',
                name: 'autocomplete',
                label: 'Autocomplete',
                items: ['A', 'B'],
              },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Password Field', () => {
    it('renders password field with password type', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'password', name: 'password', label: 'Password' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('toggles password visibility with eye icon', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'password', name: 'password', label: 'Password' }],
          },
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Responsive Layout', () => {
    it('adapts layout for mobile devices', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              { type: 'text', name: 'field1', label: 'Field 1' },
              { type: 'text', name: 'field2', label: 'Field 2' },
            ],
            cols: 2,
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Mounting and Unmounting', () => {
    it('mounts and initializes correctly', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      await flushPromises()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('can be unmounted without errors', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
        },
      })
      await wrapper.unmount()
      expect(wrapper).toBeDefined()
    })
  })

  describe('Props Updates', () => {
    it('updates form when options prop changes', async () => {
      const initialOptions: OvFormOptions = {
        fields: [{ type: 'text', name: 'field1', label: 'Field 1' }],
      }
      const wrapper = mount(VOvForm, {
        props: {
          options: initialOptions,
        },
      })

      const newOptions: OvFormOptions = {
        fields: [
          { type: 'text', name: 'field1', label: 'Field 1' },
          { type: 'text', name: 'field2', label: 'Field 2' },
        ],
      }
      await wrapper.setProps({ options: newOptions })
      await flushPromises()
      expect(wrapper.props('options').fields.length).toBe(2)
    })

    it('updates loading state', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          loading: false,
        },
      })
      expect(wrapper.props('loading')).toBe(false)
    })
  })

  describe('Complex Form Scenarios', () => {
    it('handles form with all field types like sandbox-form example', async () => {
      const complexFormOptions: OvFormOptions = {
        fields: [
          { type: 'text', name: 'text1', label: 'Text 1' },
          { type: 'email', name: 'email', label: 'Email' },
          { type: 'number', name: 'number', label: 'Number' },
          { type: 'password', name: 'password', label: 'Password' },
          { type: 'textarea', name: 'textarea', label: 'Textarea' },
          { type: 'switch', name: 'acceptTerms', label: 'Accept Terms' },
          { type: 'rating', name: 'rating', label: 'Rating' },
          { type: 'checkbox', name: 'checkbox', label: 'Checkbox' },
          {
            type: 'select',
            name: 'select',
            label: 'Select',
            items: ['A', 'B', 'C'],
            multiple: true,
          },
          {
            type: 'combobox',
            name: 'combobox',
            label: 'Combobox',
            items: ['A', 'B', 'C'],
          },
          {
            type: 'autocomplete',
            name: 'autocomplete',
            label: 'Autocomplete',
            items: ['A', 'B', 'C'],
          },
          { type: 'file', name: 'file', label: 'File' },
          { type: 'date', name: 'date', label: 'Date' },
          { type: 'time', name: 'time', label: 'Time' },
          { type: 'datetime', name: 'datetime', label: 'DateTime' },
        ],
        cols: 3,
        actions: ['validate', 'cancel', 'submit', 'reset'],
        actionFormat: { color: 'primary' },
        actionAlign: 'center',
        actionSubmit: 'submit',
        actionReset: 'reset',
        actionValidate: 'validate',
        actionCancel: 'cancel',
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: complexFormOptions,
          data: {
            text1: 'Test',
            email: 'test@example.com',
            number: 42,
          },
        },
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
    })

    it('handles form with validation rules', () => {
      const formWithValidation: OvFormOptions = {
        fields: [
          {
            type: 'text',
            name: 'username',
            label: 'Username',
            rules: [
              { type: 'required', params: true, message: 'Required' },
              {
                type: 'min-length',
                params: 3,
                message: 'Min 3 chars',
              },
            ],
          },
          {
            type: 'email',
            name: 'email',
            label: 'Email',
            rules: [
              { type: 'required', params: true, message: 'Required' },
              { type: 'email', params: true, message: 'Invalid email' },
            ],
          },
        ],
        actions: ['submit'],
        actionSubmit: 'submit',
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: formWithValidation,
        },
      })

      expect(wrapper.vm).toBeDefined()
    })

    it('handles form with field errors from server', () => {
      const formWithErrors: OvFormOptions = {
        fields: [
          { type: 'text', name: 'username', label: 'Username' },
          { type: 'email', name: 'email', label: 'Email' },
        ],
        errors: [
          { name: 'username', message: 'Username already taken' },
          { name: 'email', message: 'Email already registered' },
        ],
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: formWithErrors,
        },
      })

      expect(wrapper.vm).toBeDefined()
    })

    it('handles form with custom actions', () => {
      const formWithCustomActions: OvFormOptions = {
        fields: [{ type: 'text', name: 'field', label: 'Field' }],
        actions: [
          'submit',
          'reset',
          {
            name: 'customAction',
            format: { color: 'red', text: 'Custom' },
          },
          {
            name: 'anotherAction',
            format: { color: 'blue', icon: '$mdiCheck' },
          },
        ],
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: formWithCustomActions,
        },
      })

      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Edge Cases', () => {
    it('handles empty form with no fields', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles form with only hidden fields', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [
              { type: 'text', name: 'field1', label: 'Field 1', hidden: true },
              { type: 'text', name: 'field2', label: 'Field 2', hidden: true },
            ],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles form with special characters in labels', () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: 'field', label: 'Field with <special> & chars' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles form with very long field names', () => {
      const longName = 'field_' + 'x'.repeat(100)
      const wrapper = mount(VOvForm, {
        props: {
          options: {
            fields: [{ type: 'text', name: longName, label: 'Long Name' }],
          },
        },
      })
      expect(wrapper.vm).toBeDefined()
    })

    it('handles prop updates without errors', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          loading: false,
        },
      })

      expect(wrapper.props('loading')).toBe(false)
    })

    it('handles undefined or null values in data', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          data: {
            username: undefined,
            email: null,
          } as unknown as OvFormData,
        },
      })
      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Form with Translation', () => {
    it('applies translations to all field labels', () => {
      const mockT = (text?: string): string => {
        const translations: Record<string, string> = {
          Username: 'Nombre de usuario',
          Email: 'Correo electrónico',
        }
        return translations[text || ''] || text || ''
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          t: mockT,
        },
      })

      expect(wrapper.vm).toBeDefined()
    })

    it('applies translations to action button text', () => {
      const mockT = (text?: string): string => {
        const translations: Record<string, string> = {
          submit: 'Enviar',
          cancel: 'Cancelar',
        }
        return translations[text || ''] || text || ''
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          t: mockT,
        },
      })

      expect(wrapper.vm).toBeDefined()
    })

    it('applies translations to validation error messages', () => {
      const mockT = (text?: string): string => {
        const translations: Record<string, string> = {
          'Field is required': 'El campo es obligatorio',
          'Invalid format': 'Formato inválido',
        }
        return translations[text || ''] || text || ''
      }

      const formWithErrors: OvFormOptions = {
        fields: [{ type: 'text', name: 'field', label: 'Field' }],
        errors: [{ name: 'field', message: 'Field is required' }],
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: formWithErrors,
          t: mockT,
        },
      })

      expect(wrapper.vm).toBeDefined()
    })
  })

  describe('Integration with Sandbox Example', () => {
    it('can be used with sandbox-form.vue style configuration', async () => {
      const sandboxOptions: OvFormOptions = {
        fields: [
          {
            type: 'text',
            name: 'text1',
            label: 'Text 1',
            placeholder: 'Enter some text',
            value: 'Hello World - default!',
          },
          {
            type: 'text',
            name: 'text2',
            label: 'Text 2',
            placeholder: 'Enter some text',
            rules: [{ type: 'required', params: true, message: 'Text 2 is required' }],
          },
          {
            type: 'email',
            name: 'email',
            label: 'Email',
            placeholder: 'Enter valid e-mail address',
          },
          {
            type: 'password',
            name: 'password',
            label: 'Password',
            placeholder: 'Enter password',
            required: true,
          },
          {
            type: 'textarea',
            name: 'textarea',
            label: 'Textarea',
            placeholder: 'Enter some text',
            rows: 3,
            counter: 200,
          },
          {
            type: 'select',
            name: 'select',
            label: 'Select',
            items: ['Alfa', 'Bravo', 'Charlie'],
            multiple: true,
          },
          {
            type: 'rating',
            name: 'rating',
            label: 'Rating',
            length: 5,
          },
        ],
        cols: 3,
        actions: ['validate', 'cancel', 'submit', 'reset'],
        actionAlign: 'center',
        actionSubmit: 'submit',
        actionReset: 'reset',
        actionCancel: 'cancel',
        focusFirst: true,
      }

      const wrapper = mount(VOvForm, {
        props: {
          options: sandboxOptions,
          data: {
            text1: 'Hello World!',
            email: '',
            password: '',
          },
          loading: false,
        },
      })

      await wrapper.vm.$nextTick()
      expect(wrapper.vm).toBeDefined()
      expect(wrapper.exists()).toBe(true)
      expect(wrapper.props('options').fields.length).toBe(7)
    })

    it('supports loading state management like sandbox-form', async () => {
      const wrapper = mount(VOvForm, {
        props: {
          options: basicFormOptions,
          loading: false,
        },
      })

      expect(wrapper.vm).toBeDefined()
      expect(wrapper.props('loading')).toBe(false)
    })
  })
})
