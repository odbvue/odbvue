<template>
  <div
    class="v-Ov-editor"
    :class="[
      `v-Ov-editor--${variant}`,
      { 'v-Ov-editor--focused': isFocused },
      { 'v-Ov-editor--disabled': disabled },
      { 'v-Ov-editor--readonly': readonly },
      { 'v-Ov-editor--error': !!errorMessages?.length },
    ]"
  >
    <label
      v-if="label"
      class="v-Ov-editor__label"
      :class="{ 'text-error': !!errorMessages?.length }"
    >
      <slot name="label">{{ label }}</slot>
    </label>

    <div
      v-if="editor && !readonly && !disabled && toolbar.length > 0"
      class="v-Ov-editor__toolbar"
      :class="toolbarClass"
    >
      <v-btn
        v-for="btn in toolbarButtons"
        :key="btn.action"
        :icon="btn.icon"
        size="x-small"
        variant="text"
        :color="btn.isActive?.() ? 'primary' : undefined"
        :disabled="disabled || readonly"
        @click="btn.command()"
      />
    </div>

    <div class="v-Ov-editor__content" :class="editorClass" :style="contentStyle">
      <editor-content :editor="editor" />
    </div>

    <input ref="imageInputRef" type="file" accept="image/*" hidden @change="handleImageUpload" />

    <div v-if="hint || counter" class="v-Ov-editor__details">
      <span v-if="hint" class="v-Ov-editor__hint">{{ hint }}</span>
      <span v-if="counter" class="v-Ov-editor__counter">
        {{ characterCount }} / {{ counter }}
      </span>
    </div>

    <div v-if="errorMessages?.length" class="v-Ov-editor__errors">
      <span v-for="(msg, i) in errorMessages" :key="i" class="text-error text-caption">
        {{ msg }}
      </span>
    </div>

    <div v-if="validationErrors.length" class="v-Ov-editor__errors">
      <span v-for="(msg, i) in validationErrors" :key="i" class="text-error text-caption">
        {{ msg }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { type StyleValue } from 'vue'
import { useEditor, EditorContent } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import { Markdown } from '@tiptap/markdown'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    placeholder?: string
    hint?: string
    toolbar?: string[]
    toolbarClass?: string
    editorClass?: string
    minHeight?: string
    maxHeight?: string
    disabled?: boolean
    readonly?: boolean
    variant?: 'outlined' | 'filled' | 'underlined' | 'plain'
    rules?: ((value: unknown) => boolean | string)[]
    errorMessages?: string[]
    counter?: number
    color?: string
    imageUploader?: (file: File) => Promise<{ url: string } | null>
  }>(),
  {
    modelValue: '',
    toolbar: () => [
      'bold',
      'italic',
      'strike',
      'heading',
      'bulletList',
      'orderedList',
      'blockquote',
      'codeBlock',
      'horizontalRule',
      'undo',
      'redo',
    ],
    minHeight: '150px',
    maxHeight: '400px',
    variant: 'outlined',
  },
)

const emit = defineEmits<{
  (event: 'update:modelValue', value: string): void
}>()

const isFocused = ref(false)
const validationErrors = ref<string[]>([])

const editor = useEditor({
  content: props.modelValue,
  editable: !props.disabled && !props.readonly,
  extensions: [
    StarterKit,
    Image.configure({ inline: true, allowBase64: false }),
    Markdown.configure({}),
  ],
  onUpdate: ({ editor: ed }) => {
    const md = ed.getMarkdown?.() ?? ''
    emit('update:modelValue', md)
    validate(md)
  },
  onFocus: () => {
    isFocused.value = true
  },
  onBlur: () => {
    isFocused.value = false
  },
})

const characterCount = computed(
  () => editor.value?.storage.characterCount?.characters?.() ?? editor.value?.getText().length ?? 0,
)

const contentStyle = computed<StyleValue>(() => ({
  minHeight: props.minHeight,
  maxHeight: props.maxHeight,
  overflowY: 'auto',
}))

function validate(value: unknown) {
  if (!props.rules?.length) {
    validationErrors.value = []
    return
  }
  const errors: string[] = []
  for (const rule of props.rules) {
    const result = rule(value)
    if (typeof result === 'string') errors.push(result)
    else if (result === false) errors.push('Validation failed')
  }
  validationErrors.value = errors
}

type ToolbarButton = {
  icon: string
  action: string
  command: () => void
  isActive?: () => boolean
}

const toolbarButtons = computed<ToolbarButton[]>(() => {
  if (!editor.value) return []

  const allButtons: Record<string, ToolbarButton> = {
    bold: {
      icon: '$mdiFormatBold',
      action: 'bold',
      command: () => editor.value!.chain().focus().toggleBold().run(),
      isActive: () => editor.value!.isActive('bold'),
    },
    italic: {
      icon: '$mdiFormatItalic',
      action: 'italic',
      command: () => editor.value!.chain().focus().toggleItalic().run(),
      isActive: () => editor.value!.isActive('italic'),
    },
    strike: {
      icon: '$mdiFormatStrikethrough',
      action: 'strike',
      command: () => editor.value!.chain().focus().toggleStrike().run(),
      isActive: () => editor.value!.isActive('strike'),
    },
    heading: {
      icon: '$mdiFormatHeaderPound',
      action: 'heading',
      command: () => editor.value!.chain().focus().toggleHeading({ level: 2 }).run(),
      isActive: () => editor.value!.isActive('heading', { level: 2 }),
    },
    bulletList: {
      icon: '$mdiFormatListBulleted',
      action: 'bulletList',
      command: () => editor.value!.chain().focus().toggleBulletList().run(),
      isActive: () => editor.value!.isActive('bulletList'),
    },
    orderedList: {
      icon: '$mdiFormatListNumbered',
      action: 'orderedList',
      command: () => editor.value!.chain().focus().toggleOrderedList().run(),
      isActive: () => editor.value!.isActive('orderedList'),
    },
    blockquote: {
      icon: '$mdiCommentQuote',
      action: 'blockquote',
      command: () => editor.value!.chain().focus().toggleBlockquote().run(),
      isActive: () => editor.value!.isActive('blockquote'),
    },
    codeBlock: {
      icon: '$mdiCodeBraces',
      action: 'codeBlock',
      command: () => editor.value!.chain().focus().toggleCodeBlock().run(),
      isActive: () => editor.value!.isActive('codeBlock'),
    },
    horizontalRule: {
      icon: '$mdiMinus',
      action: 'horizontalRule',
      command: () => editor.value!.chain().focus().setHorizontalRule().run(),
    },
    undo: {
      icon: '$mdiUndo',
      action: 'undo',
      command: () => editor.value!.chain().focus().undo().run(),
    },
    redo: {
      icon: '$mdiRedo',
      action: 'redo',
      command: () => editor.value!.chain().focus().redo().run(),
    },
    image: {
      icon: '$mdiImage',
      action: 'image',
      command: () => triggerImageUpload(),
    },
  }

  return props.toolbar.flatMap((name) => {
    const button = allButtons[name]
    return button ? [button] : []
  })
})

watch(
  () => props.modelValue,
  (newVal) => {
    if (!editor.value) return
    const currentMd = editor.value.getMarkdown?.() ?? ''
    if (newVal !== currentMd) {
      editor.value.commands.setContent(newVal || '')
    }
  },
)

watch(
  () => props.disabled || props.readonly,
  (val) => {
    editor.value?.setEditable(!val)
  },
)

function focus(position: 'start' | 'end' | number = 'end') {
  editor.value?.commands.focus(position)
}

function getHTML(): string {
  return editor.value?.getHTML() ?? ''
}

function getMarkdown(): string {
  return editor.value?.getMarkdown?.() ?? ''
}

const imageInputRef = ref<HTMLInputElement>()

function triggerImageUpload() {
  if (!props.imageUploader) return
  imageInputRef.value?.click()
}

async function handleImageUpload(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !props.imageUploader) return

  const result = await props.imageUploader(file)
  if (result?.url) {
    editor.value?.chain().focus().setImage({ src: result.url }).run()
  }
  input.value = ''
}

onBeforeUnmount(() => {
  editor.value?.destroy()
})

defineExpose({ editor, focus, getHTML, getMarkdown })
</script>

<style>
.v-Ov-editor {
  position: relative;
  margin-bottom: 4px;
}

.v-Ov-editor__label {
  display: block;
  font-size: 0.75rem;
  margin-bottom: 4px;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.v-Ov-editor--focused .v-Ov-editor__label {
  color: rgb(var(--v-theme-primary));
}

.v-Ov-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  background: rgba(var(--v-theme-surface-variant), 0.3);
}

.v-Ov-editor__content {
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  border-radius: 4px;
  padding: 12px;
  transition: border-color 0.2s;
}

.v-Ov-editor__toolbar + .v-Ov-editor__content {
  border-radius: 0 0 4px 4px;
}

.v-Ov-editor--focused .v-Ov-editor__content {
  border-color: rgb(var(--v-theme-primary));
  outline: 1px solid rgb(var(--v-theme-primary));
}

.v-Ov-editor--error .v-Ov-editor__content {
  border-color: rgb(var(--v-theme-error));
}

.v-Ov-editor--error.v-Ov-editor--focused .v-Ov-editor__content {
  outline-color: rgb(var(--v-theme-error));
}

.v-Ov-editor--disabled {
  opacity: 0.5;
  pointer-events: none;
}

.v-Ov-editor__content .tiptap {
  outline: none;
}

.v-Ov-editor__content .tiptap p {
  margin: 0.25em 0;
}

.v-Ov-editor__content .tiptap h1,
.v-Ov-editor__content .tiptap h2,
.v-Ov-editor__content .tiptap h3 {
  margin: 0.5em 0 0.25em;
}

.v-Ov-editor__content .tiptap ul,
.v-Ov-editor__content .tiptap ol {
  padding-left: 1.5em;
  margin: 0.25em 0;
}

.v-Ov-editor__content .tiptap blockquote {
  border-left: 3px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding-left: 1em;
  margin: 0.5em 0;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.v-Ov-editor__content .tiptap pre {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 4px;
  padding: 0.75em 1em;
  margin: 0.5em 0;
  overflow-x: auto;
}

.v-Ov-editor__content .tiptap code {
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 2px;
  padding: 0.15em 0.3em;
  font-size: 0.9em;
}

.v-Ov-editor__content .tiptap img {
  max-width: 100%;
  height: auto;
  margin: 0.5em 0;
  border-radius: 4px;
  display: block;
}

.v-Ov-editor__content .tiptap pre code {
  background: none;
  padding: 0;
}

.v-Ov-editor__content .tiptap hr {
  border: none;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  margin: 1em 0;
}

.v-Ov-editor__details {
  display: flex;
  justify-content: space-between;
  padding: 4px 12px 0;
  font-size: 0.75rem;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
}

.v-Ov-editor__errors {
  display: flex;
  flex-direction: column;
  padding: 4px 12px 0;
}
</style>
