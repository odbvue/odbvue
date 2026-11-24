<template>
  <v-defaults-provider :defaults>
    <v-container :aria-busy="busy">
      <v-row no-gutters :inert="busy">
        <v-col
          v-for="item in options.items"
          :key="item.name"
          :cols="12 / (mobile ? 1 : options.cols || 1)"
        >
          <component :is="renderViewItem(data[item.name], item, data, viewOptions, handleEmit)" />
        </v-col>
      </v-row>
      <v-row v-if="actions.length > 0" :inert="busy">
        <v-col :class="OvTextAlign(options.actionAlign)">
          <v-btn
            v-for="action in actions"
            :key="action.name"
            v-bind="action.props"
            @click="handleAction(action.name)"
          />
        </v-col>
      </v-row>

      <v-dialog v-model="form" :persistent="busy" :width="mobile ? '100%' : '75%'">
        <v-card class="position-relative">
          <v-card-title>{{ formTitle }}</v-card-title>
          <v-card-text>
            <v-Ov-form
              :options="formOptions"
              :data="formData"
              :t
              :loading="busy && form"
              :overlay-boundary="dialogBoundary"
              @action="handleFormAction"
              @submit="handleFormSubmit"
              @cancel="form = false"
            />
          </v-card-text>
          <v-overlay
            :model-value="loadingOverlay && form"
            class="d-flex align-center justify-center"
            persistent
            contained
          >
            <v-progress-circular indeterminate />
          </v-overlay>
        </v-card>
      </v-dialog>
      <v-overlay
        :model-value="loadingOverlay && !form"
        class="d-flex align-center justify-center"
        persistent
        contained
      >
        <v-progress-circular indeterminate />
      </v-overlay>
    </v-container>
  </v-defaults-provider>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDisplay, useDefaults } from 'vuetify'
import VOvForm from '../forms/VOvForm.vue'
import { useLoadingOverlay } from '../overlays/loading'
import { useFormSubmission } from '../forms/submission'
import {
  VBtn,
  VCard,
  VCardText,
  VCardTitle,
  VCol,
  VContainer,
  VDefaultsProvider,
  VDialog,
  VOverlay,
  VProgressCircular,
  VRow,
} from 'vuetify/components'
import type {
  OvViewOptions,
  OvViewData,
  OvFormOptions,
  OvFormData,
  OvActionComplete,
  OvActionResult,
} from '../index'
import { renderViewItem, OvTextAlign, OvActionFormat } from '../index'

const { defaults } = useDefaults({
  name: 'VOvView',
  defaults: {
    VBtn: {
      size: 'small',
      variant: 'tonal',
      class: 'ma-1',
    },
    VLabel: {
      class: 'pb-1 mt-2',
    },
    VContainer: {
      class: 'position-relative',
    },
    VChip: {
      variant: 'text',
    },
  },
})

const { mobile } = useDisplay()
const { locale } = useI18n()
const {
  data,
  options = {} as OvViewOptions,
  t = (text?: string) => text || '',
  loading = false,
} = defineProps<{
  data: OvViewData
  options?: OvViewOptions
  t?: (text?: string) => string
  loading?: boolean
}>()
const { submitting, submit } = useFormSubmission()
const busy = computed(() => loading || submitting.value)
const form = ref(false)
const dialogBoundary = Symbol('view-dialog')
const loadingOverlay = useLoadingOverlay(busy, () => (form.value ? dialogBoundary : undefined))
const viewOptions = computed(() => ({ ...options, locale: options.locale ?? locale.value }))

const emit = defineEmits<{
  (e: 'details', name: string, value: string): void
  (e: 'action', name: string, value: unknown, formData?: unknown, complete?: OvActionComplete): void
}>()

function handleEmit(event: string, ...args: unknown[]) {
  if (event === 'action') {
    handleFieldAction(args[0] as string)
  } else if (event === 'details') {
    emit('details', args[0] as string, args[1] as string)
  }
}

const formTitle = ref('')
const formOptions = ref<OvFormOptions>({ fields: [] })
const formData = ref<OvFormData>({})
const formActionName = ref('')
const formFieldName = ref('')

const onActionComplete = (result: OvActionResult) => {
  if (result.status === 'invalid') {
    formOptions.value = {
      ...formOptions.value,
      errors: result.errors,
    }
    return
  }
  if (result.status === 'error') return

  form.value = false
}

function handleFieldAction(actionName: string) {
  if (busy.value) return
  // Find the field with this action
  const item = options.items?.find((field) => {
    if (!field.actions) return false
    return field.actions.some((act) => typeof act !== 'string' && act.name === actionName)
  })

  if (!item || !item.actions) {
    emit('action', actionName, data)
    return
  }

  const action = item.actions.find((act) => typeof act !== 'string' && act.name === actionName)

  if (!action || typeof action === 'string') {
    emit('action', actionName, data)
    return
  }

  if (action.form) {
    formOptions.value = typeof action.form === 'function' ? action.form(data) : action.form
    formData.value = { ...data }
    const fmt = OvActionFormat(undefined, action, options.actionFormat)
    formTitle.value = t(fmt.text || action.name)
    formActionName.value = action.name
    formFieldName.value = item.name
    form.value = true
    return
  }

  emit('action', actionName, data)
}

function handleAction(actionName: string) {
  if (busy.value) return
  const action = (options.actions || []).find(
    (act) => typeof act !== 'string' && act.name === actionName,
  )

  if (!action) return

  if (typeof action !== 'string' && action.form) {
    formOptions.value = typeof action.form === 'function' ? action.form(data) : action.form
    formData.value = { ...data }
    const fmt = OvActionFormat(undefined, action, options.actionFormat)
    formTitle.value = t(fmt.text || action.name)
    formActionName.value = action.name
    formFieldName.value = ''
    form.value = true
    return
  }

  emit('action', actionName, data)
}

function handleFormAction(_actionName: string, actionData: OvFormData) {
  if (!form.value || busy.value || formOptions.value.disabled) return
  formOptions.value = { ...formOptions.value, errors: [] }
  submit(
    (complete) => emit('action', formActionName.value, data, actionData, complete),
    onActionComplete,
  )
}

function handleFormSubmit(actionData: OvFormData) {
  handleFormAction(formActionName.value, actionData)
}

const actions = computed(() => {
  return (options.actions || []).map((action) => {
    const props = OvActionFormat(undefined, action, options.actionFormat)
    props.text = props.text ? t(String(props.text)) : undefined
    return {
      name: props.name as string,
      props,
    }
  })
})
</script>
