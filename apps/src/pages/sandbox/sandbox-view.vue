<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <h3>Single item</h3>
        <v-ov-view :data="{ name: data.name }" :options="{ items: [{ name: 'name' }] }" />
      </v-col>
      <v-col cols="12">
        <h3>Action icons</h3>
        <v-ov-view :data="data" :options="options" @action="action" />
      </v-col>
      <v-col cols="12">
        <h3>Contact Information with Icons</h3>
        <v-ov-view :data="contactData" :options="contactOptions" />
      </v-col>
      <v-col cols="12">
        <h3>Various Data Formats</h3>
        <v-ov-view :data="dataFormats" :options="formatOptions" />
      </v-col>
    </v-row>
  </v-container>
</template>
<script setup lang="ts">
definePage({
  meta: {
    visibility: 'always',
    access: 'when-authenticated',
  },
})

import type { OvViewOptions } from '@/components'

function action(name: string, value: unknown) {
  if (!name || !value) return
  if (name === 'status') data.value.status = value === 'active' ? 'disabled' : 'active'
  console.log('action triggered', name, value)
}

const data = ref({
  name: 'Sample Sandbox',
  description: 'This is a sample description for the sandbox view component demonstration.',
  status: 'active',
})

const contactData = ref({
  email: 'john.doe@example.com',
  phone: '+1 (555) 123-4567',
  mobile: '+1 (555) 987-6543',
  website: 'https://example.com',
  address: '123 Main Street, New York, NY 10001',
  zipcode: '10001',
})

const dataFormats = ref({
  date: '2024-11-18',
  time: '14:30:45',
  url: 'https://github.com/odbvue',
  ipAddress: '192.168.1.1',
  fileSize: '2.5 GB',
  percentage: '87%',
  rating: '4.5/5',
  amount: '$1,234.56',
  verified: 'verified',
  error: 'failed',
})

const options = <OvViewOptions>{
  cols: 2,
  items: [
    {
      name: 'name',
    },
    {
      name: 'description',
      label: 'Description',
      maxLength: 30,
    },
    {
      name: 'status',
      format: [
        {
          rules: { type: 'starts-with', params: 'active' },
          color: 'green',
          rounded: true,
        },
        { color: 'red', rounded: true },
      ],
      actions: [
        {
          name: 'status',
          key: 'status',
          format: { icon: '$mdiSwapHorizontal', class: 'mx-2', text: 'Toggle Status' },
        },
      ],
    },
    {
      name: 'status',
      format: { hidden: true },
      actions: [
        {
          name: 'status',
          key: 'status',
          format: { text: 'Toggle Status' },
        },
      ],
    },
  ],
  actions: [
    {
      name: 'print',
      format: { icon: '$mdiPrinter', text: 'Print' },
    },
  ],
}

const contactOptions = <OvViewOptions>{
  cols: 3,
  items: [
    {
      name: 'email',
      label: 'Email',
      format: {
        icon: '$mdiEmail',
        color: 'blue',
        href: 'mailto:{{value}}',
        target: '_blank',
      },
    },
    {
      name: 'phone',
      label: 'Phone',
      format: {
        icon: '$mdiPhone',
        color: 'green',
      },
      actions: [
        {
          name: 'phone',
          key: 'phone',
          format: { class: 'mx-2', size: 'small', icon: '$mdiPhoneDial', text: 'Call' },
        },
      ],
    },
    {
      name: 'mobile',
      label: 'Mobile',
      format: {
        icon: '$mdiCellphone',
        color: 'purple',
      },
    },
    {
      name: 'website',
      label: 'Website',
      format: {
        icon: '$mdiWeb',
        color: 'indigo',
        href: '{{value}}',
        target: '_blank',
      },
    },
    {
      name: 'address',
      label: 'Address',
      format: {
        icon: '$mdiMapMarker',
        color: 'orange',
      },
      maxLength: 35,
    },
    {
      name: 'zipcode',
      label: 'ZIP Code',
      format: [
        {
          rules: { type: 'equals', params: '10001' },
          icon: '$mdiCheckCircle',
          color: 'success',
        },
        {
          icon: '$mdiAlert',
          color: 'warning',
        },
      ],
    },
  ],
}

const formatOptions = <OvViewOptions>{
  cols: 2,
  items: [
    {
      name: 'date',
      label: 'Date',
      format: {
        icon: '$mdiCalendar',
        color: 'red',
      },
    },
    {
      name: 'time',
      label: 'Time',
      format: {
        icon: '$mdiClockOutline',
        color: 'cyan',
      },
    },
    {
      name: 'url',
      label: 'URL Link',
      format: {
        icon: '$mdiLink',
        color: 'teal',
      },
      maxLength: 30,
    },
    {
      name: 'ipAddress',
      label: 'IP Address',
      format: {
        icon: '$mdiNetworkOutline',
        color: 'grey',
      },
    },
    {
      name: 'fileSize',
      label: 'File Size',
      format: {
        icon: '$mdiFileDocument',
        color: 'amber',
      },
    },
    {
      name: 'percentage',
      label: 'Progress',
      format: [
        {
          rules: { type: 'contains', params: '87' },
          icon: '$mdiProgressCheck',
          color: 'lightGreen',
        },
      ],
    },
    {
      name: 'rating',
      label: 'Rating',
      format: {
        icon: '$mdiStar',
        color: 'yellow',
      },
    },
    {
      name: 'amount',
      label: 'Amount',
      format: {
        icon: '$mdiCurrencyUsd',
        color: 'green',
      },
    },
    {
      name: 'verified',
      label: 'Status',
      format: [
        {
          rules: { type: 'equals', params: 'verified' },
          icon: '$mdiCheck',
          color: 'success',
          rounded: true,
        },
        {
          icon: '$mdiClose',
          color: 'error',
          rounded: true,
        },
      ],
    },
    {
      name: 'error',
      label: 'Result',
      format: [
        {
          rules: { type: 'equals', params: 'failed' },
          icon: '$mdiAlert',
          color: 'red',
          rounded: true,
        },
        {
          icon: '$mdiCheckCircle',
          color: 'green',
          rounded: true,
        },
      ],
    },
  ],
}
</script>
