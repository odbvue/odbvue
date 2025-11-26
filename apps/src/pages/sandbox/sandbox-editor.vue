<template>
  <v-ov-editor
    ref="editor"
    v-model="html"
    @updated="updated"
    :toolbar="[
      'bold',
      'italic',
      'underline',
      'strike',
      'bulletList',
      'orderedList',
      'heading1',
      'heading2',
      'heading3',
    ]"
    toolbar-class="mb-4"
  />
  {{ typing }}
  <h3 class="mt-4">HTML</h3>
  <pre>{{ output.html }}</pre>
  <h3 class="mt-4">Markdown</h3>
  <pre>{{ output.markdown }}</pre>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'always',
    access: 'when-authenticated',
  },
})

const editor = ref()

const html = ref(
  `<h1>What is Lorem Ipsum?</h1>
  <p><strong>Lorem Ipsum</strong>is simply dummy text of the printing and typesetting industry.</p> 
  <p>Lorem Ipsum has been the industry standard dummy text ever since the 1500s.</p>`,
)

const output = computed(() => {
  return {
    html: editor.value?.getHTML(),
    markdown: editor.value?.getMarkdown(),
  }
})

const typing = ref('.')
const updated = () => {
  typing.value = '...'
  setTimeout(() => {
    typing.value = '.'
  }, 500)
}
</script>
