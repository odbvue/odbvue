<template>
  <v-defaults-provider :defaults>
    <v-container>
      <v-row no-gutters>
        <v-col
          v-for="item in options.items"
          :key="item.name"
          :cols="12 / (mobile ? 1 : options.cols || 1)"
        >
          <component
            :is="
              renderViewItem(
                data[item.name],
                item,
                data,
                options,
                handleEmit as (event: string, ...args: unknown[]) => void,
              )
            "
          />
        </v-col>
      </v-row>
      <v-row v-if="actions.length > 0">
        <v-col :class="OvTextAlign(options.actionAlign)">
          <v-btn
            v-for="action in actions"
            :key="action.name"
            v-bind="action.props"
            @click="handleAction(action.name)"
          />
        </v-col>
      </v-row>

      <v-dialog v-model="form" :width="mobile ? '100%' : '75%'">
        <v-card>
          <v-card-title>{{ formTitle }}</v-card-title>
          <v-card-text>
            <v-ov-form
              :options="formOptions"
              :data="formData"
              :t
              :loading
              @action="handleFormAction"
              @submit="handleFormSubmit"
              @cancel="form = false"
            />
          </v-card-text>
        </v-card>
      </v-dialog>

      <v-overlay :model-value="loading" persistent contained class="align-center justify-center">
        <v-progress-circular indeterminate />
      </v-overlay>
    </v-container>
  </v-defaults-provider>
</template>
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDisplay, useDefaults } from 'vuetify'
import type { OvViewOptions, OvViewData, OvFormOptions, OvFormData, OvFormFieldError } from '.'
import { renderViewItem, OvTextAlign, OvActionFormat } from '.'

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
    VOverlay: {
      class: 'rounded',
    },
    VChip: {
      variant: 'text',
    },
  },
})

const { mobile } = useDisplay()
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

const emit = defineEmits<{
  (e: 'details', name: string, value: string): void
  (
    e: 'action',
    name: string,
    value: unknown,
    formData?: unknown,
    callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
  ): void
}>()

const form = ref(false)
const formTitle = ref('')
const formOptions = ref<OvFormOptions>({ fields: [] })
const formData = ref<OvFormData>({})
const formActionName = ref('')
const formFieldName = ref('')

const onActionComplete = (formErrors?: OvFormFieldError[]) => {
  if (formErrors && formErrors.length > 0) {
    formOptions.value = {
      ...(formOptions.value || {}),
      errors: formErrors,
    }
    return
  }

  form.value = false
}

function handleEmit(event: string, ...args: unknown[]) {
  if (event === 'action') {
    handleFieldAction(args[0] as string)
  } else if (event === 'details') {
    emit('details', args[0] as string, args[1] as string)
  }
}

function handleFieldAction(actionName: string) {
  // Find the field with this action
  const item = options.items?.find((item) => {
    if (!item.actions) return false
    return item.actions.some((action) => typeof action !== 'string' && action.name === actionName)
  })

  if (!item || !item.actions) {
    emit('action', actionName, data)
    return
  }

  const action = item.actions.find(
    (action) => typeof action !== 'string' && action.name === actionName,
  )

  if (!action || typeof action === 'string') {
    emit('action', actionName, data)
    return
  }

  if (action.form) {
    formOptions.value = action.form
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
  const action = (options.actions || []).find(
    (action) => typeof action !== 'string' && action.name === actionName,
  )

  if (!action) return

  if (typeof action !== 'string' && action.form) {
    formOptions.value = action.form
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

async function handleFormAction(actionName: string, actionData: OvFormData) {
  await emit('action', formActionName.value, data, actionData, onActionComplete)
}

async function handleFormSubmit(actionData: OvFormData) {
  emit('action', formActionName.value, data, actionData, onActionComplete)
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
