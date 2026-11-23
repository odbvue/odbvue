<template>
  <v-defaults-provider :defaults>
    <v-container :aria-busy="busy">
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
      <v-row :inert="busy">
        <v-col>
          <v-table>
            <thead>
              <tr v-if="!mobile && !options.alwaysMobile">
                <th v-if="$slots.expand" style="width: 32px" />
                <th v-for="column in columns" :key="column.name" :class="column.class">
                  {{ column.title }}
                </th>
              </tr>

              <tr v-if="options.filter || options.sort">
                <td :colspan="colspan">
                  <div class="d-flex gap-2">
                    <div>
                      <v-chip
                        v-for="chip in filterChips"
                        :key="`${chip.name}-${chip.value}`"
                        :prepend-icon="chip.icon"
                        class="ma-1"
                        color="primary"
                        closable
                        rounded
                        start
                        @click:close="handleFilterRemove(chip.name, chip.value)"
                      >
                        <strong>{{ chip.displayValue ?? chip.value }}</strong
                        >&nbsp;({{ chip.label }})
                      </v-chip>

                      <v-chip
                        v-for="sort in sortChips"
                        :key="sort.name"
                        :prepend-icon="sort.icon"
                        class="ma-1"
                        color="secondary"
                        rounded
                        @click="handleSortUpdate(sort.name, sort.value === 'asc' ? 'desc' : 'asc')"
                      >
                        <strong>{{ sort.label }}</strong>
                      </v-chip>
                    </div>
                    <div class="flex-grow-1 d-flex justify-end">
                      <v-btn
                        v-if="options.filter"
                        v-bind="OvActionFormat(undefined, 'filter', options.actionFormat)"
                        icon="$mdiFilterPlus"
                        color="primary"
                        @click="handleFilterShow()"
                      />

                      <v-btn
                        v-if="options.sort"
                        v-bind="OvActionFormat(undefined, 'sort', options.actionFormat)"
                        icon="$mdiSort"
                        color="secondary"
                      >
                        <v-icon icon="$mdiSort"> </v-icon>

                        <v-menu activator="parent">
                          <v-list>
                            <v-list-item
                              v-for="sort in sortItems"
                              :key="sort.name"
                              :title="sort.label"
                              prepend-icon="$mdiMenuLeft"
                              link
                            >
                              <v-menu
                                submenu
                                activator="parent"
                                :model-value="openSortMenu === sort.name"
                                @update:model-value="(v) => (openSortMenu = v ? sort.name : null)"
                              >
                                <v-list>
                                  <v-list-item
                                    v-for="action in sort.actions"
                                    :key="action.name"
                                    :prepend-icon="action.icon"
                                    :title="action.label"
                                    :disabled="action.disabled"
                                    @click="
                                      () => {
                                        handleSortUpdate(sort.name, action.name)
                                        openSortMenu = null
                                      }
                                    "
                                    link
                                  ></v-list-item>
                                </v-list>
                              </v-menu>
                            </v-list-item>
                          </v-list>
                        </v-menu>
                      </v-btn>
                    </div>
                  </div>
                </td>
              </tr>

              <tr v-if="options.search">
                <td :colspan>
                  <v-text-field
                    v-model="searchValue"
                    clearable
                    hide-details="auto"
                    :label="t(options.search.label || 'search')"
                    :placeholder="options.search.placeholder ? t(options.search.placeholder) : ''"
                    append-icon="$mdiMagnify"
                    @keydown.enter.prevent="fetch('first')"
                    @click:clear="fetch('first')"
                    @click:append="fetch('first')"
                  ></v-text-field>
                </td>
              </tr>

              <tr>
                <td :colspan="colspan" :class="mobile ? 'border-none' : 'border-b-sm h-0'"></td>
              </tr>
            </thead>

            <tbody v-if="!mobile && !options.alwaysMobile">
              <template v-for="item in page" :key="String(item[options.key])">
                <tr
                  :class="{ 'cursor-pointer': $slots.expand }"
                  @click="$slots.expand && toggleExpand(String(item[options.key]))"
                >
                  <td v-if="$slots.expand" style="width: 32px">
                    <v-icon size="x-small">
                      {{
                        expandedRows.has(String(item[options.key]))
                          ? '$mdiChevronDown'
                          : '$mdiChevronRight'
                      }}
                    </v-icon>
                  </td>
                  <td v-for="column in columns" :key="column.name" :class="column.class">
                    <component
                      :is="
                        renderViewItem(
                          item[column.name],
                          columnViewOptions.get(column.name),
                          item,
                          {
                            maxLength: options.maxLength,
                            actionFormat: options.actionFormat,
                            t,
                            locale,
                          } as OvViewOptions,
                          (eventName: string, ...args: unknown[]) => {
                            eventName === 'details'
                              ? showDialog(
                                  args[0] as string,
                                  args[1] as string,
                                  columnViewOptions.get(column.name)?.format as
                                    | OvFormat
                                    | OvFormat[],
                                )
                              : handleRowAction(column.name, args[0] as string, item[options.key])
                          },
                        )
                      "
                    />
                  </td>
                </tr>
                <tr v-if="$slots.expand && expandedRows.has(String(item[options.key]))">
                  <td :colspan="expandColspan" class="pa-0">
                    <slot name="expand" :item="item" />
                  </td>
                </tr>
              </template>
              <tr v-for="n in emptyRowsCount" :key="n">
                <td v-for="column in columns" :key="column.name" />
              </tr>
              <tr>
                <td :colspan="colspan" class="h-0"></td>
              </tr>
            </tbody>

            <tbody v-else v-for="item in page" :key="String(item[options.key])">
              <tr v-for="column in columns" :key="column.name">
                <td :colspan="colspan" :class="column.class">
                  <component
                    :is="
                      renderViewItem(
                        item[column.name],
                        columnViewOptions.get(column.name),
                        item,
                        {
                          maxLength: options.maxLength,
                          actionFormat: options.actionFormat,
                          t,
                          locale,
                        } as OvViewOptions,
                        (eventName: string, ...args: unknown[]) => {
                          eventName === 'details'
                            ? showDialog(
                                args[0] as string,
                                args[1] as string,
                                columnViewOptions.get(column.name)?.format as OvFormat | OvFormat[],
                              )
                            : handleRowAction(column.name, args[0] as string, item[options.key])
                        },
                      )
                    "
                  />
                </td>
              </tr>
              <tr>
                <td colspan="2" class="border-none"></td>
              </tr>
            </tbody>

            <tfoot>
              <tr>
                <td :colspan="colspan" class="border-none">
                  <v-row no-gutters>
                    <v-col cols="8">
                      <v-btn
                        v-if="hasPrevPage || hasNextPage"
                        icon="$mdiChevronLeft"
                        :title="t('previous')"
                        :disabled="busy || !hasPrevPage"
                        @click="fetch('prev')"
                      />
                      <v-btn
                        v-if="hasPrevPage || hasNextPage"
                        icon="$mdiChevronRight"
                        :title="t('next')"
                        :disabled="busy || !hasNextPage"
                        @click="fetch('next')"
                      />
                    </v-col>
                    <v-col cols="4" class="text-right">
                      <v-btn
                        v-if="canRefresh"
                        icon="$mdiRefresh"
                        :title="t('refresh')"
                        :disabled="busy"
                        @click="fetch()"
                      />
                      <v-btn
                        v-for="action in actions.regular"
                        :key="action.name"
                        v-bind="action.props"
                        :title="action.title || action.text || t(action.name)"
                        @click="handleTableAction(action.name)"
                      />
                      <v-btn
                        v-if="actions.grouped.length"
                        icon="$mdiDotsVertical"
                        variant="text"
                        size="small"
                      >
                        <v-icon icon="$mdiDotsVertical" />
                        <v-menu activator="parent">
                          <v-list density="compact">
                            <v-list-item
                              v-for="action in actions.grouped"
                              :key="action.name"
                              :prepend-icon="(action.props.icon as string) || undefined"
                              :title="action.title || action.text || t(action.name)"
                              link
                              @click="handleTableAction(action.name)"
                            />
                          </v-list>
                        </v-menu>
                      </v-btn>
                    </v-col>
                  </v-row>
                </td>
              </tr>
            </tfoot>
          </v-table>
        </v-col>
      </v-row>

      <v-Ov-dialog
        v-model="dialog"
        closeable
        scrollable
        copyable
        :title="dialogTitle ? t(dialogTitle) : ''"
        :content="dialogContent"
        :content-format="dialogContentFormat"
      />

      <v-dialog v-model="form" :persistent="loading" :width="mobile ? '100%' : '75%'">
        <v-card class="position-relative">
          <v-card-title>{{ formTitle }}</v-card-title>
          <v-card-text @mousedown.capture="handleFilterCardMouseDown">
            <v-Ov-form
              v-if="form"
              ref="tableFormRef"
              :options="formOptions"
              :data="formData"
              :t
              :loading
              hide-actions
              @action="handleFormAction"
              @submit="handleFormSubmit"
              @cancel="form = false"
            />
          </v-card-text>
          <v-card-actions v-if="formDialogActions.length">
            <v-btn
              v-for="action in formDialogActions"
              :key="action.name"
              v-bind="action.props"
              :disabled="loading || formOptions.disabled || action.disabled"
              @click="tableFormRef?.handleAction(action.name)"
            />
          </v-card-actions>
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
import {
  ref,
  computed,
  nextTick,
  onMounted,
  watch,
  inject,
  useSlots,
  onBeforeUnmount,
  type Ref,
} from 'vue'
import { useDisplay } from 'vuetify'
import VOvDialog from '../overlays/VOvDialog.vue'
import VOvForm from '../forms/VOvForm.vue'
import {
  VBtn,
  VCard,
  VCardActions,
  VCardText,
  VCardTitle,
  VChip,
  VCol,
  VContainer,
  VDefaultsProvider,
  VDialog,
  VIcon,
  VList,
  VListItem,
  VMenu,
  VOverlay,
  VProgressCircular,
  VRow,
  VTable,
  VTextField,
} from 'vuetify/components'
import {
  type OvTableOptions,
  type OvTableData,
  type OvFormOptions,
  type OvFormData,
  type OvFilterValue,
  type OvTableFetchRequest,
  type OvTablePage,
  type OvFormat,
  type OvViewOptions,
  type OvFormFieldError,
  type OvFormSelectionField,
  type OvFormSelectItem,
  OvActionFormat,
  renderViewItem,
} from '../index'
import { emptyRowCount, pageItems } from './pagination'
import { useLoadingOverlay } from '../overlays/loading'

import { useI18n } from 'vue-i18n'
const { t, locale } = useI18n()

type DefaultsRecord = Record<string, Record<string, unknown> | undefined>

function isDefaultsRecord(value: unknown): value is DefaultsRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function mergeDefaults(
  baseDefaults: DefaultsRecord,
  overrideDefaults?: DefaultsRecord,
): DefaultsRecord {
  if (!overrideDefaults) {
    return baseDefaults
  }

  const mergedDefaults: DefaultsRecord = { ...baseDefaults }

  for (const [key, value] of Object.entries(overrideDefaults)) {
    const currentValue = mergedDefaults[key]

    mergedDefaults[key] =
      isDefaultsRecord(currentValue) && isDefaultsRecord(value)
        ? mergeDefaults(currentValue, value)
        : value
  }

  return mergedDefaults
}

const fallbackDefaults = {
  VContainer: {
    class: 'position-relative',
  },
  VTable: {
    hover: true,
    VTextField: {
      density: 'compact',
      VLabel: {
        class: 'pb-0 mt-0 text-body-2',
      },
    },
    VLabel: {
      class: 'pb-1 mt-2 text-body-2',
    },
    VChip: {
      variant: 'text',
      class: 'text-wrap h-auto py-1',
    },
    VBtn: {
      size: 'small',
      variant: 'tonal',
      class: 'ma-1',
    },
  },
} satisfies DefaultsRecord

const injectedDefaults = inject(Symbol.for('vuetify:defaults')) as
  | Ref<Record<string, DefaultsRecord> | undefined>
  | undefined

const defaults = computed(() => {
  const componentDefaults = injectedDefaults?.value?.VOvTable

  return mergeDefaults(
    fallbackDefaults,
    isDefaultsRecord(componentDefaults) ? componentDefaults : undefined,
  )
})

const {
  options,
  items = [],
  nextCursor,
  loading = false,
  title,
  description,
  stateKey,
} = defineProps<{
  options: OvTableOptions
  items?: OvTableData[]
  nextCursor?: string
  loading?: boolean
  title?: string
  description?: string
  /** Overrides options.stateKey for opt-in session query preference persistence. */
  stateKey?: string
}>()

const emits = defineEmits<{
  (
    event: 'action',
    name: string,
    data: unknown,
    value?: unknown,
    callback?: (errors?: OvFormFieldError[], shouldRefetch?: boolean) => void,
  ): void
  (event: 'fetch', request: OvTableFetchRequest): void
}>()

const { mobile } = useDisplay()
const slots = useSlots()
const persistenceKey = computed(() => stateKey ?? options.stateKey)
const savedPageSizes = ref<{ desktop: number; mobile: number }>()

const localData = ref(items)
const localNextCursor = ref(nextCursor)
watch(
  () => items,
  (newItems) => {
    localData.value = newItems
  },
  { deep: true },
)
watch(
  () => nextCursor,
  (value) => {
    localNextCursor.value = value
  },
)
const page = computed(() => pageItems(localData.value, itemsPerPage.value))
const pageCursor = ref<string | undefined>(undefined)
const cursorStack = ref<(string | undefined)[]>([])
const fetching = ref(false)
const busy = computed(() => loading || fetching.value)
const loadingOverlay = useLoadingOverlay(busy)
let fetchId = 0
let finishFetch: (() => void) | undefined
let disposed = false
let committedQuery: string | undefined
const itemsPerPage = computed(() => {
  if (mobile.value) return savedPageSizes.value?.mobile ?? options.mobileItemsPerPage ?? 1
  return savedPageSizes.value?.desktop ?? options.itemsPerPage ?? 5
})
const hasNextPage = computed(() => !!localNextCursor.value)
const hasPrevPage = computed(() => cursorStack.value.length > 0)
const canRefresh = computed(() => options.canRefresh ?? true)
const emptyRowsCount = computed(() => emptyRowCount(page.value.length, itemsPerPage.value))

watch(mobile, () => {
  fetch('first')
})

const columns = computed(() => {
  return options.columns.map((column) => {
    const { name, label } = column
    return {
      name,
      title: t(label || name),
      align: column.align || options.align ? `text-${column.align || options.align}` : '',
      class: [
        column.align || options.align ? `text-${column.align || options.align}` : '',
        column.actions ? `text-no-wrap` : '',
        column.actions ? `w-0` : '',
      ],
    }
  })
})

const columnViewOptions = computed(() => {
  return new Map(
    options.columns.map((column) => [
      column.name,
      {
        name: column.name,
        label: mobile.value || options.alwaysMobile ? t(column.label || column.name) : undefined,
        format: column.format,
        actions: column.actions,
        actionFormat: column.actionFormat,
        maxLength: column.maxLength ?? options.maxLength,
      },
    ]),
  )
})

const actions = computed(() => {
  const regular: {
    name: string
    props: Record<string, unknown>
    text?: string
    title?: string
  }[] = []
  const grouped: {
    name: string
    props: Record<string, unknown>
    text?: string
    title?: string
  }[] = []

  for (const action of options.actions || []) {
    const actionObj = typeof action === 'string' ? { name: action } : action
    const props = OvActionFormat(undefined, action, options.actionFormat, t)
    const item = {
      name: actionObj.name,
      props,
      text: typeof props.text === 'string' ? props.text : undefined,
      title: typeof props.title === 'string' ? props.title : undefined,
    }

    if (actionObj.group) {
      grouped.push(item)
    } else {
      regular.push(item)
    }
  }

  return { regular, grouped }
})

//dialog

const dialog = ref(false)
const dialogTitle = ref('')
const dialogContent = ref('')
const dialogContentFormat = ref<OvFormat | OvFormat[]>()

function showDialog(dialogTitleText: string, content: string, format?: OvFormat | OvFormat[]) {
  dialogTitle.value = dialogTitleText
  dialogContent.value = content
  dialogContentFormat.value = format
  dialog.value = true
}

// form

const form = ref(false)
const formTitle = ref('')
const formOptions = ref<OvFormOptions>({ fields: [] })
const formData = ref<OvTableData>({})
const formIsFilter = ref(false)
const formActionName = ref('')
const formRowIndex = ref(-1)
const tableFormRef = ref()

const formDialogActions = computed(() => {
  return (formOptions.value.actions || []).map((action) => {
    const props = OvActionFormat(undefined, action, formOptions.value.actionFormat)
    props.text = props.text ? t(String(props.text)) : undefined
    return {
      name: props.name as string,
      props,
      disabled: 'disabled' in props && props.disabled === true,
    }
  })
})

// search

const searchValue = ref(options.search?.value || '')
const openSortMenu = ref<string | null>(null)
const colspan = computed(() => (mobile.value ? 2 : options.columns.length + (slots.expand ? 1 : 0)))

// expand
const expandedRows = ref(new Set<string>())
const expandColspan = computed(() => options.columns.length + 1)

function toggleExpand(key: string) {
  if (expandedRows.value.has(key)) {
    expandedRows.value.delete(key)
  } else {
    expandedRows.value.add(key)
  }
  expandedRows.value = new Set(expandedRows.value)
}

//filter

const filterField = ref(
  (options.filter?.fields || []).map((field) => ({
    ...field,
    value: Array.isArray(field.value) ? [...field.value] : field.value,
  })),
)
const restoredFilterItems = ref<Record<string, OvFormSelectItem[]>>({})

function getFilterItems(field: Pick<OvFormSelectionField, 'name' | 'items'>) {
  const choices = [...(field.items || [])]
  for (const restored of restoredFilterItems.value[field.name] || []) {
    if (
      !choices.some((item) => (typeof item === 'string' ? item : item.value) === restored.value)
    ) {
      choices.push(restored)
    }
  }
  return choices
}

const selectedFilterItems = computed(() => {
  const result: Record<string, OvFormSelectItem[]> = {}
  for (const field of options.filter?.fields || []) {
    if (field.type !== 'autocomplete') continue
    const value = filterField.value.find((item) => item.name === field.name)?.value
    const values = Array.isArray(value) ? value : [value]
    const selected = getFilterItems(field)
      .filter((item) => values.includes(typeof item === 'string' ? item : item.value))
      .map((item) =>
        typeof item === 'string'
          ? { title: item, value: item }
          : { title: item.title, value: item.value },
      )
    if (selected.length) result[field.name] = selected
  }
  return result
})

const filterChips = computed(() => {
  if (!options.filter) return []

  return filterField.value.flatMap((field) => {
    const values = Array.isArray(field.value) ? field.value : [field.value]
    return values
      .filter((value) => value !== undefined)
      .map((value) => ({
        name: field.name,
        label: t(field.label || field.name),
        icon: '$mdiFilter',
        color: 'primary',
        value,
        displayValue:
          field.type === 'datetime'
            ? String(value).replace('T', ' ')
            : selectedFilterItems.value[field.name]?.find((item) => item.value === value)?.title,
      }))
  })
})

function collectFilterValues(): OvFilterValue | undefined {
  const result: OvFilterValue = {}
  if (!options.filter) return result

  for (const field of filterField.value) {
    const value = field.value
    if (value === undefined) continue

    const values = Array.isArray(value) ? value.filter((v) => v !== undefined) : [value]
    if (field.type === 'datetime' && field.filterUtc) {
      if (value === null || value === '') continue
      const timestamp = typeof value === 'string' ? Date.parse(value) : NaN
      if (Number.isNaN(timestamp)) {
        console.error('Cannot fetch table data with an invalid datetime filter:', field.name)
        return undefined
      }
      result[field.name] = [new Date(timestamp).toISOString()]
    } else if (values.length) {
      result[field.name] = values.map(String)
    }
  }
  return result
}

async function handleFilterRemove(filterName: string, removedFilterValue?: unknown) {
  if (!options.filter) return

  const selectedFilterField = filterField.value.find((f) => f.name === filterName)
  if (!selectedFilterField) return

  if (Array.isArray(selectedFilterField.value)) {
    const index = selectedFilterField.value.indexOf(removedFilterValue)
    if (index >= 0) {
      selectedFilterField.value =
        selectedFilterField.value.length === 1
          ? undefined
          : selectedFilterField.value.filter((_, i) => i !== index)
    }
  } else {
    selectedFilterField.value = undefined
  }

  await fetch('first')
}

function handleFilterShow() {
  if (!options.filter) return
  formOptions.value = {
    ...options.filter,
    fields: options.filter.fields.map((field) =>
      field.type === 'autocomplete' ? { ...field, items: getFilterItems(field) } : { ...field },
    ),
    actions: options.filter.actions?.slice(),
  }

  if (!formOptions.value.actions) {
    formOptions.value.actions = []
  }

  if (!formOptions.value.actionSubmit) {
    formOptions.value.actions.push({ name: 'apply' })
    formOptions.value.actionSubmit = 'apply'
  }

  if (!formOptions.value.actionCancel) {
    formOptions.value.actions.push({ name: 'cancel' })
    formOptions.value.actionCancel = 'cancel'
  }

  formData.value = filterField.value.reduce((acc, field) => {
    acc[field.name] = field.value
    return acc
  }, {} as OvFormData)
  formTitle.value = t('filter')
  formIsFilter.value = true
  form.value = true
}

// sort

const sortItem = ref((options.sort || []).map((item) => ({ ...item })))

const sortChips = computed(() => {
  if (!options.sort) return []
  return sortItem.value
    .filter((item) => item.value)
    .map((item) => {
      return {
        name: item.name,
        label: t(item.label || item.name),
        value: item.value,
        sort: item.value === 'desc' ? `-${item.name}` : item.name,
        icon: item.value === 'desc' ? '$mdiSortDescending' : '$mdiSortAscending',
      }
    })
})

const sortItems = computed(() => {
  if (!options.sort) return []
  return sortItem.value.map((item) => {
    const sortActions = [
      {
        name: 'asc',
        label: t('ascending'),
        icon: '$mdiSortAscending',
        disabled: item.value === 'asc',
      },
      {
        name: 'desc',
        label: t('descending'),
        icon: '$mdiSortDescending',
        disabled: item.value === 'desc',
      },
    ]
    if (!options.singleSort) {
      sortActions.push(
        {
          name: 'left',
          label: t('left'),
          icon: '$mdiChevronLeft',
          disabled:
            !['asc', 'desc'].includes(String(item.value)) ||
            sortChips.value.findIndex((chip) => chip.name === item.name) === 0,
        },
        {
          name: 'right',
          label: t('right'),
          icon: '$mdiChevronRight',
          disabled:
            !['asc', 'desc'].includes(String(item.value)) ||
            sortChips.value.findIndex((chip) => chip.name === item.name) ==
              sortChips.value.length - 1,
        },
      )
    }
    return {
      name: item.name,
      label: t(item.label || item.name),
      actions: sortActions,
    }
  })
})

const sortValue = computed(() => {
  if (!sortItem.value) return ''
  return sortChips.value.map((item) => item.sort).join(',')
})

async function handleSortUpdate(sortName: string, sortAction: string) {
  if (!options.sort) return
  const foundSort = sortItem.value.find((item) => item.name === sortName)
  if (foundSort) {
    if (sortAction === 'asc' || sortAction === 'desc') {
      if (options.singleSort) {
        sortItem.value.forEach((s) => {
          if (s.name !== sortName) s.value = undefined
        })
      }
      foundSort.value = sortAction
    }
    if (sortAction === 'left') {
      const index = sortItem.value.findIndex((item) => item.name === sortName)
      if (index > 0) {
        const temp = sortItem.value[index]
        sortItem.value[index] = sortItem.value[index - 1]!
        sortItem.value[index - 1] = temp!
      }
    }
    if (sortAction === 'right') {
      const index = sortItem.value.findIndex((item) => item.name === sortName)
      if (index < sortItem.value.length - 1) {
        const temp = sortItem.value[index]
        sortItem.value[index] = sortItem.value[index + 1]!
        sortItem.value[index + 1] = temp!
      }
    }
    await fetch('first')
  }
}

// actions

const onActionComplete = async (
  formErrors?: OvFormFieldError[],
  shouldRefetch?: boolean,
  submittedData = formData.value,
) => {
  if (formErrors && formErrors.length > 0) {
    formOptions.value = {
      ...formOptions.value,
      errors: formErrors,
    }
    return
  }

  if (!shouldRefetch) {
    localData.value[formRowIndex.value] = submittedData
  }
  form.value = false
  if (shouldRefetch) {
    // Let the parent's loading prop settle before the fetch busy guard runs.
    await nextTick()
    await fetch()
  }
}

async function handleFormAction(actionName: string, actionData: OvFormData) {
  await emits('action', actionName, localData.value, actionData, onActionComplete)
}

function handleFilterCardMouseDown(event: Event) {
  const target = event.target as HTMLElement

  // If clicking inside an open menu's dropdown list, do nothing
  if (target.closest('.v-overlay__content .v-list')) return

  // Find any currently open v-select (Vuetify adds this class when menu is open)
  const activeSelect = document.querySelector('.v-select--active-menu')
  if (!activeSelect) return

  // If clicking on the same select that's open, let Vuetify handle it
  if (activeSelect.contains(target)) return

  // Close the open select by dispatching Escape to its input
  const input = activeSelect.querySelector('input') as HTMLElement | null
  if (input) {
    input.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        code: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    )
  }
}

async function handleFormSubmit(actionData: OvFormData) {
  if (formIsFilter.value) {
    Object.entries(actionData).forEach(([fieldName, fieldValue]) => {
      const selectedFilterField = filterField.value.find((f) => f.name === fieldName)
      if (selectedFilterField) {
        selectedFilterField.value =
          fieldValue === undefined || fieldValue === null || fieldValue === ''
            ? undefined
            : fieldValue
      }
    })
    form.value = false
    await nextTick()
    await fetch('first')
    return
  }

  emits('action', formActionName.value, localData.value, actionData, (errors, refetch) =>
    onActionComplete(errors, refetch, actionData),
  )
}

async function handleRowAction(columnName: string, actionName: string, keyValue?: unknown) {
  const column = options.columns.find((col) =>
    typeof col === 'string' ? col === columnName : col.name === columnName,
  )

  if (!column || !column.actions) return
  const action = column.actions.find((act) =>
    typeof act === 'string' ? act === actionName : act.name === actionName,
  )
  if (!action) return

  const rowIndex = localData.value.findIndex((item) => item[options.key] === keyValue)
  const row = localData.value[rowIndex]

  if (typeof action !== 'string' && action.form) {
    formOptions.value = typeof action.form === 'function' ? action.form(row ?? {}) : action.form
    formData.value = row ?? {}
    formTitle.value = t(action.name)
    formIsFilter.value = false
    formActionName.value = action.name
    formRowIndex.value = rowIndex
    form.value = true
    return
  }

  await emits('action', actionName, localData.value, localData.value[rowIndex], onActionComplete)
}

async function handleTableAction(actionName: string) {
  const tableAction = options.actions?.find(
    (act) => typeof act !== 'string' && act.name === actionName,
  )
  if (!tableAction) return
  if (tableAction && typeof tableAction !== 'string' && tableAction.form) {
    formOptions.value =
      typeof tableAction.form === 'function' ? tableAction.form({}) : tableAction.form
    formData.value = {}
    const fmt = OvActionFormat(undefined, tableAction, options.actionFormat)
    formTitle.value = t(fmt.text || tableAction.name)
    formIsFilter.value = false
    formRowIndex.value = -1
    formActionName.value = tableAction.name
    form.value = true
  } else await emits('action', actionName, localData.value, formData.value, onActionComplete)
}

function fetch(action?: 'first' | 'next' | 'prev'): Promise<boolean> {
  if (disposed) return Promise.resolve(false)
  if (action !== 'first' && busy.value) return Promise.resolve(false)
  const limit = itemsPerPage.value
  if (!Number.isSafeInteger(limit) || limit < 1) {
    console.error('Table page limit must be a positive safe integer')
    return Promise.resolve(false)
  }
  const search = searchValue.value?.trim() || undefined
  const filter = collectFilterValues()
  if (!filter) return Promise.resolve(false)
  const sort = sortValue.value
  const query = JSON.stringify([limit, search, filter, sort])
  const reset = action === 'first' || (committedQuery !== undefined && committedQuery !== query)
  let cursor = reset ? undefined : pageCursor.value
  const stack = reset ? [] : [...cursorStack.value]
  if (!reset && action === 'next') {
    if (!hasNextPage.value) return Promise.resolve(false)
    stack.push(cursor)
    cursor = localNextCursor.value
  } else if (!reset && action === 'prev') {
    if (!hasPrevPage.value) return Promise.resolve(false)
    cursor = stack.pop()
  }

  finishFetch?.()
  const currentFetch = ++fetchId
  const controller = new AbortController()
  fetching.value = true
  return new Promise<boolean>((resolve) => {
    let completed = false
    const complete = (result?: OvTablePage) => {
      if (completed || currentFetch !== fetchId) return
      completed = true
      let success = false
      if (result !== undefined) {
        if (
          !result ||
          !Array.isArray(result.items) ||
          result.items.length > limit ||
          (result.nextCursor !== undefined &&
            (typeof result.nextCursor !== 'string' ||
              !result.nextCursor.trim() ||
              !result.items.length ||
              result.nextCursor === cursor))
        ) {
          console.error('Invalid table page response', result)
        } else {
          localData.value = result.items
          localNextCursor.value = result.nextCursor
          success = true
        }
      }
      if (success) {
        pageCursor.value = cursor
        cursorStack.value = stack
        committedQuery = query
      }
      fetching.value = false
      finishFetch = undefined
      resolve(success)
    }
    finishFetch = () => {
      controller.abort()
      complete()
    }
    emits('fetch', { cursor, limit, search, filter, sort, signal: controller.signal, complete })
  })
}

defineExpose({
  fetch,
  resetState,
})

interface TablePersistedState {
  version: 1
  search: string
  filter: Record<string, unknown>
  filterItems?: Record<string, OvFormSelectItem[]>
  sort: { name: string; value?: 'asc' | 'desc' }[]
  pageSizes: { desktop: number; mobile: number }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPageSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

function isFilterValue(value: unknown): boolean {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (Array.isArray(value) && value.every((item) => !Array.isArray(item) && isFilterValue(item)))
  )
}

function isPersistedState(value: unknown): value is TablePersistedState {
  return (
    isRecord(value) &&
    value.version === 1 &&
    typeof value.search === 'string' &&
    isRecord(value.filter) &&
    Object.values(value.filter).every(isFilterValue) &&
    (value.filterItems === undefined ||
      (isRecord(value.filterItems) &&
        Object.values(value.filterItems).every(
          (choices: unknown) =>
            Array.isArray(choices) &&
            choices.every(
              (item: unknown) =>
                isRecord(item) && typeof item.title === 'string' && isFilterValue(item.value),
            ),
        ))) &&
    Array.isArray(value.sort) &&
    value.sort.every(
      (item: unknown) =>
        isRecord(item) &&
        typeof item.name === 'string' &&
        (item.value === undefined || item.value === 'asc' || item.value === 'desc'),
    ) &&
    isRecord(value.pageSizes) &&
    isPageSize(value.pageSizes.desktop) &&
    isPageSize(value.pageSizes.mobile)
  )
}

function saveState() {
  if (!persistenceKey.value) return
  const state: TablePersistedState = {
    version: 1,
    search: searchValue.value || '',
    filter: Object.fromEntries(filterField.value.map((field) => [field.name, field.value ?? null])),
    filterItems: Object.keys(selectedFilterItems.value).length
      ? selectedFilterItems.value
      : undefined,
    sort: sortItem.value.map(({ name, value }) => ({ name, value })),
    pageSizes: {
      desktop: savedPageSizes.value?.desktop ?? options.itemsPerPage ?? 5,
      mobile: savedPageSizes.value?.mobile ?? options.mobileItemsPerPage ?? 1,
    },
  }
  try {
    sessionStorage.setItem(persistenceKey.value, JSON.stringify(state))
  } catch (error) {
    console.warn('Unable to save table session state', error)
  }
}

function restoreState() {
  if (!persistenceKey.value) return
  try {
    const raw = sessionStorage.getItem(persistenceKey.value)
    if (!raw) return
    const state: unknown = JSON.parse(raw)
    if (!isPersistedState(state)) throw new Error('Invalid or outdated table session state')
    for (const field of filterField.value) {
      const value = state.filter[field.name]
      if (
        field.type === 'datetime' &&
        value !== undefined &&
        value !== null &&
        value !== '' &&
        (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
      ) {
        throw new Error('Invalid saved datetime filter')
      }
    }
    searchValue.value = state.search
    restoredFilterItems.value = state.filterItems || {}
    for (const field of filterField.value) {
      if (Object.hasOwn(state.filter, field.name)) {
        field.value = state.filter[field.name] ?? undefined
      }
    }
    const configuredSort = new Map(sortItem.value.map((item) => [item.name, item]))
    const restoredSort: typeof sortItem.value = []
    for (const saved of state.sort) {
      const item = configuredSort.get(saved.name)
      if (!item) continue
      item.value = saved.value
      restoredSort.push(item)
      configuredSort.delete(saved.name)
    }
    sortItem.value = [...restoredSort, ...configuredSort.values()]
    if (options.singleSort) {
      let hasSort = false
      for (const item of sortItem.value) {
        if (hasSort) item.value = undefined
        hasSort ||= !!item.value
      }
    }
    savedPageSizes.value = state.pageSizes
  } catch (error) {
    console.warn('Unable to restore table session state', error)
  }
}

function applyDefaults() {
  restoredFilterItems.value = {}
  searchValue.value = options.search?.value || ''
  filterField.value = (options.filter?.fields || []).map((field) => ({
    ...field,
    value: Array.isArray(field.value) ? [...field.value] : field.value,
  }))
  sortItem.value = (options.sort || []).map((item) => ({ ...item }))
  savedPageSizes.value = undefined
}

function resetState() {
  applyDefaults()
  saveState()
  return fetch('first')
}

watch(
  [
    searchValue,
    filterField,
    selectedFilterItems,
    sortItem,
    () => options.itemsPerPage,
    () => options.mobileItemsPerPage,
  ],
  saveState,
  { deep: true },
)

watch(persistenceKey, () => {
  applyDefaults()
  restoreState()
  fetch('first')
})

onBeforeUnmount(() => {
  disposed = true
  finishFetch?.()
  fetchId++
  saveState()
})

onMounted(async () => {
  restoreState()
  await fetch('first')
})
</script>
<style scoped>
th {
  font-weight: 800 !important;
}
.cursor-pointer {
  cursor: pointer;
}
</style>
