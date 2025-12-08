<template>
  <div class="editor-toolbar" :class="props.toolbarClass">
    <v-btn
      v-for="btn in toolbarButtons"
      :key="btn.id"
      :variant="isActive(btn) ? 'outlined' : 'text'"
      density="comfortable"
      @click="handleClick(btn)"
      :icon="btn.icon"
    />
  </div>
  <editor-content
    :editor="editor"
    :class="props.editorClass"
    class="editor-content"
    :style="editorContentStyle"
  />
</template>

<script setup lang="ts">
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { computed, onBeforeUnmount, watch } from 'vue'
import TurndownService from 'turndown'
import MarkdownIt from 'markdown-it'
import pretty from 'pretty'

const model = defineModel({ type: String, default: '' })

const turndown = new TurndownService()
const markdownIt = new MarkdownIt()

const props = defineProps({
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
})

const emits = defineEmits(['updated'])

// Convert markdown to HTML for editor display
const mdToHtml = (md: string): string => {
  if (!md) return ''
  return markdownIt.render(md)
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
}

const editor = useEditor({
  content: getInitialContent(),
  extensions: [StarterKit],
  onUpdate: ({ editor }) => {
    const html = editor.getHTML()
    const output = props.outputFormat === 'markdown' ? htmlToMd(html) : html
    model.value = output
    emits('updated', output)
  },
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
  if (editor) {
    editor.value?.destroy()
  }
})

defineExpose({
  editor,
  getMarkdown: () => turndown.turndown(editor.value?.getHTML() || ''),
  getHTML: () => pretty(editor.value?.getHTML() || ''),
})
</script>

<style scoped>
:deep(.ProseMirror) {
  padding: 1px;
  outline: none;
}

:deep(.ProseMirror:focus) {
  outline: none;
}

:deep(.ProseMirror) ul,
:deep(.ProseMirror) ol {
  padding-left: 1.5rem;
}
</style>
