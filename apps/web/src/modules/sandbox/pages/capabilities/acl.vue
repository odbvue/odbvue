<template>
  <v-container>
    <h3>Network ACL</h3>
    <p class="text-medium-emphasis">
      Manage application-schema HTTP, SMTP and LDAPS grants through pck_sandbox → odb_acl.
    </p>
    <v-alert
      v-if="!canManage"
      class="mt-3"
      type="warning"
      text="Authentication with the admin role is required."
    />
    <v-alert
      v-if="message"
      class="mt-3"
      :type="message.type"
      :text="message.text"
      closable
      @click:close="message = undefined"
    />
    <v-row class="mt-2">
      <v-col cols="12" md="5">
        <v-card title="Host grant" prepend-icon="$mdiShieldLock">
          <v-card-text>
            <v-select
              v-model="protocol"
              :items="protocols"
              label="Protocol"
              @update:model-value="port = undefined"
            />
            <v-text-field v-model="host" label="Host (no URL or wildcard)" maxlength="255" />
            <v-text-field
              v-model.number="port"
              label="Port (optional)"
              type="number"
              min="1"
              max="65535"
              :placeholder="String(defaultPort)"
              :hint="`Defaults to ${defaultPort}. Only the ${protocol === 'ldap' ? 'connect' : protocol} privilege is granted.`"
              persistent-hint
            />
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              :disabled="!valid || !canManage || !!busy"
              :loading="busy === 'add'"
              @click="change('add')"
              >Add</v-btn
            >
            <v-btn
              color="error"
              :disabled="!valid || !canManage || !!busy"
              :loading="busy === 'remove'"
              @click="change('remove')"
              >Remove</v-btn
            >
          </v-card-actions>
        </v-card>
      </v-col>
      <v-col cols="12" md="7">
        <v-card title="HTTP, SMTP and LDAPS grants">
          <v-table density="compact">
            <thead>
              <tr>
                <th>Host</th>
                <th>Lower port</th>
                <th>Upper port</th>
                <th>Privilege</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="item in items"
                :key="`${item.host}:${item.lowerPort}:${item.upperPort}:${item.privilege}`"
                :class="{ 'cursor-pointer': selectable(item) }"
                @click="pick(item)"
              >
                <td>{{ item.host }}</td>
                <td>{{ item.lowerPort ?? 'All' }}</td>
                <td>{{ item.upperPort ?? 'All' }}</td>
                <td>{{ item.privilege }}</td>
              </tr>
              <tr v-if="!items.length">
                <td colspan="4" class="text-medium-emphasis">Nothing loaded.</td>
              </tr>
            </tbody>
          </v-table>
          <v-card-actions>
            <v-btn
              prepend-icon="$mdiRefresh"
              :disabled="!canManage || !!busy"
              :loading="busy === 'list'"
              @click="list"
              >Load</v-btn
            >
          </v-card-actions>
          <v-card-text class="text-medium-emphasis">
            Existing all-port and range grants are displayed, but only exact-port grants can be
            selected and changed here.
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAuth } from '@/capabilities/auth'
import { useHttp } from '@/capabilities/http'
import type { components } from '@/api/openapi.generated'

definePage({
  meta: { title: 'Network ACL', icon: '$mdiShieldLock', access: ['admin'], navigation: true },
})

type Item = components['schemas']['SandboxListAclItemsItem']
// ORDS serializes cursor column names in snake_case, unlike the generated OpenAPI types.
type WireItem = Omit<Item, 'lowerPort' | 'upperPort'> & {
  lower_port: number | null
  upper_port: number | null
}
type Action = 'add' | 'remove' | 'list'

const auth = useAuth()
const http = useHttp()
const canManage = computed(() => auth.authenticated.value && auth.hasRole('admin'))
const protocols = ['http', 'smtp', 'ldap'] as const
const protocol = ref<'http' | 'smtp' | 'ldap'>('http')
const host = ref('')
const port = ref<number | string>()
const defaultPort = computed(() => ({ http: 443, smtp: 587, ldap: 636 })[protocol.value])
const selectedPort = computed(() =>
  port.value === undefined || port.value === '' ? defaultPort.value : Number(port.value),
)
const valid = computed(
  () =>
    /^[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/.test(host.value) &&
    host.value.length <= 255 &&
    Number.isInteger(selectedPort.value) &&
    selectedPort.value >= 1 &&
    selectedPort.value <= 65535,
)
const items = ref<Item[]>([])
const busy = ref<Action>()
const message = ref<{ type: 'success' | 'error'; text: string }>()

async function load() {
  const response = await http.get<{ items: WireItem[] }>('/sandbox/acl')
  if (response.error || !response.data) throw response.error ?? new Error('No ACL data returned')
  items.value = response.data.items.map((item) => {
    if (
      (item.lower_port !== null && !Number.isInteger(item.lower_port)) ||
      (item.upper_port !== null && !Number.isInteger(item.upper_port))
    ) {
      throw new Error('ACL response contains missing or invalid port bounds.')
    }
    return {
      host: item.host,
      lowerPort: item.lower_port,
      upperPort: item.upper_port,
      privilege: item.privilege.toLowerCase(),
    }
  })
}

async function run(action: Action, call: () => Promise<void>) {
  busy.value = action
  message.value = undefined
  try {
    await call()
    message.value = {
      type: 'success',
      text: action === 'list' ? 'ACL grants loaded.' : 'ACL grant updated.',
    }
  } catch (error) {
    message.value = {
      type: 'error',
      text: error instanceof Error ? error.message : 'ACL operation failed.',
    }
  } finally {
    busy.value = undefined
  }
}

const list = () => run('list', load)
const change = (action: 'add' | 'remove') =>
  run(action, async () => {
    const url = `/sandbox/acl/${protocol.value}/${encodeURIComponent(host.value)}?port=${selectedPort.value}`
    const response = action === 'add' ? await http.put(url) : await http.delete(url)
    if (response.error) throw response.error
    try {
      await load()
    } catch (error) {
      throw new Error(
        `ACL grant updated, but refreshing the list failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { cause: error },
      )
    }
  })

const selectable = (item: Item) =>
  item.lowerPort != null &&
  item.lowerPort === item.upperPort &&
  (item.privilege === 'http' || item.privilege === 'smtp' || item.privilege === 'connect')

function pick(item: Item) {
  if (!selectable(item)) return
  host.value = item.host
  protocol.value =
    item.privilege === 'connect' ? 'ldap' : item.privilege === 'http' ? 'http' : 'smtp'
  port.value = item.lowerPort ?? undefined
}
</script>
