<template>
  <div ref="assigned-area">
    <v-ov-table
      ref="assigned"
      :options="assignedOptions"
      @fetch="fetchAssigned"
      @action="onAssignedAction"
    />
  </div>
  <v-ov-dialog
    v-model="showAvailable"
    :title="t('admin.availableRoles')"
    :persistent="saving"
    scrollable
    closeable
    @after-leave="restoreAddFocus"
  >
    <template #content>
      <v-alert
        v-if="availableLoadFailed"
        class="mb-3"
        type="error"
        variant="tonal"
        :text="t('admin.loadRolesError')"
      >
        <template #append>
          <v-btn variant="text" @click="availableTable?.fetch('first')">
            {{ t('admin.retryRoles') }}
          </v-btn>
        </template>
      </v-alert>
      <v-ov-table
        v-if="showAvailable"
        ref="available"
        :options="availableOptions"
        :loading="saving"
        @fetch="fetchAvailable"
        @action="onAvailableAction"
      />
    </template>
  </v-ov-dialog>
  <v-ov-dialog
    v-model="confirmRemoval"
    :title="t('admin.confirmRemoveRole')"
    :content="t('admin.removeRoleConfirmation', { role: roleToRemove })"
    :actions="['admin.cancel', { name: 'admin.removeRole', format: { color: 'warning' } }]"
    action-cancel="admin.cancel"
    action-submit="admin.removeRole"
    @submit="setRole(roleToRemove, false)"
  />
</template>

<script setup lang="ts">
import { computed, nextTick, onUnmounted, ref, useTemplateRef } from 'vue'
import { useI18n } from 'vue-i18n'
import { useHttp } from '@/capabilities/http'
import { useUi } from '@/capabilities/ui'
import type { components, operations } from '@/api/openapi.generated'
import type { OvTableFetchRequest, OvTableOptions } from '@/components/api'

type RoleUpdate = Required<
  NonNullable<operations['admin_set_user_role']['requestBody']>['content']['application/json']
>
type RolePage =
  | components['schemas']['AdminListUserRolesResponse']
  | components['schemas']['AdminListAvailableUserRolesResponse']

const props = defineProps<{ userId: string; isSelf: boolean }>()
const { t } = useI18n()
const http = useHttp()
const ui = useUi()
const endpoint = computed(() => `/admin/users/${encodeURIComponent(props.userId)}/roles`)
const assignedArea = useTemplateRef('assigned-area')
const assignedTable = useTemplateRef('assigned')
const availableTable = useTemplateRef('available')
const showAvailable = ref(false)
const availableLoadFailed = ref(false)
const confirmRemoval = ref(false)
const roleToRemove = ref('')
const saving = ref(false)
let disposed = false
onUnmounted(() => (disposed = true))

const assignedOptions = computed<OvTableOptions>(() => ({
  key: 'role',
  actions: [
    {
      name: 'admin.addRole',
      title: 'admin.addRole',
      format: { icon: '$mdiPlus', color: 'primary' },
    },
  ],
  search: { placeholder: 'admin.searchAssignedRoles' },
  columns: [
    { name: 'role', label: 'admin.role' },
    { name: 'validFrom', label: 'admin.validFrom', format: { tsFormat: 'datetime' } },
    { name: 'validTo', label: 'admin.validTo', format: { tsFormat: 'datetime' } },
    {
      name: 'actions',
      label: 'admin.roleActions',
      actions: [
        {
          name: 'admin.removeRole',
          title: 'admin.removeRole',
          key: 'role',
          format: [
            ...(props.isSelf
              ? [
                  {
                    rules: { type: 'equals' as const, params: 'admin' },
                    hidden: true,
                  },
                ]
              : []),
            { icon: '$mdiMinus', color: 'warning', hidden: saving.value },
          ],
        },
      ],
    },
  ],
}))

const availableOptions = computed<OvTableOptions>(() => ({
  key: 'role',
  search: { placeholder: 'admin.searchRoles' },
  columns: [
    { name: 'role', label: 'admin.role' },
    { name: 'description', label: 'admin.description' },
    {
      name: 'actions',
      label: 'admin.roleActions',
      actions: [
        {
          name: 'admin.addRole',
          title: 'admin.addRole',
          key: 'role',
          format: { icon: '$mdiPlus', hidden: saving.value },
        },
      ],
    },
  ],
}))

async function loadRolePage(path: string, { cursor, limit, search, signal }: OvTableFetchRequest) {
  const { data, error } = await http.get<RolePage>(path, {
    query: { cursor, limit, search },
    signal,
  })
  if (signal.aborted) return
  if (error || !data) throw new Error('admin.loadRolesError')
  return data
}

async function fetchAssigned(request: OvTableFetchRequest) {
  const result = await ui.action(`admin.users.roles.list:${endpoint.value}`, () =>
    loadRolePage(endpoint.value, request),
  )
  request.complete(result.ok ? result.data : undefined)
}

async function fetchAvailable(request: OvTableFetchRequest) {
  availableLoadFailed.value = false
  try {
    request.complete(await loadRolePage(`${endpoint.value}/available`, request))
  } catch {
    if (!request.signal.aborted) availableLoadFailed.value = true
    request.complete()
  }
}

function restoreAddFocus() {
  if (showAvailable.value) return
  assignedArea.value
    ?.querySelector<HTMLButtonElement>('button[name="admin.addRole"]')
    ?.focus({ preventScroll: true })
}

function roleFromRow(row: unknown) {
  if (row && typeof row === 'object' && 'role' in row && typeof row.role === 'string') {
    return row.role
  }
}

function onAssignedAction(action: string, _rows: unknown, row?: unknown) {
  if (saving.value) return
  if (action === 'admin.addRole') {
    availableLoadFailed.value = false
    showAvailable.value = true
    return
  }
  if (action !== 'admin.removeRole') return
  const role = roleFromRow(row)
  if (!role) return ui.error('admin.updateRoleError')
  if (props.isSelf && role === 'admin') return ui.error('admin.cannotRemoveOwnAdmin')
  roleToRemove.value = role
  confirmRemoval.value = true
}

function onAvailableAction(action: string, _rows: unknown, row?: unknown) {
  if (action !== 'admin.addRole' || saving.value) return
  const role = roleFromRow(row)
  if (!role) {
    showAvailable.value = false
    return ui.error('admin.updateRoleError')
  }
  return setRole(role, true)
}

async function setRole(role: string, assigned: boolean) {
  if (!role || saving.value) return
  if (!assigned && props.isSelf && role === 'admin') return ui.error('admin.cannotRemoveOwnAdmin')
  saving.value = true
  try {
    const save = async () => {
      const payload: RoleUpdate = { role, assigned }
      const { error } = await http.put(endpoint.value, payload)
      if (error) throw new Error('admin.updateRoleError')
    }

    try {
      if (assigned) await save()
      else await ui.loading.run('admin.users.roles.save', save)
    } catch (error) {
      if (assigned) showAvailable.value = false
      ui.error(error)
      return
    }

    if (assigned) {
      showAvailable.value = false
      await nextTick()
    }
    ui.success(assigned ? 'admin.roleAdded' : 'admin.roleRemoved')
    if (!disposed) {
      await assignedTable.value?.fetch('first')
    }
  } finally {
    saving.value = false
  }
}
</script>
