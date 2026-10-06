import { createLocalStorageErrorReporter, defineOdbVueApp } from '@odbvue/web'

import { light, dark } from './src/themes/themes.json'
import icons from './src/themes/icons'
import openapi from '../db/dist/openapi.json'

export default defineOdbVueApp({
  title: 'OdbVue',
  version: '1.0.0',
  http: { openapi },
  ui: {
    theme: {
      default: 'system',
      light,
      dark,
    },
    defaults: {
      VCardActions: {
        VBtn: { variant: 'outlined' },
        class: 'd-flex flex-wrap justify-end',
      },
    },
    icons,
  },
  i18n: {
    locales: ['en', 'fr', 'de'],
    fallbackLocale: 'en',
  },
  errors: {
    reporters: [createLocalStorageErrorReporter()],
  },
  integrations: {},
  hooks: {},
  modules: [],
})
