<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-btn>
          Simple Dialog
          <v-ov-dialog
            activator="parent"
            title="Simple Dialog"
            content="Content for Simple Dialog"
            actions="close"
            actionCancel="close"
            @action="console.log('closed')"
          />
        </v-btn>
      </v-col>
      <v-col cols="12">
        <v-btn>
          Formatted Dialog
          <v-ov-dialog
            activator="parent"
            title="Formatted Dialog"
            subtitle="With Subtitle and Icon"
            icon="$mdiAccount"
            color="#E3F2FD"
            content="Content for Formatted Dialog"
            :contentFormat="{ color: 'blue' }"
            :actions="[
              { name: 'agree', format: { text: 'agree', color: 'green' } },
              { name: 'disagree', format: { text: 'disagree', color: 'red' } },
              { name: 'not sure', format: { text: 'not sure', color: 'orange' } },
            ]"
            :actionFormat="{ variant: 'outlined' }"
            actionSubmit="agree"
            actionCancel="disagree"
            @action="(action: OvAction) => console.log('action', action)"
            @submit="(action: OvAction) => console.log('submitted', action)"
            @cancel="() => console.log('cancelled')"
          />
        </v-btn>
      </v-col>
      <v-col cols="12">
        <v-btn>
          Dialog with Form
          <v-ov-dialog persistent activator="parent" title="Dialog with Form">
            <template v-slot:content="{ onClose }">
              <v-ov-form
                :options="formOptions"
                @submit="
                  (data: OvFormData) => {
                    submitForm(data)
                    onClose()
                  }
                "
                @cancel="onClose()"
              />
            </template>
          </v-ov-dialog>
        </v-btn>
      </v-col>
      <v-col cols="12">
        <v-btn>
          Fullscreen Dialog
          <v-ov-dialog
            activator="parent"
            title="Fullscreen Dialog"
            content="Content for Fullscreen Dialog"
            actions="close"
            actionCancel="close"
            @action="console.log('closed')"
            fullscreen
          />
        </v-btn>
      </v-col>
      <v-col cols="12">
        <v-btn>
          Scrollable Dialog
          <v-ov-dialog
            activator="parent"
            title="Scrollable Dialog"
            :content="'Content for Scrollable Dialog. '.repeat(250)"
            actions="close"
            actionCancel="close"
            @action="console.log('closed')"
            scrollable
          />
        </v-btn>
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { type OvFormOptions, type OvFormData } from '@/components/'
import { ref } from 'vue'

const formOptions = ref<OvFormOptions>({
  cols: 2,
  fields: [
    { name: 'id', label: 'Key', type: 'text', readonly: true, value: '12345' },
    {
      name: 'content',
      label: 'Value',
      type: 'text',
      rules: [{ type: 'required', params: true, message: 'Value is required' }],
    },
  ],
  actions: ['cancel', 'submit'],
  actionSubmit: 'submit',
  actionCancel: 'cancel',
})

function submitForm(formData: OvFormData) {
  console.log('form submitted', formData)
}
</script>
