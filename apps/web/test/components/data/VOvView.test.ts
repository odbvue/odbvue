import { describe, it, expect, vi } from 'vitest'
import { nextTick } from 'vue'
import { mount } from '@vue/test-utils'
import VOvView from '@/components/data/VOvView.vue'
import { globalPlugins, i18n } from '../../support/components.setup'
import type { OvViewOptions } from '@/components'

function mountView(options: OvViewOptions, data = {}) {
  return mount(VOvView, {
    props: { options, data },
    global: { plugins: globalPlugins },
  })
}

describe('VOvView', () => {
  it.each(['date', 'time', 'datetime'])('formats raw ISO timestamps using %s style', (style) => {
    const timestamp = '2026-11-11T03:03:34.956221Z'
    const wrapper = mountView(
      { locale: 'en-US', items: [{ name: 'createdAt', format: { tsFormat: style } }] },
      { createdAt: timestamp },
    )
    try {
      expect(wrapper.text()).toContain(
        new Intl.DateTimeFormat('en-US', {
          ...(style !== 'time' ? { dateStyle: 'medium' } : {}),
          ...(style !== 'date' ? { timeStyle: 'medium' } : {}),
        }).format(new Date(timestamp)),
      )
      expect(wrapper.props('data').createdAt).toBe(timestamp)
    } finally {
      wrapper.unmount()
    }
  })

  it('updates timestamp presentation when the application locale changes', async () => {
    const previousLocale = i18n.global.locale.value
    i18n.global.locale.value = 'en'
    const timestamp = '2026-11-11T03:03:34.956221Z'
    const wrapper = mountView(
      { items: [{ name: 'createdAt', format: { tsFormat: 'datetime' } }] },
      { createdAt: timestamp },
    )
    try {
      i18n.global.locale.value = 'de'
      await nextTick()
      expect(wrapper.text()).toContain(
        new Intl.DateTimeFormat('de', {
          dateStyle: 'medium',
          timeStyle: 'medium',
        }).format(new Date(timestamp)),
      )
    } finally {
      wrapper.unmount()
      i18n.global.locale.value = previousLocale
    }
  })

  it('preserves calendar dates without shifting them from UTC to the previous day', () => {
    const wrapper = mountView(
      { locale: 'en-US', items: [{ name: 'date', format: { tsFormat: 'date' } }] },
      { date: '2026-11-11' },
    )
    try {
      expect(wrapper.text()).toContain('Nov 11, 2026')
    } finally {
      wrapper.unmount()
    }
  })

  it.each([null, undefined, ''])('leaves an empty date value (%s) empty', (value) => {
    const wrapper = mountView(
      { items: [{ name: 'date', format: { tsFormat: 'datetime' } }] },
      { date: value },
    )
    try {
      expect(wrapper.text()).toBe('')
    } finally {
      wrapper.unmount()
    }
  })

  it('reports invalid timestamps and keeps the original value visible', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const wrapper = mountView(
      { items: [{ name: 'date', format: { tsFormat: 'datetime' } }] },
      { date: 'not-a-date' },
    )
    try {
      expect(wrapper.text()).toContain('not-a-date')
      expect(warning).toHaveBeenCalledWith('Unable to format invalid timestamp', 'not-a-date')
    } finally {
      wrapper.unmount()
      warning.mockRestore()
    }
  })

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
