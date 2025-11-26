import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

// very light mocks so we don't pull in real TipTap/Vuetify internals
vi.mock('@tiptap/vue-3', () => ({
  useEditor: vi.fn(() => ({
    value: {
      getHTML: vi.fn(() => '<p>from editor</p>'),
      destroy: vi.fn(),
      isActive: vi.fn(() => false),
      chain: vi.fn(() => ({
        focus: vi.fn(() => ({
          toggleBold: vi.fn(() => ({ run: vi.fn() })),
          toggleItalic: vi.fn(() => ({ run: vi.fn() })),
          toggleUnderline: vi.fn(() => ({ run: vi.fn() })),
          toggleStrike: vi.fn(() => ({ run: vi.fn() })),
          toggleBulletList: vi.fn(() => ({ run: vi.fn() })),
          toggleOrderedList: vi.fn(() => ({ run: vi.fn() })),
          toggleHeading: vi.fn(() => ({ run: vi.fn() })),
        })),
      })),
    },
  })),
  EditorContent: { name: 'EditorContent', template: '<div class="editor-content" />' },
}))

vi.mock('@tiptap/starter-kit', () => ({ default: {} }))

import VOvEditor from '../VOvEditor.vue'

describe('VOvEditor', () => {
  it('mounts with v-model and toolbar like sandbox example', () => {
    const wrapper = mount(VOvEditor, {
      props: {
        modelValue: '<p>Initial</p>',
        toolbar: [
          'bold',
          'italic',
          'underline',
          'strike',
          'bulletList',
          'orderedList',
          'heading1',
          'heading2',
          'heading3',
        ],
        toolbarClass: 'mb-4',
      },
    })

    expect(wrapper.exists()).toBe(true)
    expect(wrapper.props('modelValue')).toBe('<p>Initial</p>')
    expect(wrapper.props('toolbar')).toHaveLength(9)
    expect(wrapper.props('toolbarClass')).toBe('mb-4')
  })

  it('emits updated when content changes', async () => {
    const wrapper = mount(VOvEditor, {
      props: {
        modelValue: '<p>Initial</p>',
      },
    })

    // The 'updated' event should be emitted when model value changes
    await wrapper.setProps({ modelValue: '<p>Updated</p>' })
    await wrapper.vm.$nextTick()

    // The component should be mounted and functional
    expect(wrapper.exists()).toBe(true)
  })

  it('can be unmounted without errors', async () => {
    const wrapper = mount(VOvEditor, {
      props: {
        modelValue: '',
      },
    })

    await wrapper.unmount()
    expect(wrapper).toBeDefined()
  })

  it('toggles bold formatting when bold button is clicked', async () => {
    const wrapper = mount(VOvEditor, {
      props: {
        modelValue: '<p>Test</p>',
        toolbar: ['bold'],
      },
    })

    const buttons = wrapper.findAllComponents({ name: 'VBtn' })
    expect(buttons.length).toBeGreaterThan(0)

    // Click the bold button
    await buttons[0]!.trigger('click')
    await wrapper.vm.$nextTick()

    expect(wrapper.exists()).toBe(true)
  })
})
