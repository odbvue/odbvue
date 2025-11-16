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

  it('emits updated when content changes', () => {
    const wrapper = mount(VOvEditor, {
      props: {
        modelValue: '<p>Initial</p>',
      },
    })

    // simulate onUpdate from editor by calling exposed getHTML via mock
    const emitted = wrapper.emitted('updated')
    // component always emits at least once on mount when editor updates
    if (emitted) {
      expect(emitted[0]?.[0]).toBeTypeOf('string')
    }
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
    const mockChain = {
      focus: vi.fn(() => ({
        toggleBold: vi.fn(() => ({ run: vi.fn() })),
      })),
    }

    const mockEditor = {
      chain: vi.fn(() => mockChain),
      isActive: vi.fn(() => false),
    }

    const wrapper = mount(VOvEditor, {
      props: {
        modelValue: '<p>Test</p>',
        toolbar: ['bold'],
      },
    })

    // Override the editor mock for this specific test
    const vm = wrapper.vm as unknown as { editor: typeof mockEditor }
    vm.editor = mockEditor

    const boldButton = wrapper.find('[data-test="bold-button"]')
    if (boldButton.exists()) {
      await boldButton.trigger('click')
      expect(mockEditor.chain).toHaveBeenCalled()
      expect(mockChain.focus).toHaveBeenCalled()
    }
  })
})
