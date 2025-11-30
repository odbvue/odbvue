<template>
  <v-card
    v-for="widget in widgets"
    :key="widget.name"
    :to="widget.path"
    class="ma-4 pa-4"
    :color="widget.color"
    :title="widget.name"
    :prepend-icon="widget.icon"
    variant="tonal"
    hover
  >
  </v-card>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Admin',
    description: 'Site Administration',
    icon: '$mdiShieldAccount',
    color: '#FFDDDD',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['admin'],
  },
})

const widgets = ref([
  { name: 'Users', path: '/admin/users', icon: '$mdiAccountGroup', color: 'info' },
  { name: 'Audit Logs', path: '/admin/audit', icon: '$mdiClipboardList', color: 'info' },
  { name: 'Emails', path: '/admin/emails', icon: '$mdiEmail', color: 'info' },
  { name: 'Job Scheduler', path: '/admin/jobs', icon: '$mdiCalendarClock', color: 'info' },
])
</script>
