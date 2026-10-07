import { describe, it, expect, afterEach } from 'vitest'
import { mount, flushPromises, VueWrapper } from '@vue/test-utils'
import VOvEditor from '../../src/components/forms/VOvEditor.vue'
import { globalPlugins } from './setup'

let wrapper: VueWrapper

afterEach(() => {
  wrapper?.unmount()
})

function mountEditor(props = {}) {
  wrapper = mount(VOvEditor, {
    props: { modelValue: '', ...props },
    global: { plugins: globalPlugins },
  })
  return wrapper
}

describe('VOvEditor', () => {
  it('renders with label', () => {
    const w = mountEditor({ label: 'Description' })
    expect(w.text()).toContain('Description')
  })

  it('renders toolbar buttons by default', async () => {
    const w = mountEditor()
    await flushPromises()
    const toolbar = w.find('.v-Ov-editor__toolbar')
    expect(toolbar.exists()).toBe(true)
    const buttons = toolbar.findAll('button')
    expect(buttons.length).toBe(11)
  })

  it('renders custom toolbar', async () => {
    const w = mountEditor({ toolbar: ['bold', 'italic'] })
    await flushPromises()
    const toolbar = w.find('.v-Ov-editor__toolbar')
    expect(toolbar.exists()).toBe(true)
    const buttons = toolbar.findAll('button')
    expect(buttons.length).toBe(2)
  })

  it('renders empty toolbar when toolbar prop is empty array', () => {
    const w = mountEditor({ toolbar: [] })
    expect(w.find('.v-Ov-editor__toolbar').exists()).toBe(false)
  })

  it('hides toolbar in readonly mode', () => {
    const w = mountEditor({ readonly: true })
    expect(w.find('.v-Ov-editor__toolbar').exists()).toBe(false)
  })

  it('hides toolbar in disabled mode', () => {
    const w = mountEditor({ disabled: true })
    expect(w.find('.v-Ov-editor__toolbar').exists()).toBe(false)
  })

  it('applies disabled class', () => {
    const w = mountEditor({ disabled: true })
    expect(w.find('.v-Ov-editor--disabled').exists()).toBe(true)
  })

  it('applies readonly class', () => {
    const w = mountEditor({ readonly: true })
    expect(w.find('.v-Ov-editor--readonly').exists()).toBe(true)
  })

  it('renders hint text', () => {
    const w = mountEditor({ hint: 'Write markdown here' })
    expect(w.text()).toContain('Write markdown here')
  })

  it('renders error messages', () => {
    const w = mountEditor({ errorMessages: ['Field is required'] })
    expect(w.text()).toContain('Field is required')
  })

  it('applies error class when errorMessages present', () => {
    const w = mountEditor({ errorMessages: ['error'] })
    expect(w.find('.v-Ov-editor--error').exists()).toBe(true)
  })

  it('renders counter', () => {
    const w = mountEditor({ counter: 500 })
    expect(w.text()).toContain('/ 500')
  })

  it('initializes with modelValue content', async () => {
    const w = mountEditor({ modelValue: '**bold text**' })
    await flushPromises()
    // The editor should render the content as HTML
    const content = w.find('.v-Ov-editor__content')
    expect(content.exists()).toBe(true)
  })

  it('exposes focus method', () => {
    const w = mountEditor()
    expect(typeof (w.vm as unknown as { focus: () => void }).focus).toBe('function')
  })

  it('exposes getHTML method', () => {
    const w = mountEditor()
    expect(typeof (w.vm as unknown as { getHTML: () => string }).getHTML).toBe('function')
  })

  it('exposes getMarkdown method', () => {
    const w = mountEditor()
    expect(typeof (w.vm as unknown as { getMarkdown: () => void }).getMarkdown).toBe('function')
  })

  it('getMarkdown returns markdown string', async () => {
    const w = mountEditor({ modelValue: '**hello**' })
    await flushPromises()
    const md = (w.vm as unknown as { getMarkdown: () => string }).getMarkdown()
    expect(md.replaceAll('\\', '')).toContain('**hello**')
  })

  it('emits update:modelValue on content change', async () => {
    const w = mountEditor({ modelValue: '' })
    await flushPromises()
    // Programmatically set content via the editor
    ;(
      w.vm as unknown as {
        editor?: { commands?: { setContent: (s: string) => void } }
      }
    ).editor?.commands?.setContent('new content')
    await flushPromises()
    const emitted = w.emitted('update:modelValue')
    expect(emitted).toBeTruthy()
    expect(emitted!.length).toBeGreaterThan(0)
  })

  it('updates editor when modelValue prop changes', async () => {
    const w = mountEditor({ modelValue: 'initial' })
    await flushPromises()
    await w.setProps({ modelValue: '**updated**' })
    await flushPromises()
    const md = (w.vm as unknown as { getMarkdown: () => string }).getMarkdown()
    expect(md.replaceAll('\\', '')).toContain('**updated**')
  })
})
