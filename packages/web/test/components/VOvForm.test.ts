import { describe, it, expect } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import VOvForm from '../../src/components/forms/VOvForm.vue'
import { globalPlugins } from './setup'
import type { OvFormOptions } from '../index'

function mountForm(options: OvFormOptions, data = {}) {
  return mount(VOvForm, {
    props: { options, data },
    global: { plugins: globalPlugins },
  })
}

describe('VOvForm', () => {
  it('renders text fields', () => {
    const wrapper = mountForm({
      fields: [
        { type: 'text', name: 'name', label: 'Name' },
        { type: 'email', name: 'email', label: 'Email' },
      ],
    })
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('Email')
  })

  it('renders with initial data', async () => {
    const wrapper = mountForm(
      {
        fields: [{ type: 'text', name: 'name', label: 'Name', value: 'John' }],
      },
      { name: 'John' },
    )
    await flushPromises()
    const input = wrapper.find('input')
    expect(input.element.value).toBe('John')
  })

  it('renders action buttons', () => {
    const wrapper = mountForm({
      fields: [{ type: 'text', name: 'name', label: 'Name' }],
      actions: ['submit', 'cancel'],
    })
    expect(wrapper.text()).toContain('submit')
    expect(wrapper.text()).toContain('cancel')
  })

  it('renders select field with items', () => {
    const wrapper = mountForm({
      fields: [
        {
          type: 'select',
          name: 'status',
          label: 'Status',
          items: ['active', 'blocked'],
        },
      ],
    })
    expect(wrapper.text()).toContain('Status')
  })

  it('renders switch field', () => {
    const wrapper = mountForm({
      fields: [{ type: 'switch', name: 'enabled', label: 'Enabled' }],
    })
    expect(wrapper.text()).toContain('Enabled')
  })

  it('renders checkbox field', () => {
    const wrapper = mountForm({
      fields: [{ type: 'checkbox', name: 'agree', label: 'I Agree' }],
    })
    expect(wrapper.text()).toContain('I Agree')
  })

  it('renders textarea field', () => {
    const wrapper = mountForm({
      fields: [{ type: 'textarea', name: 'notes', label: 'Notes', rows: 3 }],
    })
    expect(wrapper.text()).toContain('Notes')
  })

  it('renders password field with toggle', () => {
    const wrapper = mountForm({
      fields: [{ type: 'password', name: 'pwd', label: 'Password' }],
    })
    expect(wrapper.text()).toContain('Password')
  })

  it('renders number field', () => {
    const wrapper = mountForm(
      { fields: [{ type: 'number', name: 'count', label: 'Count' }] },
      { count: 42 },
    )
    expect(wrapper.text()).toContain('Count')
  })

  it('hides actions when hideActions is true', () => {
    const wrapper = mount(VOvForm, {
      props: {
        options: {
          fields: [{ type: 'text', name: 'x', label: 'X' }],
          actions: ['submit'],
        },
        hideActions: true,
      },
      global: { plugins: globalPlugins },
    })
    const buttons = wrapper.findAll('button')
    const submitBtn = buttons.find((b) => b.text().includes('submit'))
    expect(submitBtn).toBeUndefined()
  })

  it('emits cancel when cancel action clicked', async () => {
    const wrapper = mountForm({
      fields: [{ type: 'text', name: 'x', label: 'X' }],
      actions: ['cancel'],
      actionCancel: 'cancel',
    })
    const btn = wrapper.findAll('button').find((b) => b.text().includes('cancel'))
    await btn?.trigger('click')
    expect(wrapper.emitted('cancel')).toBeTruthy()
  })

  describe('Custom Fields', () => {
    // Mock component for testing
    const MockComponent = {
      name: 'MockComponent',
      template: '<div class="mock-component">Mock: {{ modelValue }}</div>',
      props: {
        modelValue: {
          type: String,
          default: '',
        },
        label: String,
        customProp: String,
        disabled: Boolean,
        readonly: Boolean,
        id: String,
        name: String,
      },
      emits: ['update:modelValue'],
    }

    it('renders custom field with component', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            label: 'Custom',
            component: MockComponent as unknown,
          },
        ],
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Mock')
    })

    it('passes props to custom component', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            label: 'Custom',
            component: MockComponent as unknown,
            props: {
              customProp: 'test-value',
            },
          },
        ],
      })
      await flushPromises()
      const component = wrapper.findComponent({ name: 'MockComponent' })
      expect(component.props('customProp')).toBe('test-value')
    })

    it('binds v-model to custom field', async () => {
      const wrapper = mountForm(
        {
          fields: [
            {
              type: 'custom',
              name: 'customField',
              label: 'Custom',
              component: MockComponent as unknown,
            },
          ],
        },
        { customField: 'initial value' },
      )
      await flushPromises()
      const component = wrapper.findComponent({ name: 'MockComponent' })
      expect(component.props('modelValue')).toBe('initial value')
    })

    it('handles custom field value updates', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            label: 'Custom',
            component: MockComponent as unknown,
          },
        ],
      })
      await flushPromises()

      // Get the custom component
      const component = wrapper.findComponent({ name: 'MockComponent' })

      // Emit update:modelValue
      await component.vm.$emit('update:modelValue', 'new value')
      await flushPromises()

      // Check that change event was emitted
      const changeEmit = wrapper.emitted('change')
      expect(changeEmit).toBeTruthy()
      expect(changeEmit?.[0]).toEqual(['customField', 'new value', expect.any(Object)])
    })

    it('supports async component loading', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'asyncField',
            label: 'Async Custom',
            component: () => Promise.resolve(MockComponent),
          },
        ],
      })
      await flushPromises()
      expect(wrapper.text()).toContain('Mock')
    })

    it('caches loaded custom components', async () => {
      const TrackedComponent = {
        ...MockComponent,
        setup() {
          return {}
        },
      }

      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'field1',
            component: () => Promise.resolve(TrackedComponent as unknown),
          },
        ],
      })
      await flushPromises()

      const form = wrapper.vm as unknown
      const cachedComponent = (form as Record<string, unknown>).customComponents

      // Verify component was loaded
      expect(cachedComponent).toBeDefined()
    })

    it('custom field includes validation rules in form', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            component: MockComponent as unknown,
            rules: [
              {
                type: 'required',
                params: true,
                message: 'This field is required',
              },
              {
                type: 'min-length',
                params: 10,
                message: 'Minimum 10 characters',
              },
            ],
          },
        ],
      })
      await flushPromises()

      // Verify rules are present in the field
      const form = wrapper.vm as unknown
      const customField = (form as Record<string, unknown>).fields
      const field = (customField as unknown[]).find(
        (f: unknown) => (f as Record<string, unknown>).name === 'customField',
      )
      expect((field as Record<string, unknown>).rules).toHaveLength(2)

      // Rules should contain the validation logic
      const formValues = (form as Record<string, unknown>).values
      expect((formValues as Record<string, unknown>).customField).toBeUndefined() // Empty field

      // Test that rule functions exist and work
      expect((field as Record<string, unknown>).rules).toBeDefined()
      const rules = (field as Record<string, unknown>).rules as
        | Array<(value: string) => string | boolean | undefined>
        | undefined
      const requiredRuleResult = rules?.[0]?.('')
      expect(typeof requiredRuleResult).toBe('string') // Should return error message
    })

    it('renders multiple custom fields', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'field1',
            component: MockComponent as unknown,
          },
          {
            type: 'text',
            name: 'textField',
            label: 'Text',
          },
          {
            type: 'custom',
            name: 'field2',
            component: MockComponent as unknown,
          },
        ],
      })
      await flushPromises()

      const mockComponents = wrapper.findAllComponents({
        name: 'MockComponent',
      })
      expect(mockComponents).toHaveLength(2)
      expect(wrapper.text()).toContain('Text')
    })

    it('handles component with default export', async () => {
      const ComponentWithDefault = {
        default: MockComponent,
      }

      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            component: () => Promise.resolve(ComponentWithDefault as unknown),
          },
        ],
      })
      await flushPromises()

      expect(wrapper.text()).toContain('Mock')
    })

    it('custom field respects label prop', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            label: 'Custom Field Label',
            component: MockComponent as unknown,
          },
        ],
      })
      await flushPromises()

      const component = wrapper.findComponent({ name: 'MockComponent' })
      expect(component.props('label')).toBe('Custom Field Label')
    })

    it('custom field respects disabled state', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            component: MockComponent as unknown,
            disabled: true,
          },
        ],
      })
      await flushPromises()

      const form = wrapper.vm as unknown
      const customField = ((form as Record<string, unknown>).fields as unknown[]).find(
        (f: unknown) => (f as Record<string, unknown>).name === 'customField',
      )
      // Disabled should be in the props passed to the component
      expect(
        ((customField as Record<string, unknown>).props as Record<string, unknown>).disabled,
      ).toBe(true)
    })

    it('custom field respects readonly state', async () => {
      const wrapper = mountForm({
        fields: [
          {
            type: 'custom',
            name: 'customField',
            component: MockComponent as unknown,
            readonly: true,
          },
        ],
      })
      await flushPromises()

      const form = wrapper.vm as unknown
      const customField = ((form as Record<string, unknown>).fields as unknown[]).find(
        (f: unknown) => (f as Record<string, unknown>).name === 'customField',
      )
      // Readonly should be in the props passed to the component
      expect(
        ((customField as Record<string, unknown>).props as Record<string, unknown>).readonly,
      ).toBe(true)
    })

    it('custom field emitted with form data on submit', async () => {
      const wrapper = mountForm(
        {
          fields: [
            {
              type: 'custom',
              name: 'customField',
              component: MockComponent as unknown,
            },
          ],
          actions: ['submit'],
          actionSubmit: 'submit',
        },
        { customField: 'submitted value' },
      )
      await flushPromises()

      // Get form and manually trigger submit
      const form = wrapper.vm as unknown
      ;(form as Record<string, unknown>).values = {
        customField: 'submitted value',
      }

      const submitBtn = wrapper.findAll('button').find((b) => b.text().includes('submit'))
      await submitBtn?.trigger('click')

      const submitEmit = wrapper.emitted('submit')
      expect(submitEmit).toBeTruthy()
      expect(submitEmit?.[0]?.[0]).toHaveProperty('customField', 'submitted value')
    })
  })
})
