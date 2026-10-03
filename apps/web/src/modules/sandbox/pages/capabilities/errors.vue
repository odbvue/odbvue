<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md>
        <h3>Recent errors</h3>
      </v-col>
      <v-col cols="auto">
        <v-btn icon="$mdiRefresh" aria-label="Refresh errors" @click="refresh" />
      </v-col>
      <v-col cols="auto">
        <v-btn
          icon="$mdiDeleteSweep"
          aria-label="Clear errors"
          :disabled="!events.length"
          @click="clear"
        />
      </v-col>
    </v-row>

    <v-alert
      v-if="!events.length"
      type="info"
      title="No errors captured"
      text="Captured application and Vue errors will appear here."
    />

    <v-list v-else lines="two">
      <v-list-item
        v-for="event in events"
        :key="event.id"
        :title="event.message"
        :subtitle="formatEvent(event)"
        :prepend-icon="event.severity === 'warning' ? '$mdiAlert' : '$mdiAlertCircle'"
        @click="selectedEvent = event"
      />
    </v-list>

    <v-row class="mt-6">
      <v-col cols="12"><h3>Capture samples</h3></v-col>
      <v-col cols="12" class="d-flex flex-wrap ga-2">
        <v-btn color="error" prepend-icon="$mdiAlertCircle" @click="captureSampleError">
          Capture error
        </v-btn>
        <v-btn
          color="warning"
          prepend-icon="$mdiAlert"
          variant="outlined"
          @click="captureSampleWarning"
        >
          Capture warning
        </v-btn>
      </v-col>
    </v-row>

    <v-ov-dialog
      v-model="dialogOpen"
      :title="selectedEvent?.message ?? 'Error details'"
      icon="$mdiAlertCircle"
      scrollable
      closeable
    >
      <template #content>
        <pre v-if="selectedEvent" class="text-body-2">{{
          JSON.stringify(selectedEvent, null, 2)
        }}</pre>
      </template>
    </v-ov-dialog>
  </v-container>
</template>

<script setup lang="ts">
import { errorsContract, useOdbVue, type OdbVueErrorEvent } from '@odbvue/web'
import { computed, ref } from 'vue'

definePage({
  meta: {
    title: 'Error handling',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const errors = useOdbVue().get(errorsContract)
const events = ref<OdbVueErrorEvent[]>([...errors.getEvents()])
const selectedEvent = ref<OdbVueErrorEvent>()
const dialogOpen = computed({
  get: () => !!selectedEvent.value,
  set: (open: boolean) => {
    if (!open) selectedEvent.value = undefined
  },
})

function refresh() {
  events.value = [...errors.getEvents()]
}

function clear() {
  errors.clear()
  refresh()
}

function captureSampleError() {
  errors.capture(new Error('Sandbox sample error'), {
    source: 'sandbox',
    operation: 'captureSampleError',
  })
  refresh()
}

function captureSampleWarning() {
  errors.capture('Sandbox sample warning', {
    severity: 'warning',
    source: 'sandbox',
    operation: 'captureSampleWarning',
  })
  refresh()
}

function formatEvent(event: OdbVueErrorEvent): string {
  return [event.severity, event.source, new Date(event.timestamp).toLocaleString()]
    .filter(Boolean)
    .join(' | ')
}
</script>
