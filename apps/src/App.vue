<template>
  <router-link to="/">Home</router-link>
  |
  <router-link to="/about">About</router-link>
  |
  <router-link to="/sandbox">Sandbox</router-link>
  <br />
  <br />
  <v-radio-group inline v-model="locale" :label="t('choose.language')">
    <v-radio label="en" value="en"></v-radio>
    <v-radio label="fr" value="fr"></v-radio>
  </v-radio-group>
  <br />
  <br />
  <router-view />
  <br />
  <br />
  <test-component />
  <p>{{ t('welcome.message') }}</p>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { locale, t } = useI18n()
</script>
