<template>
  <v-defaults-provider :defaults>
    <span v-if="options.items?.length === 1 && options.items?.[0]">
      <component
        :is="
          renderViewItem(
            data[options.items[0].name],
            options.items[0],
            data,
            options,
            emit as (event: string, ...args: unknown[]) => void,
          )
        "
      />
    </span>
    <v-container v-else fluid>
      <v-row>
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
                emit as (event: string, ...args: unknown[]) => void,
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
            @click="emit('action', action.name, data)"
          />
        </v-col>
      </v-row>
      <v-overlay :model-value="loading" persistent contained class="align-center justify-center">
        <v-progress-circular indeterminate />
      </v-overlay>
    </v-container>
  </v-defaults-provider>
</template>
<script setup lang="ts">
import { useDisplay } from 'vuetify'
import type { OvViewOptions, OvViewData } from '.'
import { renderViewItem, OvTextAlign } from '.'

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
  (e: 'action', name: string, value: unknown): void
}>()

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
