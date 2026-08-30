import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import VOvView from '../../src/components/data/VOvView.vue'
import { globalPlugins } from './setup'
import type { OvViewOptions } from '../index'

function mountView(options: OvViewOptions, data = {}) {
  return mount(VOvView, {
    props: { options, data },
    global: { plugins: globalPlugins },
  })
}

describe('VOvView', () => {
  it('renders view items with labels', () => {
    const wrapper = mountView(
      {
        items: [
          { name: 'name', label: 'Name' },
          { name: 'email', label: 'Email' },
        ],
      },
      { name: 'John', email: 'john@test.com' },
    )
    expect(wrapper.text()).toContain('Name')
    expect(wrapper.text()).toContain('John')
    expect(wrapper.text()).toContain('Email')
    expect(wrapper.text()).toContain('john@test.com')
  })

  it('renders with conditional formatting', () => {
    const wrapper = mountView(
      {
        items: [
          {
            name: 'status',
            label: 'Status',
            format: [
              {
                rules: { type: 'equals', params: 'active' },
                color: 'green',
              },
              { color: 'red' },
            ],
          },
        ],
      },
      { status: 'active' },
    )
    expect(wrapper.text()).toContain('active')
  })

  it('renders action buttons', () => {
    const wrapper = mountView(
      {
        items: [{ name: 'name', label: 'Name' }],
        actions: [{ name: 'edit', format: { text: 'Edit' } }],
      },
      { name: 'John' },
    )
    expect(wrapper.text()).toContain('Edit')
  })

  it('truncates long values and shows dots button', () => {
    const wrapper = mountView(
      {
        items: [{ name: 'desc', label: 'Description', maxLength: 10 }],
      },
      { desc: 'This is a very long description' },
    )
    // Value should be truncated
    expect(wrapper.text()).not.toContain('This is a very long description')
    expect(wrapper.text()).toContain('This is a')
  })

  it('hides item when format has hidden: true', () => {
    const wrapper = mountView(
      {
        items: [
          { name: 'secret', label: 'Secret', format: { hidden: true } },
          { name: 'visible', label: 'Visible' },
        ],
      },
      { secret: 'hidden-value', visible: 'shown' },
    )
    expect(wrapper.text()).not.toContain('hidden-value')
    expect(wrapper.text()).toContain('shown')
  })

  it('renders object values as JSON', () => {
    const wrapper = mountView(
      { items: [{ name: 'data', label: 'Data' }] },
      { data: { key: 'value' } },
    )
    expect(wrapper.text()).toContain('key')
    expect(wrapper.text()).toContain('value')
  })
})
