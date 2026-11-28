<template>
  <v-container>
    <h3 v-if="user">{{ user.username }}</h3>
    <v-tabs :model-value="tab">
      <v-tab value="details" :to="tabLocation('details')" exact>{{ t('admin.details') }}</v-tab>
      <v-tab value="permissions" :to="tabLocation('permissions')" :disabled="!user" exact>
        {{ t('admin.permissions') }}
      </v-tab>
      <v-tab value="audit" :to="tabLocation('audit')" :disabled="!user" exact>
        {{ t('admin.audit') }}
      </v-tab>
      <v-tab value="emails" :to="tabLocation('emails')" :disabled="!user" exact>
        {{ t('admin.emails') }}
      </v-tab>
    </v-tabs>
    <RouterView v-slot="{ Component }">
      <component
        :is="Component"
        v-if="user"
        :user="user"
        :is-self="isSelf"
        @update:enabled="updateEnabled"
      />
    </RouterView>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuth } from '@/capabilities/auth'
import { useHttp } from '@/capabilities/http'
import { computedRouteParam, useRouting } from '@/capabilities/routing'
import { useUi } from '@/capabilities/ui'
import type { components } from '@/api/openapi.generated'

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
const route = useRoute()
const id = computedRouteParam(route, 'id')
const tabRoutes = {
  details: '/admin/users/[id]/',
  permissions: '/admin/users/[id]/permissions',
  audit: '/admin/users/[id]/audit',
  emails: '/admin/users/[id]/emails',
} as const
const tab = computed(() => {
  if (route.name === tabRoutes.permissions) return 'permissions'
  if (route.name === tabRoutes.audit) return 'audit'
  if (route.name === tabRoutes.emails) return 'emails'
  return 'details'
})

function tabLocation(value: 'details' | 'permissions' | 'audit' | 'emails') {
  return {
    name: tabRoutes[value],
    params: { id: id.value },
    query: route.query,
    hash: route.hash,
  }
}

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
