<template>
  <div>
    <v-defaults-provider :defaults>
      <v-container>
        <v-row v-if="title || description || $slots.title || $slots.description">
          <v-col>
            <slot name="title">
              <h3 v-if="title">{{ t(title) }}</h3>
            </slot>
            <slot name="description">
              <p v-if="description">{{ t(description) }}</p>
            </slot>
          </v-col>
        </v-row>
      </v-container>
      <v-container>
        <v-form
          ref="formRef"
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
              <component
                :is="field.component"
                :ref="(el: unknown) => setFieldRef(field.name, el)"
                :model-value="values[field.name]"
                @update:model-value="(val: unknown) => handleFieldChange(field.name, val)"
                v-bind="
                  field.type === 'custom'
                    ? definedProps(field.props)
                    : {
                        ...field.props,
                        id: field.name,
                        autocomplete: field.props.autocomplete || 'off',
                        readonly: field.type === 'color' || field.props.readonly,
                        rules: field.rules,
                        'error-messages': field.errors,
                      }
                "
                v-on="
                  [
                    'text',
                    'textarea',
                    'markdown',
                    'number',
                    'email',
                    'password',
                    'date',
                    'time',
                    'datetime-local',
                    'duration',
                  ].includes(field.type)
                    ? { 'keyup.enter': () => handleFieldEnter(field.name) }
                    : {}
                "
              >
                <template #label>
                  <slot :name="`field-${field.name}`" :value="values[field.name]" :field="field">
                    {{ field.props.label }}
                  </slot>
                </template>
                <template v-if="field.type === 'color'" #append-inner>
                  <v-icon icon="$mdiPalette" />
                  <v-menu activator="parent" :close-on-content-click="false" location="bottom end">
                    <v-color-picker
                      :model-value="String(values[field.name] || '#000000')"
                      :modes="['hex', 'hexa', 'rgb']"
                      @update:model-value="(val: unknown) => handleFieldChange(field.name, val)"
                    />
                  </v-menu>
                </template>
              </component>
            </v-col>
          </v-row>
          <v-row class="mt-16" v-if="actions.length > 0 && !hideActions">
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
          <v-progress-circular indeterminate size="48" />
        </v-overlay>
      </v-container>
    </v-defaults-provider>
  </div>
</template>

<script setup lang="ts">
import {
  VBtn,
  VTextField,
  VSelect,
  VCombobox,
  VAutocomplete,
  VColorPicker,
  VCol,
  VContainer,
  VDefaultsProvider,
  VFileInput,
  VForm,
  VIcon,
  VMenu,
  VOverlay,
  VProgressCircular,
  VSwitch,
  VCheckbox,
  VRating,
  VRow,
  VTextarea,
} from 'vuetify/components'
import { useDefaults } from 'vuetify'
import VOvEditor from './VOvEditor.vue'

import {
  type OvFormOptions,
  type OvFormData,
  OvTextAlign,
  OvActionFormat,
  OvRuleValidate,
  type OvFormFieldError,
  type OvFormTextareaField,
  type OvFormMarkdownField,
  type OvFormCustomField,
  type OvFormRatingField,
  type OvFormSelectionField,
  type OvFormSelectItem,
  type OvFormFileField,
  minutesToDuration,
  durationToMinutes,
  isValidDuration,
} from '../index'
import { detectSwitchFormat, toBoolean, transformFormData } from './transforms'

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
  hideActions = false,
  title,
  description,
} = defineProps<{
  options: OvFormOptions
  data?: OvFormData
  t?: (text?: string) => string
  loading?: boolean
  hideActions?: boolean
  title?: string
  description?: string
}>()

const emits = defineEmits<{
  (event: 'action', actionName: string, formData: OvFormData): void
  (event: 'cancel'): void
  (event: 'reset'): void
  (event: 'submit', formData: OvFormData): void
  (event: 'validate', formData: OvFormData, errors?: unknown): void
  (event: 'change', fieldName: string, value: unknown, allValues: OvFormData): void
}>()

// Get duration field names for transformation
const getDurationFieldNames = () =>
  options.fields.filter((f) => f.type === 'duration').map((f) => f.name)

// Get switch field names for conversion
const getSwitchFieldNames = () =>
  options.fields.filter((f) => f.type === 'switch').map((f) => f.name)

// Store original switch field formats (Y/N, 0/1, T/F, true/false, etc.)
const switchFieldFormats = ref<Record<string, string>>({})

// Store loaded custom components to avoid reloading (shallowRef prevents deep reactivity on components)
const customComponents = shallowRef<Record<string, unknown>>({})

// Load custom component (supports lazy loading with () => Promise<any>)
const loadCustomComponent = async (fieldName: string, field: OvFormCustomField) => {
  if (customComponents.value[fieldName]) {
    return customComponents.value[fieldName]
  }

  let component: unknown = field.component
  if (typeof component === 'function') {
    component = await Promise.resolve(component())
  }

  // Handle both { default: Component } and Component
  const resolvedComponent =
    component && typeof component === 'object' && 'default' in component
      ? component.default
      : component
  const rawComponent =
    resolvedComponent !== null &&
    (typeof resolvedComponent === 'object' || typeof resolvedComponent === 'function')
      ? markRaw(toRaw(resolvedComponent))
      : resolvedComponent
  customComponents.value = {
    ...customComponents.value,
    [fieldName]: rawComponent,
  }
  return rawComponent
}

const definedProps = (props: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(props).filter(([, value]) => value !== undefined))

// Convert various string formats to boolean (Y/N, 0/1, T/F, true/false)
// Convert boolean back to original format
const fromBoolean = (value: boolean, originalFormat?: string): string | number | boolean => {
  // If we know the original format, use it
  if (originalFormat === 'Y/N') return value ? 'Y' : 'N'
  if (originalFormat === '0/1') return value ? '1' : '0'
  if (originalFormat === 'T/F') return value ? 'T' : 'F'
  if (originalFormat === 'true/false') return value ? 'true' : 'false'

  // Default to Y/N format (most common in databases)
  return value ? 'Y' : 'N'
}

// Transform incoming numeric values to duration strings for display
// Also convert switch field values from strings to booleans
const transformIncomingData = (incomingData: OvFormData): OvFormData => {
  const transformed = transformFormData(
    incomingData,
    getDurationFieldNames(),
    getSwitchFieldNames(),
  )
  Object.assign(switchFieldFormats.value, transformed.switchFieldFormats)
  return transformed.values
}

watch(
  () => JSON.stringify(data),
  () => {
    if (data) {
      if (Object.keys(data).length) {
        const transformed = transformIncomingData(data)
        values.value = { ...values.value, ...transformed }
        syncAsyncSelectedItems()
      } else {
        values.value = {}
        syncAsyncSelectedItems()
      }
    }
  },
)

watch(
  () =>
    JSON.stringify(
      options.fields.map((field) => {
        if (!['select', 'combobox', 'autocomplete'].includes(field.type)) {
          return [field.name, null]
        }
        const selectionField = field as OvFormSelectionField
        return [field.name, selectionField.items || null]
      }),
    ),
  () => {
    syncAsyncSelectedItems()
  },
)

const { mobile } = useDisplay()

const formRef = ref()
const showPwd = ref(false)

// Refs for field components
const fieldRefs = ref<Record<string, unknown>>({})

const setFieldRef = (fieldName: string, el: unknown) => {
  if (el) {
    fieldRefs.value[fieldName] = el
  }
}

const focusField = (fieldName: string, position: 'start' | 'end' | number = 'end') => {
  const fieldRef = fieldRefs.value[fieldName]
  if (!fieldRef) {
    formFocus(fieldName)
    return
  }
  if (typeof fieldRef === 'object' && fieldRef !== null) {
    const component = fieldRef as Record<string, unknown>
    if (typeof component.focus === 'function') {
      component.focus(position)
      return
    }
    if (component.editor && typeof component.editor === 'object') {
      const editor = component.editor as {
        value?: {
          commands?: { focus: (pos: 'start' | 'end' | number) => void }
        }
      }
      editor.value?.commands?.focus(position)
      return
    }
  }
  formFocus(fieldName)
}

const scrollToAndFocus = (fieldName: string, position: 'start' | 'end' | number = 'end') => {
  nextTick(() => {
    if (formRef.value?.$el && typeof formRef.value.$el.scrollIntoView === 'function') {
      formRef.value.$el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
    setTimeout(() => {
      focusField(fieldName, position)
    }, 100)
  })
}

// State for async autocomplete fields
const asyncItems = ref<Record<string, OvFormSelectItem[]>>({})
const asyncSelectedItems = ref<Record<string, OvFormSelectItem[]>>({})
const asyncLoading = ref<Record<string, boolean>>({})
const debounceTimers = ref<Record<string, ReturnType<typeof setTimeout>>>({})

const normalizeSelectionItems = (
  items: OvFormSelectionField['items'] | undefined,
): OvFormSelectItem[] => {
  return (items || []).map((item) =>
    typeof item === 'string' ? { title: item, value: item } : item,
  )
}

const getAsyncFieldItems = (
  fieldName: string,
  field?: OvFormSelectionField,
): OvFormSelectItem[] => {
  const configuredItems = normalizeSelectionItems(field?.items)
  const searchItems = asyncItems.value[fieldName] || []
  const selectedItems = asyncSelectedItems.value[fieldName] || []
  const allItems = [...configuredItems]
  for (const item of selectedItems) {
    if (!allItems.some((s) => s.value === item.value)) {
      allItems.push(item)
    }
  }
  for (const item of searchItems) {
    if (!allItems.some((s) => s.value === item.value)) {
      allItems.push(item)
    }
  }
  return allItems
}

const syncAsyncSelectedItems = () => {
  for (const field of options.fields) {
    if (!['select', 'combobox', 'autocomplete'].includes(field.type)) {
      continue
    }

    const selectionField = field as OvFormSelectionField
    if (!selectionField.fetchItems) {
      continue
    }

    const fieldName = selectionField.name
    const fieldValue = values.value[fieldName]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      asyncSelectedItems.value[fieldName] = []
      continue
    }

    // If format.value is set, resolve the display title from form data
    if (selectionField.format?.value) {
      const displayTitle = selectionField.format.value.replace(
        /\{\{value\.([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g,
        (_, key) => String(values.value[key] ?? ''),
      )
      if (displayTitle) {
        asyncSelectedItems.value[fieldName] = [{ title: displayTitle, value: fieldValue }]
        continue
      }
    }

    const itemValue = selectionField.itemValue || 'value'
    const selectedItem = getAsyncFieldItems(fieldName, selectionField).find(
      (item) => (item as Record<string, unknown>)[itemValue] === fieldValue,
    )

    if (selectedItem) {
      asyncSelectedItems.value[fieldName] = [selectedItem]
    }
  }
}

const handleAutocompleteSelect = (
  fieldName: string,
  field: OvFormSelectionField,
  value: unknown,
) => {
  if (!field.fetchItems) return
  const itemValue = field.itemValue || 'value'
  const allItems = getAsyncFieldItems(fieldName, field)
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

  if (debounceTimers.value[fieldName]) {
    clearTimeout(debounceTimers.value[fieldName])
  }

  const delay =
    searchValue === '' && !asyncItems.value[fieldName]?.length ? 0 : (field.debounce ?? 300)
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
    color: VTextField,
    text: VTextField,
    number: VTextField,
    email: VTextField,
    password: VTextField,
    date: VTextField,
    time: VTextField,
    datetime: VTextField,
    duration: VTextField,
  }

  return (options.fields.filter((field) => !field.hidden) || []).map((field) => {
    const baseProps: Record<string, unknown> = {
      name: field.name,
      type:
        field.type === 'datetime'
          ? 'datetime-local'
          : field.type === 'password'
            ? showPwd.value
              ? 'text'
              : 'password'
            : field.type === 'duration'
              ? 'text'
              : field.type,
      label: field.label ? t(field.label) : undefined,
      placeholder:
        field.type === 'duration' && !field.placeholder
          ? '1w 2d 3h 4m'
          : field.placeholder
            ? t(field.placeholder)
            : undefined,
      autocomplete: field.autocomplete || options.autocomplete,
      hint:
        field.type === 'duration' && !field.hint
          ? 'w=40h, d=8h, h=60m'
          : field.hint
            ? t(field.hint)
            : undefined,
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
      ![
        'switch',
        'rating',
        'file',
        'checkbox',
        'select',
        'combobox',
        'autocomplete',
        'markdown',
      ].includes(field.type)
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
        toolbar: markdownField.toolbar,
        toolbarClass: markdownField.toolbarClass,
        editorClass: markdownField.editorClass,
        minHeight: markdownField.minHeight || '150px',
        maxHeight: markdownField.maxHeight || '400px',
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
      const fieldItems = hasFetchItems
        ? getAsyncFieldItems(field.name, selectionField)
        : selectionField.items || []

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
        onFocus: hasFetchItems
          ? () => handleAutocompleteSearch(field.name, selectionField, '')
          : undefined,
      }
    } else if (field.type === 'file') {
      const fileField = field as OvFormFileField
      specificProps = {
        multiple: fileField.multiple || false,
        accept: fileField.accept,
      }
    } else if (field.type === 'custom') {
      const customField = field as OvFormCustomField
      specificProps = customField.props || {}
    }

    // Determine component to use
    let component: unknown
    if (field.type === 'custom') {
      // Use pre-loaded custom component
      component = customComponents.value[field.name] || VTextField
    } else {
      component = componentMap[field.type as keyof typeof componentMap] || VTextField
    }

    return {
      component,
      type: field.type,
      name: field.name,
      props: { ...baseProps, ...specificProps },
      errors: options.errors
        ? options.errors
            .filter((error: OvFormFieldError) => error.name === field.name)
            .map((error: OvFormFieldError) => t(error.message || ''))
        : [],
      rules: (() => {
        const fieldRules = (field.rules || []).map((rule) => (value: unknown) => {
          let params = rule.params
          if (rule.type === 'same-as' && typeof params === 'string') {
            params = values.value[params]
          }
          return OvRuleValidate(value, rule.type, params, t(rule.message))
        })
        if (field.type === 'duration') {
          fieldRules.push((value: unknown) => {
            if (!value || (typeof value === 'string' && value.trim() === '')) return true
            if (typeof value === 'string' && isValidDuration(value)) return true
            return t('invalid.duration.format') || 'Invalid format. Use: 1w 2d 3h 4m'
          })
        }
        return fieldRules
      })(),
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

function handleFieldChange(fieldName: string, val: unknown) {
  values.value[fieldName] = val
  emits('change', fieldName, val, values.value)
}

// Transform duration strings back to minutes for emitting
// Also convert boolean switch values back to original format
const getTransformedValues = (): OvFormData => {
  const result = { ...values.value }
  const durationFields = getDurationFieldNames()
  for (const fieldName of durationFields) {
    const val = result[fieldName]
    if (typeof val === 'string' && val.trim() !== '') {
      result[fieldName] = durationToMinutes(val)
    } else if (val === '' || val === null || val === undefined) {
      result[fieldName] = null
    }
  }

  const switchFields = getSwitchFieldNames()
  for (const fieldName of switchFields) {
    const val = result[fieldName]
    if (typeof val === 'boolean') {
      // Convert boolean back to original format
      const originalFormat = switchFieldFormats.value[fieldName]
      result[fieldName] = fromBoolean(val, originalFormat)
    }
  }

  return result
}

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
    const { valid, errors } = await formRef.value.validate()
    if (!valid) {
      formFocus(errors[0]?.id)
      return
    }
    await emits('submit', getTransformedValues())
    return
  }

  if (action.name === options.actionValidate) {
    const { valid, errors } = await formRef.value.validate()
    if (!valid) {
      formFocus(errors[0]?.id)
      await emits('validate', getTransformedValues(), errors)
      return
    }
    await emits('validate', getTransformedValues())
    return
  }

  await emits('action', action.name, getTransformedValues())
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
  syncAsyncSelectedItems()
}

onMounted(async () => {
  resetValues()

  // Preload all custom components
  const customFields = options.fields.filter((f) => f.type === 'custom')
  for (const field of customFields) {
    try {
      await loadCustomComponent(field.name, field as OvFormCustomField)
    } catch (error) {
      console.error(`Failed to load custom component for field ${field.name}:`, error)
    }
  }

  if (options.focusFirst && fields.value.length > 0) {
    const firstField = fields.value[0]
    if (firstField) {
      formFocus(firstField.name)
    }
  }
})

// Watch for new custom fields added after mount (e.g. attribute fields loaded async)
watch(
  () => options.fields,
  async (newFields) => {
    const customFields = newFields.filter(
      (f) => f.type === 'custom' && !customComponents.value[f.name],
    )
    for (const field of customFields) {
      try {
        await loadCustomComponent(field.name, field as OvFormCustomField)
      } catch (error) {
        console.error(`Failed to load custom component for field ${field.name}:`, error)
      }
    }
  },
)

onUnmounted(() => {
  Object.values(debounceTimers.value).forEach(clearTimeout)
})

defineExpose({
  focusField,
  scrollToAndFocus,
  formRef,
  values,
  actions,
  handleAction,
  validate: () => formRef.value.validate(),
  getValues: getTransformedValues,
})
</script>
