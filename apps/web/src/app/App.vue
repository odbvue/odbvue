<template>
  <component :is="LayoutComponent">
    <RouterView />
  </component>
</template>

<script setup lang="ts">
import DefaultLayout from './layouts/DefaultLayout.vue'
import FullscreenLayout from './layouts/FullscreenLayout.vue'

const layouts = { default: DefaultLayout, fullscreen: FullscreenLayout }
const route = useRoute()

const LayoutComponent = computed(() => {
  return layouts[route.meta.layout ?? 'default']
})
</script>
