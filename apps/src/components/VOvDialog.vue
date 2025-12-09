<template>
  <v-dialog
    :model-value="dialogOpen"
    @update:model-value="dialogOpen = $event"
    :activator="props.activator"
    :persistent="props.persistent"
    :fullscreen="props.fullscreen"
    :scrollable="props.scrollable"
    :width="previousBreakpointWidth"
  >
    <v-card
      :title="props.title"
      :subtitle="props.subtitle"
      :prepend-icon="props.icon"
      :color="props.color"
    >
      <v-card-text>
        <span class="text-pre-wrap text-break" v-if="props.content && !hasContentProps">
          {{ props.content }}
        </span>
        <v-chip v-if="props.content && hasContentProps && !contentProps.html" v-bind="contentProps">
          {{ props.content }}
        </v-chip>
        <div v-if="props.content && hasContentProps && contentProps.html">
          <div class="border-s-lg pa-4" v-html="cleanedHtml" />
          <v-banner color="warning" icon="$mdiAlert" class="mt-2" density="compact"
            ><v-banner-text>
              {{ t('html.content.is.sanitized.due.to.security.reasons') }}
            </v-banner-text>
          </v-banner>
        </div>
        <slot
          name="content"
          :onClose="
            () => {
              dialogOpen = false
            }
          "
        ></slot>
      </v-card-text>
      <v-card-actions v-if="actionsArray || closeable">
        <v-btn
          v-for="(action, index) in actionsArray"
          :key="index"
          v-bind="actionProps(action)"
          @click="handleAction(action)"
        >
          {{ t(String(actionProps(action).text || action)) }}
        </v-btn>

        <v-btn
          v-if="props.copyable"
          :prepend-icon="copyFeedback ? '$mdiCheckCircle' : '$mdiContentCopy'"
          color="secondary"
          @click="handleCopyToClipboard(props.content || '')"
        >
          {{ t('copy.to.clipboard') }}
        </v-btn>
        <v-btn v-if="props.closeable" color="secondary" @click="dialogOpen = false">
          {{ t('close') }}
        </v-btn>
        <slot name="actions"></slot>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useDisplay } from 'vuetify'
import { useI18n } from 'vue-i18n'
import { OvFieldFormat, OvActionFormat, type OvAction, type OvFormat } from '.'

const { name, thresholds } = useDisplay()
const previousBreakpointWidth = computed<string>(() => {
  const breakpoints = ['xs', 'sm', 'md', 'lg', 'xl', 'xxl'] as const
  const currentIndex = breakpoints.indexOf(name.value as 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl')
  const previousIndex = currentIndex > 0 ? currentIndex - 1 : 0
  const previousName = breakpoints[previousIndex]
  const width = thresholds.value[previousName as keyof typeof thresholds.value] ?? 0
  return width > 0 ? `${width}px` : '100%'
})

const { t } = useI18n()

const internalOpen = ref(false)

const props = defineProps<{
  modelValue?: boolean
  activator?: string
  persistent?: boolean
  fullscreen?: boolean
  scrollable?: boolean
  closeable?: boolean
  copyable?: boolean

  title?: string
  subtitle?: string
  icon?: string
  color?: string

  content?: string
  contentFormat?: OvFormat | OvFormat[]

  actions?: OvAction | OvAction[]
  actionFormat?: OvFormat | OvFormat[]
  actionSubmit?: string | string[]
  actionCancel?: string | string[]
}>()

const dialogOpen = computed({
  get: () => (props.activator ? internalOpen.value : (props.modelValue ?? false)),
  set: (value: boolean) => {
    if (props.activator) {
      internalOpen.value = value
    } else {
      emit('update:modelValue', value)
    }
  },
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'action', action: OvAction): void
  (e: 'submit', action: OvAction): void
  (e: 'cancel'): void
}>()

const contentProps = computed(() => {
  return OvFieldFormat(props.content, props.contentFormat)
})

const hasContentProps = computed(() => {
  return Object.keys(contentProps.value).length > 0
})

const actionsArray = computed(() => {
  return Array.isArray(props.actions) ? props.actions : props.actions ? [props.actions] : []
})

const actionProps = (action: OvAction) => {
  return OvActionFormat(action, action, props.actionFormat)
}

function handleAction(action: OvAction) {
  const actionName = typeof action === 'string' ? action : action.name
  const actionCancelNames = [props.actionCancel].flat()
  const actionSubmitNames = [props.actionSubmit].flat()
  if (actionCancelNames.includes(actionName)) {
    emit('cancel')
    dialogOpen.value = false
    return
  }
  if (actionSubmitNames.includes(actionName)) {
    emit('submit', action)
    dialogOpen.value = false
    return
  }
  emit('action', action)
}

const copyFeedback = ref(false)
const handleCopyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text)
  copyFeedback.value = true
  setTimeout(() => {
    copyFeedback.value = false
  }, 2000)
}

const cleanedHtml = computed(() => {
  const raw = props.content || ''
  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')
  doc.querySelectorAll('head style, head link[rel="stylesheet"]').forEach((el) => el.remove())
  doc.querySelectorAll('a').forEach((a) => {
    const span = doc.createElement('span')
    if (a.className) span.className = a.className
    if (a.title) span.title = a.title
    span.innerHTML = a.innerHTML
    a.replaceWith(span)
  })
  return doc.body ? doc.body.innerHTML : raw
})
</script>
