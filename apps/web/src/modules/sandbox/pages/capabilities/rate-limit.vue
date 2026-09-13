<template>
  <v-container>
    <v-row align="center">
      <v-col cols="12" md>
        <h3>Rate limit laboratory</h3>
        <p class="text-medium-emphasis">
          Fixed-window failure throttling used by database procedures.
        </p>
      </v-col>
      <v-col cols="auto">
        <v-chip :color="blocked ? 'error' : 'success'" prepend-icon="$mdiSpeedometer">
          {{ blocked ? `Blocked for ${remainingSeconds}s` : 'Accepting requests' }}
        </v-chip>
      </v-col>
    </v-row>

    <v-row class="mt-2">
      <v-col cols="12" md="7">
        <v-card title="Bucket simulator" prepend-icon="$mdiGauge">
          <v-card-text>
            <v-row>
              <v-col cols="12" sm="6">
                <v-text-field v-model="scope" label="Scope" hide-details />
              </v-col>
              <v-col cols="12" sm="6">
                <v-text-field v-model="subject" label="Subject" hide-details />
              </v-col>
            </v-row>
            <v-progress-linear
              class="mt-6"
              :model-value="Math.min(failures, maxFailures) * (100 / maxFailures)"
              :color="blocked ? 'error' : failures >= maxFailures - 1 ? 'warning' : 'primary'"
              height="12"
              rounded="0"
            />
            <div class="d-flex justify-space-between mt-2 text-body-2">
              <span>{{ failures }} failed attempts</span>
              <span>{{ maxFailures }} failures per minute</span>
            </div>
          </v-card-text>
          <v-card-actions>
            <v-btn
              color="primary"
              prepend-icon="$mdiCloseCircleOutline"
              :disabled="blocked"
              @click="recordFailure"
            >
              Record failure
            </v-btn>
            <v-btn prepend-icon="$mdiCheckCircleOutline" @click="reset">Record success</v-btn>
          </v-card-actions>
        </v-card>
      </v-col>

      <v-col cols="12" md="5">
        <v-card title="Stored bucket" prepend-icon="$mdiDatabaseLock">
          <v-list density="compact">
            <v-list-item title="Scope" :subtitle="scope || 'Required'" />
            <v-list-item title="Subject" :subtitle="subject || 'Required'" />
            <v-list-item title="Window" subtitle="60 seconds" />
            <v-list-item title="Temporary block" subtitle="60 seconds after 5 failures" />
          </v-list>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref } from 'vue'

definePage({
  meta: {
    title: 'Rate limit',
    icon: '$mdiSpeedometer',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const maxFailures = 5
const blockSeconds = 60
const scope = ref('AUTH_LOGIN_USERNAME')
const subject = ref('admin')
const failures = ref(0)
const blockedUntil = ref<number | null>(null)
const now = ref(Date.now())
const blocked = computed(() => (blockedUntil.value ?? 0) > now.value)
const remainingSeconds = computed(() =>
  Math.max(0, Math.ceil(((blockedUntil.value ?? 0) - now.value) / 1000)),
)

const timer = window.setInterval(() => {
  now.value = Date.now()
  if (blockedUntil.value !== null && !blocked.value) reset()
}, 1_000)

onBeforeUnmount(() => window.clearInterval(timer))

function recordFailure() {
  failures.value += 1
  if (failures.value >= maxFailures) blockedUntil.value = Date.now() + blockSeconds * 1_000
}

function reset() {
  failures.value = 0
  blockedUntil.value = null
}
</script>
