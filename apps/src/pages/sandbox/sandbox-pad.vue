<template>
  <v-container fluid>
    <v-ov-pad
      ref="pad"
      class="border"
      :width="'100%'"
      :height="'240px'"
      :lock="locked"
      :eraser="eraser"
      :background-color="backgroundColor"
      :background-image="backgroundImage"
      :lineWidth="line"
      :color="color"
    />
    <v-btn @click="reset">Clear</v-btn>
    <v-btn @click="undo">Undo</v-btn>
    <v-btn @click="redo">Redo</v-btn>
    <v-btn @click="locked = !locked">{{ locked ? 'Unlock' : 'Lock' }}</v-btn>
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" :color="color">Color</v-btn>
      </template>
      <v-card class="pa-4">
        <v-color-picker v-model="color" label="Color"></v-color-picker>
      </v-card>
    </v-menu>
    <v-btn @click="backgroundColor = backgroundColor === 'white' ? 'lightgray' : 'white'"
      >Toggle background color</v-btn
    >
    <v-btn @click="eraser = !eraser">{{ eraser ? 'Pen' : 'Eraser' }}</v-btn>

    <v-file-input label="Background image" @change="setImage($event)"></v-file-input>
    <v-slider v-model="line" label="Line width" min="1" max="20"></v-slider>
    <v-btn @click="save">Save</v-btn>
  </v-container>
</template>

<script setup lang="ts">
definePage({ meta: { role: 'restricted' } })
import VOvPad from '@/components/VOvPad.vue'

const pad = ref<typeof VOvPad | null>(null)

const locked = ref(false)
const eraser = ref(false)
const backgroundColor = ref('white')
const backgroundImage = ref('')
const line = ref(5)
const color = ref('#000000')

const reset = () => {
  if (!pad.value) return
  pad.value.reset()
}

const undo = () => {
  if (!pad.value) return
  pad.value.undo()
}

const redo = () => {
  if (!pad.value) return
  pad.value.redo()
}

const setImage = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    backgroundImage.value = window.URL.createObjectURL(file)
  }
}

const save = () => {
  if (!pad.value) return
  const data = pad.value.save()
  console.log(data)
}
</script>

<style scoped>
* {
  margin: 0.25rem;
  padding: 0.25rem;
}
</style>
