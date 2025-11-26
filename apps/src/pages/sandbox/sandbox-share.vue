<template>
  <v-container fluid>
    <v-row
      ><v-col cols="12" md="6">
        <v-text-field v-model="shareOptions.url" label="URL" class="mb-4" />
        <v-text-field v-model="shareOptions.text" label="Text" class="mb-4" />
        <v-text-field v-model="shareOptions.quote" label="Quote" class="mb-4" />
        <v-text-field v-model="shareOptions.via" label="Via" class="mb-4" />
        <v-text-field v-model="shareOptions.number" label="Phone Number" class="mb-4" /> </v-col
    ></v-row>
    <v-ov-share :share-options="shareOptions" color="red" class="ma-1" />
  </v-container>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'always',
    access: 'when-authenticated',
  },
})

const shareOptions = ref<ShareOptions>({
  url: 'https://www.google.com',
  text: 'Hi',
  quote: 'Google',
  hashtags: ['google'],
  via: 'google',
  number: '+15555555555',
})
</script>
