<template>
  <v-container>
    <v-row>
      <v-col cols="12" md="6">
        <v-card
          to="/admin/users"
          prepend-icon="$mdiAccountGroup"
          :title="t('admin.users')"
          :text="t('admin.usersDescription')"
          hover
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-card
          to="/admin/roles"
          prepend-icon="$mdiKey"
          :title="t('admin.roles')"
          :text="t('admin.rolesDescription')"
          hover
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-card
          to="/admin/audit"
          prepend-icon="$mdiClipboardTextClock"
          :title="t('admin.audit')"
          :text="t('admin.auditDescription')"
          hover
        />
      </v-col>
      <v-col cols="12" md="6">
        <v-card
          to="/admin/settings"
          prepend-icon="$mdiCog"
          :title="t('admin.settings')"
          :text="t('admin.settingsDescription')"
          hover
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

definePage({
  meta: {
    title: 'admin.title',
    icon: '$mdiShieldAccount',
    access: ['admin'],
    navigation: true,
  },
})

const { t } = useI18n()
</script>
