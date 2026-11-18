<template>
  <v-container>
    <h3 v-if="user">{{ user.username }}</h3>
    <v-tabs v-model="tab">
      <v-tab value="details">{{ t('admin.details') }}</v-tab>
      <v-tab value="permissions" :disabled="!user">{{ t('admin.permissions') }}</v-tab>
    </v-tabs>
    <v-tabs-window v-model="tab">
      <v-tabs-window-item value="details">
        <UserDetails
          v-if="user"
          :key="user.id"
          :user="user"
          :is-self="isSelf"
          @update:enabled="updateEnabled"
        />
      </v-tabs-window-item>
      <v-tabs-window-item value="permissions">
        <UserPermissions v-if="user && permissionsOpened" :user-id="user.id" :is-self="isSelf" />
      </v-tabs-window-item>
    </v-tabs-window>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/capabilities/auth'
import { useHttp } from '@/capabilities/http'
import { computedRouteParam, useRouting } from '@/capabilities/routing'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'
import UserDetails from '@/modules/admin/components/UserDetails.vue'
import UserPermissions from '@/modules/admin/components/UserPermissions.vue'

definePage({
  meta: {
    title: 'admin.userDetails',
    icon: '$mdiAccount',
    access: ['admin'],
    navigation: false,
  },
})

const { t } = useI18n()
const http = useHttp()
const auth = useAuth()
const routing = useRouting()
const ui = useUi()
const tab = ref('details')
const permissionsOpened = ref(false)
watch(tab, (value) => {
  if (value === 'permissions') permissionsOpened.value = true
})
const id = computedRouteParam(useRoute(), 'id')
const user = ref<components['schemas']['AdminGetUserItemsItem']>()
const isSelf = computed(() => user.value?.id === auth.user.value?.id)
watchEffect(() => routing.setBreadcrumb(user.value?.displayName?.trim() || user.value?.username))

async function loadUser() {
  await ui.action('admin.users.details', async () => {
    const { data, error, status } = await http.get<components['schemas']['AdminGetUserResponse']>(
      `/admin/users/${encodeURIComponent(id.value)}`,
    )
    if (error) throw new Error(status === 404 ? 'admin.userNotFound' : 'admin.loadUserError')
    user.value = data?.items[0]
    if (!user.value) throw new Error('admin.userNotFound')
  })
}

function updateEnabled(enabled: boolean) {
  if (user.value) user.value.enabled = enabled
}

onMounted(loadUser)
onUnmounted(() => {
  routing.setBreadcrumb()
})
</script>
