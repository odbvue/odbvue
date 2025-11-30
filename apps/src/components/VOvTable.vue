<template>
  <v-defaults-provider :defaults>
    <v-container>
      <v-row>
        <v-col>
          <v-table>
            <thead>
              <tr v-if="!mobile && !options.alwaysMobile">
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
                        closable
                        rounded
                        @click="handleSortUpdate(sort.name, sort.value == 'asc' ? 'desc' : 'asc')"
                        @click:close="handleSortUpdate(sort.name, 'close')"
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
                              <v-menu submenu activator="parent">
                                <v-list>
                                  <v-list-item
                                    v-for="action in sort.actions"
                                    :key="action.name"
                                    :prepend-icon="action.icon"
                                    :title="action.label"
                                    :disabled="action.disabled"
                                    @click="handleSortUpdate(sort.name, action.name)"
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
                    :placeholder="t(options.search.placeholder || '')"
                    append-icon="$mdiMagnify"
                    @keydown.enter.prevent="fetch(1)"
                    @click:clear="fetch(1)"
                    @click:append="fetch(1)"
                  ></v-text-field>
                </td>
              </tr>

              <tr>
                <td :colspan="colspan" :class="mobile ? 'border-none' : 'border-b-sm h-0'"></td>
              </tr>
            </thead>

            <tbody v-if="!mobile && !options.alwaysMobile">
              <tr v-for="item in page" :key="String(item[options.key])">
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
                        } as OvViewOptions,
                        (eventName: string, ...args: unknown[]) => {
                          eventName === 'details'
                            ? showDialog(args[0] as string, args[1] as string)
                            : handleRowAction(column.name, args[0] as string, item[options.key])
                        },
                      )
                    "
                  />
                </td>
              </tr>
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
                        } as OvViewOptions,
                        (eventName: string, ...args: unknown[]) => {
                          eventName === 'details'
                            ? showDialog(args[0] as string, args[1] as string)
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
                        :disabled="!hasPrevPage"
                        @click="fetch(currentPage - 1)"
                      />
                      <v-btn
                        v-if="hasPrevPage || hasNextPage"
                        icon="$mdiChevronRight"
                        :disabled="!hasNextPage"
                        @click="fetch(currentPage + 1)"
                      />
                    </v-col>
                    <v-col cols="4" class="text-right">
                      <v-btn v-if="canRefresh" icon="$mdiRefresh" @click="fetch()" />
                      <v-btn
                        v-for="action in actions"
                        :key="action.name"
                        v-bind="action.props"
                        @click="handleTableAction(action.name)"
                      />
                    </v-col>
                  </v-row>
                </td>
              </tr>
            </tfoot>
          </v-table>
        </v-col>
      </v-row>

      <v-ov-dialog
        v-model="dialog"
        closeable
        scrollable
        copyable
        :title="t(dialogTitle)"
        :content="dialogContent"
        :content-format="dialogContentFormat"
      />

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
import { ref, computed, onMounted, watch } from 'vue'
import { useDefaults, useDisplay } from 'vuetify'
import {
  type OvTableOptions,
  type OvTableData,
  type OvFormOptions,
  type OvFormData,
  type OvFilterValue,
  type OvFormat,
  type OvViewOptions,
  OvActionFormat,
  renderViewItem,
} from './index'

import { useI18n } from 'vue-i18n'
const { t } = useI18n()

const { defaults } = useDefaults({
  name: 'VOvForm',
  defaults: {
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
      },
      VLabel: {
        class: 'pb-1 mt-2 text-body-2',
      },
      VChip: {
        variant: 'text',
      },
      VBtn: {
        size: 'small',
        variant: 'tonal',
        class: 'ma-1',
      },
    },
  },
})

const {
  options,
  data = [],
  loading = false,
} = defineProps<{
  options: OvTableOptions
  data?: OvTableData[]
  loading?: boolean
}>()

const emits = defineEmits<{
  (event: 'action', name: string, data: unknown, value?: unknown): void
  (
    event: 'fetch',
    data: OvTableData[],
    offset: number,
    limit: number,
    search?: string,
    filter?: OvFilterValue,
    sort?: string,
  ): void
}>()

const { mobile } = useDisplay()

const localData = ref(data)
watch(
  () => data,
  (newData) => {
    localData.value = newData
  },
  { deep: true },
)
const page = computed(() => localData.value.slice(0, itemsPerPage.value))
const currentPage = ref(options.currentPage || 1)
const itemsPerPage = computed(() => options.itemsPerPage || (mobile.value ? 1 : 10))
const hasNextPage = computed(() => localData.value.length > itemsPerPage.value)
const hasPrevPage = computed(() => currentPage.value > 1)
const canRefresh = computed(() => options.canRefresh ?? true)
const emptyRowsCount = computed(() =>
  page.value.length < itemsPerPage.value ? itemsPerPage.value - page.value.length : 0,
)

watch(mobile, () => {
  fetch(1)
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
  return (options.actions || []).map((action) => {
    const props = OvActionFormat(undefined, action, options.actionFormat)
    props.text = props.text ? t(String(props.text)) : undefined
    return {
      name: props.name as string,
      props,
    }
  })
})

//dialog

const dialog = ref(false)
const dialogTitle = ref('')
const dialogContent = ref('')
const dialogContentFormat = ref<OvFormat | OvFormat[]>()

function showDialog(title: string, content: string, format?: OvFormat | OvFormat[]) {
  dialogTitle.value = title
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

// search

const searchValue = ref(options.search?.value || '')
const colspan = computed(() => (mobile.value ? 2 : options.columns.length))

//filter

const filter = ref(options.filter?.fields || [])

const filterChips = computed(() => {
  if (!options.filter) return []

  return filter.value.flatMap((field) => {
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

  return filter.value
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

async function handleFilterRemove(filterName: string, filterValue?: unknown) {
  if (!options.filter) return

  const filterField = options.filter.fields.find((filter) => filter.name === filterName)
  if (!filterField) return

  if (Array.isArray(filterField.value)) {
    const index = filterField.value.indexOf(filterValue)
    if (index >= 0) {
      filterField.value =
        filterField.value.length === 1 ? undefined : filterField.value.filter((_, i) => i !== index)
    }
  } else {
    filterField.value = undefined
  }

  await fetch(1)
}

function handleFilterShow() {
  if (!options.filter) return
  formOptions.value = options.filter

  if (!formOptions.value.actionSubmit) {
    formOptions.value.actions?.push({ name: 'apply' })
    formOptions.value.actionSubmit = 'apply'
  }

  if (!formOptions.value.actionCancel) {
    formOptions.value.actions?.push({ name: 'cancel' })
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

const sort = ref(options.sort || [])

const sortChips = computed(() => {
  if (!options.sort) return []
  return sort.value
    .filter((sort) => sort.value)
    .map((sort) => {
      return {
        name: sort.name,
        label: t(sort.label || sort.name),
        value: sort.value,
        sort: sort.value == 'desc' ? `-${sort.name}` : sort.name,
        icon: sort.value == 'desc' ? '$mdiSortDescending' : '$mdiSortAscending',
      }
    })
})

const sortItems = computed(() => {
  if (!options.sort) return []
  return sort.value.map((sort) => {
    return {
      name: sort.name,
      label: t(sort.label || sort.name),
      actions: [
        {
          name: 'asc',
          label: t('ascending'),
          icon: '$mdiSortAscending',
          disabled: sort.value == 'asc',
        },
        {
          name: 'desc',
          label: t('descending'),
          icon: '$mdiSortDescending',
          disabled: sort.value == 'desc',
        },
        {
          name: 'left',
          label: t('left'),
          icon: '$mdiChevronLeft',
          disabled:
            !['asc', 'desc'].includes(String(sort.value)) ||
            sortChips.value.findIndex((chip) => chip.name === sort.name) == 0,
        },
        {
          name: 'right',
          label: t('right'),
          icon: '$mdiChevronRight',
          disabled:
            !['asc', 'desc'].includes(String(sort.value)) ||
            sortChips.value.findIndex((chip) => chip.name === sort.name) ==
              sortChips.value.length - 1,
        },
        {
          name: 'close',
          label: t('close'),
          icon: '$mdiClose',
          disabled: !sort.value,
        },
      ],
    }
  })
})

const sortValue = computed(() => {
  if (!sort.value) return ''
  return sortChips.value.map((sort) => sort.sort).join(',')
})

async function handleSortUpdate(sortName: string, sortAction: string) {
  if (!options.sort) return
  const foundSort = sort.value.find((sort) => sort.name === sortName)
  if (foundSort) {
    if (sortAction == 'asc') foundSort.value = sortAction
    if (sortAction == 'desc') foundSort.value = sortAction
    if (sortAction == 'close') foundSort.value = undefined
    if (sortAction == 'left') {
      const index = sort.value.findIndex((sort) => sort.name === sortName)
      if (index > 0) {
        const temp = sort.value[index]
        sort.value[index] = sort.value[index - 1]!
        sort.value[index - 1] = temp!
      }
    }
    if (sortAction == 'right') {
      const index = sort.value.findIndex((sort) => sort.name === sortName)
      if (index < sort.value.length - 1) {
        const temp = sort.value[index]
        sort.value[index] = sort.value[index + 1]!
        sort.value[index + 1] = temp!
      }
    }
    await fetch()
  }
}

// actions

async function handleFormAction(actionName: string, actionData: OvFormData) {
  await emits('action', actionName, localData.value, actionData)
}

async function handleFormSubmit(actionData: OvFormData) {
  if (formIsFilter.value) {
    Object.entries(actionData).forEach(([fieldName, value]) => {
      if (value === undefined) return
      const filterField = options.filter?.fields.find((filter) => filter.name === fieldName)
      if (filterField) filterField.value = value
    })
    await fetch(1)
    form.value = false
    return
  }

  await emits('action', formActionName.value, localData.value, actionData)
  localData.value[formRowIndex.value] = actionData
  form.value = false
}

async function handleRowAction(columnName: string, actionName: string, keyValue?: unknown) {
  const column = options.columns.find((column) =>
    typeof column === 'string' ? column === columnName : column.name == columnName,
  )
  if (!column || !column.actions) return
  const action = column.actions.find((action) =>
    typeof action === 'string' ? action === actionName : action.name === actionName,
  )
  if (!action) return

  const rowIndex = localData.value.findIndex((item) => item[options.key] == keyValue)

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

  await emits('action', actionName, localData.value, localData.value[rowIndex])
}

async function handleTableAction(actionName: string) {
  const action = options.actions?.find(
    (action) => typeof action !== 'string' && action.name == actionName,
  )
  if (!action) return
  if (action && typeof action !== 'string' && action.form) {
    formOptions.value = action.form
    formData.value = {}
    const fmt = OvActionFormat(undefined, action, options.actionFormat)
    formTitle.value = t(fmt.text || action.name)
    formIsFilter.value = false
    formRowIndex.value = -1
    formActionName.value = action.name
    form.value = true
  } else await emits('action', actionName, localData.value, formData.value)
}

async function fetch(newPage?: number) {
  if (newPage) currentPage.value = newPage
  await emits(
    'fetch',
    localData.value,
    (currentPage.value - 1) * itemsPerPage.value,
    itemsPerPage.value + 1,
    searchValue.value,
    filterValue.value,
    sortValue.value,
  )
}

defineExpose({
  fetch,
})

onMounted(async () => {
  await fetch()
})
</script>
<style scoped>
th {
  font-weight: 800 !important;
}
</style>
