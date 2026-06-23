<template>
  <v-container>
    <v-row
      ><v-col cols="12"><h3>Application features</h3></v-col
      ><v-col cols="12" md="6">
        <v-card prepend-icon="$mdiPalette" title="UI Feedback" to="/sandbox/sandbox-ui" />
      </v-col>
      <v-col cols="12" md="6">
        <v-card prepend-icon="$mdiDrag" title="Drag and Drop" to="/sandbox/sandbox-dnd" /> </v-col
    ></v-row>
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    title: 'Sandbox',
    description: 'A sandbox page to test various UI components and features',
    icon: '$mdiFlask',
    color: '#DDEEFF',
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})
</script>
