<template>
  <div
    ref="editorRoot"
    class="v-input v-input--horizontal v-input--density-default v-ov-editor"
    :class="{ 'v-input--disabled': props.disabled }"
  >
    <div class="v-input__control">
      <div
        class="v-field v-field--variant-outlined v-ov-editor-wrapper"
        :class="{ 'v-field--disabled': props.disabled, 'v-field--focused': isFocused }"
      >
        <div class="v-field__overlay"></div>
        <div class="v-field__field">
          <div class="v-ov-editor-content" :class="{ 'pt-2': props.label }">
            <div
              v-if="!props.readonly && toolbarButtons.length > 0"
              class="editor-toolbar"
              :class="props.toolbarClass"
            >
              <v-btn
                v-for="btn in toolbarButtons"
                :key="btn.id"
                :variant="isActive(btn) ? 'outlined' : 'text'"
                density="comfortable"
                :disabled="props.disabled"
                @click="handleClick(btn)"
                :icon="btn.icon"
              />
            </div>
            <editor-content
              :editor="editor"
              :class="props.editorClass"
              class="editor-content"
              :style="editorContentStyle"
              @focus="isFocused = true"
              @blur="isFocused = false"
            />
          </div>
        </div>
        <div class="v-field__outline">
          <div class="v-field__outline__start"></div>
          <div v-if="props.label" class="v-field__outline__notch">
            <label class="v-label v-field-label v-field-label--floating" aria-hidden="true">
              {{ props.label }}
            </label>
          </div>
          <div class="v-field__outline__end"></div>
        </div>
      </div>
    </div>
    <div v-if="props.hint && !props.hideDetails" class="v-input__details">
      <div class="v-messages">
        <div class="v-messages__message">{{ props.hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { computed, onBeforeUnmount, ref, watch, onMounted, type PropType } from 'vue'
import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'
import pretty from 'pretty'
import type { ValidationRule } from 'vuetify/lib/composables/validation.mjs'
import type { ImageUrlResult } from '@/components/index'

defineOptions({
  inheritAttrs: false,
})

const model = defineModel({ type: String, default: '' })
const isFocused = ref(false)
const editorRoot = ref<HTMLElement | null>(null)

const turndown = new TurndownService()
const markdownIt = new MarkdownIt()

// Add custom rule to convert img tags back to markdown format
turndown.addRule('imageUrl', {
  filter: (node) => {
    return node.nodeName === 'IMG'
  },
  replacement: (content, node) => {
    const img = node as HTMLImageElement
    const alt = img.alt || 'image'
    let src = img.src

    // Check if it's a blob URL - extract the image ID from data attribute if available
    if (src.startsWith('blob:')) {
      // Get the original API path from data attribute
      const originalSrc = img.getAttribute('data-original-src')
      if (originalSrc) {
        src = originalSrc
      } else {
        // Fallback: can't recover the original URL from blob
        console.warn('Blob URL without data-original-src attribute:', src)
        return `![${alt}](${src})`
      }
    } else {
      // Extract relative path from full URL to ensure portability
      try {
        const url = new URL(src)
        src = url.pathname // Get just the path, e.g., /api/tra/image/id
      } catch {
        // If it's already a relative path, keep it as-is
      }
    }
    return `![${alt}](${src})`
  },
})

const props = defineProps({
  // Vuetify input field props
  id: {
    type: String,
    default: undefined,
  },
  label: {
    type: String,
    default: undefined,
  },
  hint: {
    type: String,
    default: undefined,
  },
  persistentHint: {
    type: Boolean,
    default: true,
  },
  rules: {
    type: Array as () => ValidationRule[],
    default: () => [],
  },
  errorMessages: {
    type: [String, Array] as unknown as () => string | string[],
    default: () => [],
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  readonly: {
    type: Boolean,
    default: false,
  },
  density: {
    type: String as () => 'default' | 'comfortable' | 'compact',
    default: 'default',
  },
  hideDetails: {
    type: [Boolean, String] as unknown as () => boolean | 'auto',
    default: false,
  },
  // Editor-specific props
  toolbar: {
    type: Array<string>,
    default: () => [],
  },
  toolbarClass: {
    type: String,
    default: '',
  },
  editorClass: {
    type: String,
    default: '',
  },
  outputFormat: {
    type: String as () => 'html' | 'markdown',
    default: 'html',
  },
  maxHeight: {
    type: String,
    default: undefined,
  },
  imageUploader: {
    type: Function as PropType<(base64Data: string) => Promise<string | null>>,
    default: undefined,
  },
  imageUrlResolver: {
    type: Function as PropType<(imageId: string) => Promise<ImageUrlResult>>,
    default: undefined,
  },
  class: {
    type: String,
    default: '',
  },
})

const emits = defineEmits(['updated', 'keyup', 'imageUpload'])

// Image upload handler
const uploadImage = async (file: File): Promise<string | null> => {
  if (!props.imageUploader) {
    console.warn('Image upload not configured: imageUploader prop is not set')
    return null
  }
  try {
    const base64 = await fileToBase64(file)
    return await props.imageUploader(base64)
  } catch (error) {
    console.error('Image upload failed:', error)
    return null
  }
}

// Helper to convert file to base64
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1] || ''
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// Convert markdown to HTML for editor display
const mdToHtml = (md: string): string => {
  if (!md) return ''
  // Handle both tra-image:id references and direct /api/tra/image/id URLs
  const withImageUrls = md.replace(
    /!\[([^\]]*)\]\(tra-image:([a-f0-9-]+)\)/g,
    '![$1](/api/tra/image/$2)',
  )
  // MarkdownIt will properly render ![alt](url) syntax to <img> tags
  return markdownIt.render(withImageUrls)
}

// Convert HTML to markdown for output
const htmlToMd = (html: string): string => {
  if (!html) return ''
  return turndown.turndown(html)
}

// Get initial content based on input format
const getInitialContent = (): string => {
  if (props.outputFormat === 'markdown') {
    return mdToHtml(model.value)
  }
  return model.value
}

// Computed style for editor content area
const editorContentStyle = computed(() => {
  if (!props.maxHeight) return undefined
  return {
    maxHeight: props.maxHeight,
    overflowY: 'auto' as const,
  }
})

interface ToolbarButton {
  id: string
  icon: string
  action: (editor: Editor) => void
  isActive?: (editor: Editor) => boolean
}

const buttonConfig: Record<string, ToolbarButton> = {
  bold: {
    id: 'bold',
    icon: '$mdiFormatBold',
    action: (editor) => editor.chain().focus().toggleBold().run(),
    isActive: (editor) => editor.isActive('bold'),
  },
  italic: {
    id: 'italic',
    icon: '$mdiFormatItalic',
    action: (editor) => editor.chain().focus().toggleItalic().run(),
    isActive: (editor) => editor.isActive('italic'),
  },
  underline: {
    id: 'underline',
    icon: '$mdiFormatUnderline',
    action: (editor) => editor.chain().focus().toggleUnderline().run(),
    isActive: (editor) => editor.isActive('underline'),
  },
  strike: {
    id: 'strike',
    icon: '$mdiFormatStrikethrough',
    action: (editor) => editor.chain().focus().toggleStrike().run(),
    isActive: (editor) => editor.isActive('strike'),
  },
  bulletList: {
    id: 'bulletList',
    icon: '$mdiFormatListBulleted',
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
    isActive: (editor) => editor.isActive('bulletList'),
  },
  orderedList: {
    id: 'orderedList',
    icon: '$mdiFormatListNumbered',
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
    isActive: (editor) => editor.isActive('orderedList'),
  },
  heading1: {
    id: 'heading1',
    icon: '$mdiFormatHeader1',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 1 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 1 }),
  },
  heading2: {
    id: 'heading2',
    icon: '$mdiFormatHeader2',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 2 }),
  },
  heading3: {
    id: 'heading3',
    icon: '$mdiFormatHeader3',
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
    isActive: (editor) => editor.isActive('heading', { level: 3 }),
  },
  blockquote: {
    id: 'blockquote',
    icon: '$mdiFormatQuoteClose',
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
    isActive: (editor) => editor.isActive('blockquote'),
  },
  image: {
    id: 'image',
    icon: '$mdiImage',
    action: () => {
      if (!props.imageUploader || !props.imageUrlResolver) {
        console.warn(
          'Image upload not configured: imageUploader and imageUrlResolver props are required',
        )
        return
      }
      const resolver = props.imageUrlResolver
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = 'image/*'
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (file) {
          const imageId = await uploadImage(file)
          if (imageId && editor.value) {
            const { displayUrl, storageUrl } = await resolver(imageId)
            // Insert image with display URL as src and storage URL as data attribute
            editor.value
              .chain()
              .focus()
              .insertContent(
                `<img src="${displayUrl}" alt="${file.name}" data-original-src="${storageUrl}" />`,
              )
              .run()
            emits('imageUpload', imageId)
          }
        }
      }
      input.click()
    },
  },
}

const editor = useEditor({
  content: getInitialContent(),
  extensions: [
    StarterKit,
    Image.configure({
      inline: true,
      allowBase64: false,
    }),
  ],
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    const output = props.outputFormat === 'markdown' ? htmlToMd(html) : html
    model.value = output
    emits('updated', output)
  },
})

// Handle image paste via DOM event listener
const handleEditorPaste = async (event: ClipboardEvent) => {
  if (!props.imageUploader || !props.imageUrlResolver) return
  if (!event.clipboardData) return

  const resolver = props.imageUrlResolver
  const files = event.clipboardData.files
  const imageFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))

  if (imageFiles.length === 0) return

  event.preventDefault()

  // Handle first image paste
  const imageFile = imageFiles[0] as File
  const imageId = await uploadImage(imageFile)

  if (imageId && editor.value) {
    const { displayUrl, storageUrl } = await resolver(imageId)
    // Insert image with display URL as src and storage URL as data attribute
    editor.value
      .chain()
      .focus()
      .insertContent(
        `<img src="${displayUrl}" alt="${imageFile.name}" data-original-src="${storageUrl}" />`,
      )
      .run()
    emits('imageUpload', imageId)
  }
}

// Attach paste listener when editor is ready
onMounted(() => {
  if (editorRoot.value) {
    editorRoot.value.addEventListener('paste', handleEditorPaste as unknown as EventListener)
  }
})

onBeforeUnmount(() => {
  if (editorRoot.value) {
    editorRoot.value.removeEventListener('paste', handleEditorPaste as unknown as EventListener)
  }
  if (editor) {
    editor.value?.destroy()
  }
})

// Watch for external model changes and update editor content
let isInternalUpdate = false
watch(
  () => model.value,
  (newValue) => {
    if (isInternalUpdate) {
      isInternalUpdate = false
      return
    }
    if (!editor.value?.commands) return

    const currentContent =
      props.outputFormat === 'markdown' ? htmlToMd(editor.value.getHTML()) : editor.value.getHTML()

    if (newValue !== currentContent) {
      const htmlContent = props.outputFormat === 'markdown' ? mdToHtml(newValue) : newValue
      editor.value.commands.setContent(htmlContent, { emitUpdate: false })
    }
  },
)

const toolbarButtons = computed(() =>
  props.toolbar.map((id) => buttonConfig[id]).filter((btn): btn is ToolbarButton => Boolean(btn)),
)

const isActive = (btn: ToolbarButton) => {
  if (!editor.value || !btn.isActive) return false
  return btn.isActive(editor.value)
}

const handleClick = (btn: ToolbarButton) => {
  if (editor.value) {
    try {
      btn.action(editor.value)
    } catch (error) {
      console.error(`Error executing button action: ${btn.id}`, error)
    }
  }
}

onBeforeUnmount(() => {
  if (editorRoot.value) {
    editorRoot.value.removeEventListener(
      'paste',
      handleEditorPaste as unknown as unknown as EventListener,
    )
  }
  if (editor) {
    editor.value?.destroy()
  }
})

const focus = (position: 'start' | 'end' | number = 'end') => {
  if (editor.value) {
    editor.value.commands.focus(position)
  } else if (editorRoot.value) {
    const proseMirror = editorRoot.value.querySelector('.ProseMirror') as HTMLElement
    if (proseMirror) {
      proseMirror.focus()
    }
  }
}

defineExpose({
  editor,
  focus,
  getMarkdown: () => turndown.turndown(editor.value?.getHTML() || ''),
  getHTML: () => pretty(editor.value?.getHTML() || ''),
})
</script>

<style scoped>
:deep(.ProseMirror) {
  padding: 16px;
  outline: none;
}

:deep(.ProseMirror:focus) {
  outline: none;
}

:deep(.ProseMirror) ul,
:deep(.ProseMirror) ol {
  padding-left: 1.5rem;
}

:deep(.ProseMirror) blockquote {
  border-left: 3px solid rgba(var(--v-theme-primary), 0.5);
  margin: 0.5rem 0;
  padding-left: 1rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
  font-style: italic;
}

:deep(.ProseMirror) blockquote p {
  margin: 0;
}

:deep(.ProseMirror) img {
  max-width: 100%;
  height: auto;
  margin: 0.5rem 0;
  border-radius: 4px;
  display: block;
}
</style>
