<template>
  <v-container>
    <v-row
      ><v-col>
        <h3>Installed stores</h3>
      </v-col></v-row
    >

    <v-alert
      v-if="!stores.length"
      type="info"
      title="No stores are active"
      text="Stores appear here after they are first used by the application."
    />

    <v-row v-else>
      <v-col v-for="store in stores" :key="store.id" cols="12" md="4">
        <v-card class="h-100" :title="store.id" prepend-icon="$mdiDatabase">
          <template #append>
            <v-chip :color="store.persist ? 'success' : 'default'" size="small">
              {{ store.persist ? store.persist.storage : 'Not persisted' }}
            </v-chip>
          </template>
          <v-card-actions>
            <v-btn
              class="ml-2"
              prepend-icon="$mdiCodeJson"
              variant="text"
              @click="selectedStore = store"
            >
              View state
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mt-6"
      ><v-col>
        <h3>Persisted storage</h3>
      </v-col></v-row
    >
    <v-row>
      <v-col cols="12" md="4">
        <v-card title="localStorage" prepend-icon="$mdiHarddisk">
          <template #append>
            <v-chip size="small">{{ localStorageItems.length }} items</v-chip>
          </template>
          <v-card-actions>
            <v-btn
              class="ml-2"
              prepend-icon="$mdiCodeJson"
              variant="text"
              @click="localStorageDialogOpen = true"
            >
              View items
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-col>
    </v-row>

    <v-ov-dialog
      v-model="dialogOpen"
      :title="selectedStore ? `${selectedStore.id} state` : 'Store state'"
      icon="$mdiDatabase"
      scrollable
      closeable
    >
      <template #content>
        <template v-if="selectedStore">
          <v-treeview
            :items="toTree(selectedStore.currentState, selectedStore.persist?.paths ?? null)"
            :opened="
              treeNodeValues(
                toTree(selectedStore.currentState, selectedStore.persist?.paths ?? null),
              )
            "
            density="compact"
          />
        </template>
      </template>
      <template #actions>
        <v-btn
          icon="$mdiContentCopy"
          variant="text"
          aria-label="Copy state to clipboard"
          @click="selectedStore && copyState(selectedStore.currentState)"
        />
      </template>
    </v-ov-dialog>

    <v-ov-dialog
      v-model="localStorageDialogOpen"
      title="localStorage"
      icon="$mdiHarddisk"
      scrollable
      closeable
    >
      <template #content>
        <v-treeview
          :items="toTree(localStorageItems)"
          :opened="treeNodeValues(toTree(localStorageItems))"
          density="compact"
        />
      </template>
      <template #actions>
        <v-btn
          icon="$mdiContentCopy"
          variant="text"
          aria-label="Copy localStorage items to clipboard"
          @click="copyState(localStorageItems)"
        />
      </template>
    </v-ov-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { getOdbVueStores, getPersistOptions, useOdbVue, type PersistOptions } from '@odbvue/web'
import { computed, onMounted, ref } from 'vue'

definePage({
  meta: {
    title: 'State',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

type StoreSnapshot = {
  id: string
  currentState: Record<string, unknown>
  persist?: PersistOptions
}

type StorageItem = {
  key: string
  value: unknown
}

type TreeItem = {
  title: string
  value: string
  appendIcon?: string
  children?: TreeItem[]
}

const { pinia } = useOdbVue()
const stores = ref<StoreSnapshot[]>([])
const selectedStore = ref<StoreSnapshot>()
const localStorageItems = ref<StorageItem[]>([])
const localStorageDialogOpen = ref(false)
const dialogOpen = computed({
  get: () => !!selectedStore.value,
  set: (open: boolean) => {
    if (!open) selectedStore.value = undefined
  },
})

async function refresh() {
  stores.value = getOdbVueStores(pinia).map((store) => ({
    id: store.$id,
    currentState: store.$state,
    persist: getPersistOptions(store),
  }))
  localStorageItems.value = Array.from({ length: window.localStorage.length }, (_, index) => {
    const key = window.localStorage.key(index) ?? ''
    const value = window.localStorage.getItem(key) ?? ''
    try {
      return { key, value: JSON.parse(value) }
    } catch {
      return { key, value }
    }
  })
}

function formatState(state: unknown): string {
  return state === undefined ? 'No saved state' : JSON.stringify(state, null, 2)
}

function toTree(value: unknown, persistedPaths: string[] | null = null, path = ''): TreeItem[] {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      toTreeItem(`[${index}]`, item, persistedPaths, `${path}.${index}`),
    )
  }
  if (value && typeof value === 'object') {
    return Object.entries(value)
      .filter(
        ([key, item]) => !key.startsWith('$') && !key.startsWith('_') && typeof item !== 'function',
      )
      .map(([key, item]) => toTreeItem(key, item, persistedPaths, path ? `${path}.${key}` : key))
  }
  return [toTreeItem('value', value, persistedPaths, path)]
}

function toTreeItem(
  title: string,
  value: unknown,
  persistedPaths: string[] | null,
  path: string,
): TreeItem {
  const isPersisted =
    persistedPaths !== null &&
    (!persistedPaths.length ||
      persistedPaths.some(
        (persistedPath) => persistedPath === path || persistedPath.startsWith(`${path}.`),
      ))
  if (Array.isArray(value) || (value && typeof value === 'object')) {
    return {
      title,
      value: path,
      appendIcon: isPersisted ? '$mdiContentSave' : undefined,
      children: toTree(value, persistedPaths, path),
    }
  }
  return {
    title: `${title}: ${String(value)}`,
    value: path,
    appendIcon: isPersisted ? '$mdiContentSave' : undefined,
  }
}

function treeNodeValues(items: TreeItem[]): string[] {
  return items.flatMap((item) => [
    item.value,
    ...(item.children ? treeNodeValues(item.children) : []),
  ])
}

async function copyState(state: unknown) {
  await navigator.clipboard.writeText(formatState(state))
}

onMounted(refresh)
</script>
