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
  <editor-content :editor="editor" :class="props.editorClass" class="editor-content" />
</template>

<script setup lang="ts">
import { useEditor, EditorContent, Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { computed, onBeforeUnmount } from 'vue'
import TurndownService from 'turndown'
import pretty from 'pretty'

const model = defineModel({ type: String, default: '' })

const turndown = new TurndownService()

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
})

const emits = defineEmits(['updated'])

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
  content: model.value,
  extensions: [StarterKit],
  onUpdate: ({ editor }) => {
    model.value = editor.getHTML()
    emits('updated', model.value)
  },
})

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
}

:deep(.ProseMirror) ul,
:deep(.ProseMirror) ol {
  padding-left: 1.5rem;
}
</style>
