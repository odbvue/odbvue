<template>
  <component :is="LayoutComponent">
    <RouterView />
  </component>
  <RouterLink to="/">Home</RouterLink>
  |
  <RouterLink to="/about">About</RouterLink>
  |
  <RouterLink to="/sandbox">Sandbox</RouterLink>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router'
import { computed, defineAsyncComponent } from 'vue'

const layoutModules = import.meta.glob('./layouts/*.vue')

function extractName(path: string) {
  return path
    .split('/')
    .pop()
    ?.replace(/\.\w+$/, '')
    .replace(/Layout$/i, '')
    .toLowerCase()
}

const availableLayouts: Record<string, () => Promise<Record<string, unknown>>> = {}
for (const path in layoutModules) {
  const name = extractName(path)
  if (name) {
    availableLayouts[name] = layoutModules[path] as () => Promise<Record<string, unknown>>
  }
}

const route = useRoute()

const LayoutComponent = computed(() => {
  const name = (route.meta?.layout as string) || 'default'
  const key = name.toLowerCase()

  const loader = availableLayouts[key]
  if (!loader) {
    throw new Error(`[Layout] Missing layout: ${name}`)
  }

  return defineAsyncComponent(loader)
})
</script>
