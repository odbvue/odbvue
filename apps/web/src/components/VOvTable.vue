<template>
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
      <v-row>
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
                        <strong>{{ chip.value }}</strong
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
                        :disabled="!hasPrevPage"
                        @click="fetch('prev')"
                      />
                      <v-btn
                        v-if="hasPrevPage || hasNextPage"
                        icon="$mdiChevronRight"
                        :title="t('next')"
                        :disabled="!hasNextPage"
                        @click="fetch('next')"
                      />
                    </v-col>
                    <v-col cols="4" class="text-right">
                      <v-btn
                        v-if="canRefresh"
                        icon="$mdiRefresh"
                        :title="t('refresh')"
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

      <v-dialog v-model="form" :width="mobile ? '100%' : '75%'">
        <v-card>
          <v-card-title>{{ formTitle }}</v-card-title>
          <v-card-text @mousedown.capture="handleFilterCardMouseDown">
            <v-Ov-form
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
              @click="tableFormRef?.handleAction(action.name)"
            />
          </v-card-actions>
        </v-card>
      </v-dialog>

      <v-overlay :model-value="loading" persistent contained class="align-center justify-center">
        <v-progress-circular indeterminate />
      </v-overlay>
    </v-container>
  </v-defaults-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, inject, useSlots, onBeforeUnmount, type Ref } from 'vue'
import { useDisplay } from 'vuetify'
import {
  type OvTableOptions,
  type OvTableData,
  type OvFormOptions,
  type OvFormData,
  type OvFilterValue,
  type OvFormat,
  type OvViewOptions,
  type OvFormFieldError,
  OvActionFormat,
  renderViewItem,
} from './index'

import { useI18n } from 'vue-i18n'
const { t } = useI18n()

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
  VOverlay: {
    class: 'rounded',
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
      class: 'text-wrap',
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
  /** When provided, persists table state (search, filter, sort, page) to sessionStorage under this key. */
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
  (
    event: 'fetch',
    data: OvTableData[],
    nextCursor: string | undefined,
    limit: number,
    search?: string,
    filter?: OvFilterValue,
    sort?: string,
  ): void
}>()

const { mobile } = useDisplay()
const slots = useSlots()

const localData = ref(items)
watch(
  () => items,
  (newItems) => {
    localData.value = newItems
  },
  { deep: true },
)
const page = computed(() => localData.value.slice(0, itemsPerPage.value))
const pageCursor = ref<string | undefined>(undefined)
const cursorStack = ref<(string | undefined)[]>([])
const itemsPerPage = computed(() => {
  if (mobile.value) return options.mobileItemsPerPage ?? 1
  return options.itemsPerPage || 10
})
const hasNextPage = computed(() => !!nextCursor)
const hasPrevPage = computed(() => cursorStack.value.length > 0)
const canRefresh = computed(() => options.canRefresh ?? true)
const emptyRowsCount = computed(() =>
  page.value.length < itemsPerPage.value ? itemsPerPage.value - page.value.length : 0,
)

watch(mobile, () => {
  cursorStack.value = []
  pageCursor.value = undefined
  fetch()
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
    const props = OvActionFormat(undefined, action, options.actionFormat)
    const text = props.text ? t(String(props.text)) : undefined
    const actionTitle =
      typeof actionObj !== 'string' && actionObj.title ? t(actionObj.title) : undefined
    const item = { name: props.name as string, props, text, title: actionTitle }

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
    return { name: props.name as string, props }
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

const filterField = ref(options.filter?.fields || [])

const filterChips = computed(() => {
  if (!options.filter) return []

  return filterField.value.flatMap((field) => {
    const baseChip = {
      name: field.name,
      label: t(field.label || field.name),
      icon: '$mdiFilter',
      color: 'primary',
    }

    if (Array.isArray(field.value)) {
      return field.value
        .filter((value) => value !== undefined)
        .map((value) => ({ ...baseChip, value }))
    }

    const displayValue =
      field.type === 'datetime' ? String(field.value).replace('T', ' ') : field.value

    return field.value !== undefined ? [{ ...baseChip, value: displayValue }] : []
  })
})

const filterValue = computed(() => {
  if (!options.filter) return {}

  return filterField.value
    .filter((field) => field.value !== undefined)
    .reduce((result: OvFilterValue, field) => {
      const values = Array.isArray(field.value)
        ? field.value.filter((v) => v !== undefined)
        : [field.value]

      if (values.length > 0) {
        result[field.name] = values.map(String)
      }

      return result
    }, {})
})

async function handleFilterRemove(filterName: string, removedFilterValue?: unknown) {
  if (!options.filter) return

  const selectedFilterField = options.filter.fields.find((f) => f.name === filterName)
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
  formOptions.value = JSON.parse(JSON.stringify(options.filter))

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

  formData.value = options.filter.fields.reduce((acc, field) => {
    acc[field.name] = field.value
    return acc
  }, {} as OvFormData)
  formTitle.value = t('filter')
  formIsFilter.value = true
  form.value = true
}

// sort

const sortItem = ref(options.sort || [])

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

const onActionComplete = (formErrors?: OvFormFieldError[], shouldRefetch?: boolean) => {
  if (formErrors && formErrors.length > 0) {
    formOptions.value = {
      ...formOptions.value,
      errors: formErrors,
    }
    return
  }

  if (shouldRefetch) {
    fetch()
  } else {
    localData.value[formRowIndex.value] = formData.value
  }
  form.value = false
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
      if (fieldValue === undefined) return
      const selectedFilterField = options.filter?.fields.find((f) => f.name === fieldName)
      if (selectedFilterField) selectedFilterField.value = fieldValue
    })
    await fetch('first')
    form.value = false
    return
  }

  formData.value = actionData as OvTableData
  emits('action', formActionName.value, localData.value, actionData, onActionComplete)
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

  if (typeof action !== 'string' && action.form) {
    formOptions.value = action.form
    formData.value = localData.value[rowIndex] ?? {}
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
    formOptions.value = tableAction.form
    formData.value = {}
    const fmt = OvActionFormat(undefined, tableAction, options.actionFormat)
    formTitle.value = t(fmt.text || tableAction.name)
    formIsFilter.value = false
    formRowIndex.value = -1
    formActionName.value = tableAction.name
    form.value = true
  } else await emits('action', actionName, localData.value, formData.value, onActionComplete)
}

async function fetch(action?: 'first' | 'next' | 'prev') {
  if (action === 'first') {
    cursorStack.value = []
    pageCursor.value = undefined
  } else if (action === 'next') {
    cursorStack.value.push(pageCursor.value)
    pageCursor.value = nextCursor
  } else if (action === 'prev') {
    pageCursor.value = cursorStack.value.pop()
  }

  await emits(
    'fetch',
    localData.value,
    pageCursor.value,
    itemsPerPage.value,
    searchValue.value,
    filterValue.value,
    sortValue.value,
  )
}

defineExpose({
  fetch,
})

// State persistence via sessionStorage
interface TablePersistedState {
  search?: string
  filter?: Record<string, unknown>
  sort?: { name: string; value?: string }[]
  cursorStack?: (string | undefined)[]
  pageCursor?: string
}

function saveState() {
  if (!stateKey) return
  const state: TablePersistedState = {
    search: searchValue.value || undefined,
    filter: filterField.value.reduce(
      (acc, f) => {
        if (f.value !== undefined) acc[f.name] = f.value
        return acc
      },
      {} as Record<string, unknown>,
    ),
    sort: sortItem.value.filter((s) => s.value).map((s) => ({ name: s.name, value: s.value })),
    cursorStack: cursorStack.value,
    pageCursor: pageCursor.value,
  }
  sessionStorage.setItem(stateKey, JSON.stringify(state))
}

function restoreState(): boolean {
  if (!stateKey) return false
  const raw = sessionStorage.getItem(stateKey)
  if (!raw) return false
  try {
    const state: TablePersistedState = JSON.parse(raw)
    if (state.search) searchValue.value = state.search
    if (state.filter) {
      for (const field of filterField.value) {
        if (field.name in state.filter) {
          field.value = state.filter[field.name]
        }
      }
    }
    if (state.sort) {
      for (const saved of state.sort) {
        const item = sortItem.value.find((s) => s.name === saved.name)
        if (item) item.value = saved.value as 'asc' | 'desc' | undefined
      }
    }
    if (state.cursorStack) cursorStack.value = state.cursorStack
    if (state.pageCursor) pageCursor.value = state.pageCursor
    return true
  } catch {
    return false
  }
}

onBeforeUnmount(() => {
  saveState()
})

onMounted(async () => {
  restoreState()
  await fetch()
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
