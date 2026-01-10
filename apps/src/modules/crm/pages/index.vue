<template>
  <v-container>
    <v-tabs v-model="activeTab">
      <v-tab value="persons">{{ t('persons') }}</v-tab>
      <v-tab value="discovery">{{ t('discovery.requests') }}</v-tab>
      <v-tab value="surveys">{{ t('surveys') }}</v-tab>
    </v-tabs>

    <v-window v-model="activeTab">
      <v-window-item value="persons">
        <v-ov-table
          :options="personsOptions"
          :data="personsData"
          :loading="personsLoading"
          @fetch="fetchPersons"
          @action="actionPerson"
        />
      </v-window-item>

      <v-window-item value="discovery">
        <v-ov-table :options="options" :data="data" :loading="loading" @fetch="fetchRequests" />
      </v-window-item>

      <v-window-item value="surveys">
        <v-row class="mt-4">
          <v-col cols="12" md="4">
            <v-card color="primary" prepend-icon="$mdiCommentQuestion" to="crm/surveys" hover>
              <v-card-title>{{ t('surveys') }}</v-card-title>
            </v-card>
          </v-col>
        </v-row>
      </v-window-item>
    </v-window>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'CRM',
    color: '#9C27B0',
    description: 'CRM Management',
    icon: '$mdiAccountBoxMultiple',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const { t } = useI18n()
const activeTab = ref('persons')

// Form Actions for Persons
const { action: actionInsertPerson } = useFormAction({
  endpoints: {
    insertPerson: 'crm-v2/person/',
  },
  transformKeysToKebabCase: true,
  refetchOn: ['insertPerson'],
})

// Form Actions for Organizations
const { action: actionInsertOrganization } = useFormAction({
  endpoints: {
    insertOrganization: 'crm-v2/organization/',
  },
  transformKeysToKebabCase: true,
  refetchOn: ['insertOrganization'],
})

const actionPerson = (
  actionName: string,
  oldData: OvFormData,
  newData: OvFormData,
  callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
) => {
  if (actionName === 'insertPerson') {
    actionInsertPerson(actionName, oldData, newData, callback)
  } else if (actionName === 'insertOrganization') {
    actionInsertOrganization(actionName, oldData, newData, callback)
  }
}

// Discovery Requests
type CrmRequestsResponse = {
  requests: OvTableData[]
}

const {
  loading,
  data,
  fetch: fetchRequests,
} = useTableFetch<CrmRequestsResponse>({
  endpoint: 'crm/requests/',
  responseKey: 'requests',
})

const options = ref<OvTableOptions>({
  key: 'id',
  search: {
    placeholder: 'name.organization.phone.email',
  },
  columns: [
    { name: 'created' },
    { name: 'name' },
    { name: 'organization' },
    { name: 'phone' },
    { name: 'email' },
    { name: 'message', maxLength: 0 },
  ],
  maxLength: 30,
})

// Persons
type CrmPersonsResponse = {
  persons: OvTableData[]
}

const {
  loading: personsLoading,
  data: personsData,
  fetch: fetchPersons,
} = useTableFetch<CrmPersonsResponse>({
  endpoint: 'crm-v2/persons/',
  responseKey: 'persons',
})

const personsOptions = ref<OvTableOptions>({
  key: 'id',
  search: {
    placeholder: 'fullname.type',
  },
  columns: [{ name: 'created' }, { name: 'fullname' }, { name: 'type' }],
  actions: [
    {
      name: 'insertPerson',
      key: 'id',
      format: { icon: '$mdiAccountPlus', variant: 'flat' },
      form: {
        fields: [
          { type: 'text', name: 'firstName', label: 'first.name' },
          { type: 'text', name: 'lastName', label: 'last.name' },
          { type: 'text', name: 'legalName', label: 'legal.name' },
        ],
        actions: ['save', { name: 'cancel', format: { variant: 'outlined' } }],
        actionSubmit: 'save',
        actionCancel: 'cancel',
      },
    },
    {
      name: 'insertOrganization',
      key: 'id',
      format: { icon: '$mdiOfficeBuilding', variant: 'flat' },
      form: {
        fields: [{ type: 'text', name: 'legalName', label: 'legal.name' }],
        actions: ['save', { name: 'cancel', format: { variant: 'outlined' } }],
        actionSubmit: 'save',
        actionCancel: 'cancel',
      },
    },
  ],
  maxLength: 30,
})
</script>
