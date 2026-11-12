<template>
  <v-container>
    <v-card
      to="/admin/users"
      prepend-icon="$mdiAccountGroup"
      :title="t('admin.users')"
      :text="t('admin.usersDescription')"
      hover
    />
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
