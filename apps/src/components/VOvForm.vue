<template>
  <v-defaults-provider :defaults>
    <v-container>
      <v-form
        ref="form"
        validate-on="invalid-input"
        :autocomplete="options.autocomplete"
        :disabled="options.disabled"
        :readonly="options.readonly"
        :fast-fail="options.fastFail"
        @submit.prevent
      >
        <v-row>
          <v-col
            v-for="field in fields"
            :key="field.name"
            :cols="12 / (mobile ? 1 : options.cols || 1)"
          >
            <!-- Standard form fields -->
            <component
              :is="field.component"
              :id="field.name"
              v-model="values[field.name]"
              v-bind="field.props"
              :autocomplete="field.props.autocomplete || 'off'"
              :rules="field.rules()"
              :error-messages="field.errors()"
              @keyup.enter="handleFieldEnter(field.name)"
            >
              <template #label>
                <slot :name="`field-${field.name}`" :value="values[field.name]" :field="field">
                  {{ field.props.label }}
                </slot>
              </template>
            </component>
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
      </v-form>
      <v-overlay :model-value="loading" persistent contained class="align-center justify-center">
        <v-progress-circular indeterminate />
      </v-overlay>
    </v-container>
  </v-defaults-provider>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import {
  VTextField,
  VSelect,
  VCombobox,
  VAutocomplete,
  VFileInput,
  VSwitch,
  VCheckbox,
  VRating,
  VTextarea,
} from 'vuetify/components'
import { useDefaults, useDisplay } from 'vuetify'

import {
  type OvFormOptions,
  type OvFormData,
  OvTextAlign,
  OvActionFormat,
  OvRuleValidate,
  type OvFormFieldError,
  type OvFormTextareaField,
  type OvFormMarkdownField,
  type OvFormRatingField,
  type OvFormSelectionField,
  type OvFormSelectItem,
  type OvFormFileField,
} from './index'
import VOvEditor from './VOvEditor.vue'

const { defaults } = useDefaults({
  name: 'VOvForm',
  defaults: {
    VContainer: {
      class: 'position-relative',
    },
    VOverlay: {
      class: 'rounded',
    },
    VForm: {
      VBtn: {
        class: 'ma-1',
      },
    },
  },
})

const {
  options,
  data,
  t = (text?: string) => text || '',
  loading = false,
} = defineProps<{
  options: OvFormOptions
  data?: OvFormData
  t?: (text?: string) => string
  loading?: boolean
}>()

const emits = defineEmits<{
  (event: 'action', actionName: string, formData: OvFormData): void
  (event: 'cancel'): void
  (event: 'reset'): void
  (event: 'submit', formData: OvFormData): void
  (event: 'validate', formData: OvFormData, errors?: unknown): void
  (event: 'change', fieldName: string, value: unknown, allValues: OvFormData): void
}>()

watch(
  () => data,
  (newData: OvFormData | undefined) => {
    if (newData && Object.keys(newData).length) {
      values.value = { ...values.value, ...newData }
    }
  },
  { deep: true },
)

const { mobile } = useDisplay()

const form = ref()
const showPwd = ref(false)

// State for async autocomplete fields
const asyncItems = ref<Record<string, OvFormSelectItem[]>>({})
const asyncSelectedItems = ref<Record<string, OvFormSelectItem[]>>({})
const asyncLoading = ref<Record<string, boolean>>({})
const debounceTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({})

const getAsyncFieldItems = (fieldName: string): OvFormSelectItem[] => {
  const searchItems = asyncItems.value[fieldName] || []
  const selectedItems = asyncSelectedItems.value[fieldName] || []
  // Merge selected items with search results, avoiding duplicates
  const allItems = [...selectedItems]
  for (const item of searchItems) {
    if (!allItems.some((s) => s.value === item.value)) {
      allItems.push(item)
    }
  }
  return allItems
}

const handleAutocompleteSelect = (
  fieldName: string,
  field: OvFormSelectionField,
  value: unknown,
) => {
  if (!field.fetchItems) return
  const itemValue = field.itemValue || 'value'
  const allItems = getAsyncFieldItems(fieldName)
  const selectedItem = allItems.find(
    (item) => (item as Record<string, unknown>)[itemValue] === value,
  )
  if (selectedItem) {
    asyncSelectedItems.value[fieldName] = [selectedItem]
  } else if (value === null || value === undefined) {
    asyncSelectedItems.value[fieldName] = []
  }
}

const handleAutocompleteSearch = (
  fieldName: string,
  field: OvFormSelectionField,
  search: string | null,
) => {
  if (!field.fetchItems) return

  const searchValue = search ?? ''
  const minLength = field.minSearchLength ?? 0
  if (searchValue.length < minLength) {
    asyncItems.value[fieldName] = []
    return
  }

  // Clear existing timer
  if (debounceTimers.value[fieldName]) {
    clearTimeout(debounceTimers.value[fieldName])
  }

  const delay = field.debounce ?? 300
  debounceTimers.value[fieldName] = setTimeout(async () => {
    asyncLoading.value[fieldName] = true
    try {
      const items = await field.fetchItems!(searchValue)
      asyncItems.value[fieldName] = items
    } finally {
      asyncLoading.value[fieldName] = false
    }
  }, delay)
}

const fields = computed(() => {
  const componentMap = {
    select: VSelect,
    combobox: VCombobox,
    autocomplete: VAutocomplete,
    file: VFileInput,
    switch: VSwitch,
    checkbox: VCheckbox,
    rating: VRating,
    textarea: VTextarea,
    markdown: VOvEditor,
    text: VTextField,
    number: VTextField,
    email: VTextField,
    date: VTextField,
    time: VTextField,
    datetime: VTextField,
  }

  return (options.fields.filter((field) => !field.hidden) || []).map((field) => {
    const baseProps: Record<string, unknown> = {
      name: field.name,
      type:
        field.type == 'datetime'
          ? 'datetime-local'
          : field.type === 'password'
            ? showPwd.value
              ? 'text'
              : 'password'
            : field.type,
      label: field.label ? t(field.label) : undefined,
      placeholder: field.placeholder ? t(field.placeholder) : undefined,
      autocomplete: field.autocomplete || options.autocomplete,
      hint: field.hint ? t(field.hint) : undefined,
      clearable: field.clearable,
      prependIcon: field.prependIcon,
      appendIcon: field.appendIcon,
      prependInnerIcon: field.prependInnerIcon,
      appendInnerIcon:
        field.type === 'password'
          ? showPwd.value
            ? '$mdiEyeOff'
            : '$mdiEye'
          : field.prependInnerIcon,
      'onClick:appendInner':
        field.type === 'password' ? () => (showPwd.value = !showPwd.value) : undefined,
      required: field.required,
      readonly: field.readonly,
      disabled: field.disabled,
      variant: field.variant,
      density: field.density,
      color: field.color,
    }
    if (field.counter !== undefined) {
      baseProps.counter = ['textarea', 'text', 'email', 'password'].includes(field.type)
        ? field.counter
        : undefined
    }
    if (
      !['switch', 'rating', 'file', 'checkbox', 'select', 'combobox', 'autocomplete'].includes(
        field.type,
      )
    ) {
      baseProps.prefix = field.prefix
      baseProps.suffix = field.suffix
    }
    if (['switch', 'checkbox'].includes(field.type) && !field.color) {
      baseProps.color = 'primary'
    }
    if (field.type === 'rating' && 'form' in options && (options.disabled || options.readonly)) {
      baseProps.disabled = true
      baseProps.readonly = true
      baseProps.color = 'grey'
    }

    let specificProps: Record<string, unknown> = {}
    if (field.type === 'textarea') {
      const textareaField = field as OvFormTextareaField
      specificProps = {
        rows: textareaField.rows || 5,
        noResize: textareaField.noResize,
        autoGrow: textareaField.autoGrow,
      }
    } else if (field.type === 'markdown') {
      const markdownField = field as OvFormMarkdownField
      specificProps = {
        toolbar: markdownField.toolbar || [
          'bold',
          'italic',
          'heading1',
          'heading2',
          'bulletList',
          'orderedList',
        ],
        toolbarClass: markdownField.toolbarClass || '',
        editorClass: markdownField.editorClass || '',
        outputFormat: 'markdown',
        maxHeight: markdownField.maxHeight,
        style: markdownField.minHeight ? `min-height: ${markdownField.minHeight}` : undefined,
      }
    } else if (field.type === 'rating') {
      const ratingField = field as OvFormRatingField
      specificProps = {
        length: ratingField.length || 5,
        size: ratingField.size || 24,
        itemLabels: ratingField.itemLabels || ([field.label] as string[]),
      }
    } else if (['select', 'combobox', 'autocomplete'].includes(field.type)) {
      const selectionField = field as OvFormSelectionField
      const hasFetchItems = !!selectionField.fetchItems
      const fieldItems = hasFetchItems ? getAsyncFieldItems(field.name) : selectionField.items || []

      // Only set itemTitle/itemValue when explicitly configured or using fetchItems
      const hasObjectItems = hasFetchItems || selectionField.itemTitle || selectionField.itemValue

      specificProps = {
        items: fieldItems,
        chips: selectionField.chips || false,
        multiple: selectionField.multiple || false,
        itemTitle: hasObjectItems ? selectionField.itemTitle || 'title' : undefined,
        itemValue: hasObjectItems ? selectionField.itemValue || 'value' : undefined,
        loading: hasFetchItems ? asyncLoading.value[field.name] || false : undefined,
        'onUpdate:search': hasFetchItems
          ? (search: string) => handleAutocompleteSearch(field.name, selectionField, search)
          : undefined,
        'onUpdate:modelValue': hasFetchItems
          ? (value: unknown) => handleAutocompleteSelect(field.name, selectionField, value)
          : undefined,
      }
    } else if (field.type === 'file') {
      const fileField = field as OvFormFileField
      specificProps = {
        multiple: fileField.multiple || false,
        accept: fileField.accept,
      }
    }

    return {
      component: componentMap[field.type as keyof typeof componentMap] || VTextField,
      type: field.type,
      name: field.name,
      props: { ...baseProps, ...specificProps },
      errors: (): string[] => {
        if (!options.errors) return []
        return options.errors
          .filter((error: OvFormFieldError) => error.name === field.name)
          .map((error: OvFormFieldError) => t(error.message || ''))
      },
      rules: () =>
        (field.rules || []).map((rule) => (value: unknown) => {
          let params = rule.params
          // For 'same-as' rule, resolve the field name to its actual value
          if (rule.type === 'same-as' && typeof params === 'string') {
            params = values.value[params]
          }
          return OvRuleValidate(value, rule.type, params, t(rule.message))
        }),
    }
  })
})

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

const values = ref<OvFormData>({})
const previousValues = ref<OvFormData>({})

watch(
  () => values.value,
  (newValues: OvFormData) => {
    Object.keys(newValues).forEach((fieldName) => {
      if (newValues[fieldName] !== previousValues.value[fieldName]) {
        emits('change', fieldName, newValues[fieldName], newValues)
      }
    })
    previousValues.value = { ...newValues }
  },
  { deep: true },
)

const handleAction = async (actionName: string) => {
  const action = actions.value.find((actionItem) => actionItem.name === actionName)
  if (!action) return

  if (action.name === options.actionCancel) {
    await emits('cancel')
    return
  }

  if (action.name === options.actionReset) {
    resetValues()
    await emits('reset')
    return
  }

  if (action.name === options.actionSubmit) {
    const { valid, errors } = await form.value.validate()
    if (!valid) {
      formFocus(errors[0]?.id)
      return
    }
    await emits('submit', values.value)
    return
  }

  if (action.name === options.actionValidate) {
    const { valid, errors } = await form.value.validate()
    if (!valid) {
      formFocus(errors[0]?.id)
      await emits('validate', values.value, errors)
      return
    }
    await emits('validate', values.value)
    return
  }

  await emits('action', action.name, values.value)
}

async function handleFieldEnter(fieldName: string) {
  if (!options.actions) return
  const lastField = fields.value[fields.value.length - 1]
  const isLastField = lastField?.name === fieldName
  const hasSubmitAction = actions.value.find(
    (actionItem) => actionItem.name === options.actionSubmit,
  )
  if (isLastField && hasSubmitAction) await handleAction(hasSubmitAction.name)
}

function formFocus(elementId?: string) {
  if (!elementId) return
  const inputElement = document.getElementById(elementId) as HTMLInputElement | null
  if (inputElement) inputElement.focus()
}

function resetValues() {
  const fieldDefaults = Object.fromEntries(
    options.fields
      .filter((field) => field.value !== undefined)
      .map((field) => [field.name, field.value]),
  )
  values.value = { ...fieldDefaults, ...data }
}

onMounted(() => {
  resetValues()

  if (options.focusFirst && fields.value.length > 0) {
    const firstField = fields.value[0]
    if (firstField) {
      formFocus(firstField.name)
    }
  }
})
</script>
