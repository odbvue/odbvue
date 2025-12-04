<template>
  <v-ov-form
    :data
    :options
    :loading
    :t
    @action="action"
    @cancel="cancel"
    @reset="reset"
    @submit="submit"
    @validate="validate"
  />
  <v-checkbox v-model="loading" label="Loading" class="ma-1" />
  <v-btn class="ma-1" @click="update()">Update!</v-btn>
</template>

<script setup lang="ts">
definePage({
  meta: {
    visibility: 'with-role',
    access: 'with-role',
    roles: ['developer'],
  },
})

const { t } = useI18n()
const loading = ref(false)

function update() {
  data.value.text2 = '{}'
  data.value.text3 = 'Hello World, some custom more'
  data.value.number = 5
  data.value.datetime = new Date().toISOString().slice(0, 16)
}

const data = ref({
  text1: 'Hello World!',
  text2: 'Hello World, again!',
  text3: 'Hello World, some more!',
  number: 2,
  password: '',
  rating: 4,
  checkbox: false,
  datetime: '',
})

const customValidation = (value: string) => {
  return value.includes('custom') ? true : "Value must contain 'custom'"
}

const options = ref<OvFormOptions>({
  fields: [
    {
      type: 'text',
      name: 'text1',
      label: 'Text 1',
      placeholder: 'Enter some text',
      value: 'Hello World - default!',
    },
    {
      type: 'text',
      name: 'text2',
      label: 'Text 2',
      placeholder: 'Enter some text',
      rules: [
        { type: 'required', params: true, message: 'Text 2 is required' },
        { type: 'is-json', params: true, message: 'Text 2 must be a valid JSON' },
      ],
    },
    {
      type: 'text',
      name: 'text3',
      label: 'Text 3',
      placeholder: 'Enter some text',
      variant: 'underlined',
      rules: [
        { type: 'required', params: true, message: 'Text 3 is required' },
        { type: 'custom', params: customValidation, message: 'Text 3 must contain "custom"' },
      ],
    },
    {
      type: 'email',
      name: 'email',
      label: 'Email',
      placeholder: 'Enter valid e-mail address',
    },
    {
      type: 'number',
      name: 'number',
      label: 'Number',
      placeholder: 'Enter some number',
      color: 'green',
      rules: [
        { type: 'required', params: true, message: 'Number is required' },
        { type: 'less-than', params: 10, message: 'Number must be at least 10' },
      ],
    },
    {
      type: 'password',
      name: 'password',
      label: 'Password',
      placeholder: 'Enter password, at least 12 characters',
      required: true,
    },
    {
      type: 'textarea',
      name: 'textarea',
      label: 'Textarea',
      placeholder: 'Enter some larger text here',
      rows: 3,
      counter: 200,
      noResize: true,
    },
    {
      type: 'switch',
      name: 'acceptTerms',
      label: 'Accept Terms and Conditions',
      required: true,
      value: false,
    },
    {
      type: 'rating',
      name: 'rating',
      label: 'Rating',
      length: 6,
      color: 'amber',
    },
    {
      type: 'checkbox',
      name: 'checkbox',
      label: 'Checkbox',
    },
    {
      type: 'select',
      name: 'select',
      label: 'Select',
      items: ['Alfa', 'Bravo', 'Charlie', 'Delta'],
      chips: true,
      multiple: true,
    },
    {
      type: 'combobox',
      name: 'combobox',
      label: 'Combo',
      items: ['Alfa', 'Bravo', 'Charlie', 'Delta'],
      chips: true,
      multiple: true,
    },
    {
      type: 'autocomplete',
      name: 'autocomplete',
      label: 'Autocomplete',
      items: ['Alfa', 'Bravo', 'Charlie', 'Delta'],
      chips: true,
      multiple: true,
    },
    {
      type: 'file',
      name: 'file',
      label: 'File!',
    },
    {
      type: 'date',
      name: 'date',
      label: 'Date',
      placeholder: 'Select date',
    },
    {
      type: 'time',
      name: 'time',
      label: 'Time',
      placeholder: 'Select time',
    },
    {
      type: 'datetime',
      name: 'datetime',
      label: 'Date and Time',
      placeholder: 'Select date and time',
    },
  ],
  cols: 3,
  actions: ['validate', 'cancel', 'submit', 'reset', { name: 'custom', format: { color: 'red' } }],
  actionFormat: {
    color: 'lime',
  },
  actionAlign: 'center',
  actionSubmit: 'submit',
  actionReset: 'reset',
  actionValidate: 'validate',
  actionCancel: 'cancel',
  errors: [{ name: 'text1', message: 'Error from outside' }],
  focusFirst: true,
})

function action(actionName: string, newData: unknown) {
  console.log('action', actionName, newData)
}

function cancel() {
  console.log('cancel')
}

function reset() {
  console.log('reset')
}

async function submit(newData: unknown) {
  loading.value = true
  await new Promise((resolve) => setTimeout(resolve, 2000))
  data.value.datetime = new Date().toISOString().slice(0, 16)
  options.value.errors = [
    { name: 'datetime', message: 'Server-side validation failed for datetime' },
  ]
  console.log('submit', newData)
  loading.value = false
}

function validate(newData: unknown, errors: unknown) {
  console.log('validate', newData, errors)
}
</script>
