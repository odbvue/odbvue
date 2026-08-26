import { createLocalStorageErrorReporter, defineOdbVueApp } from '@odbvue/web'

import { light, dark } from './src/themes/themes.json'
import icons from './src/themes/icons'

export default defineOdbVueApp({
  title: 'OdbVue',
  version: '1.0.0',
  auth: false,
  audit: false,
  settings: false,
  storage: false,
  ai: false,
  email: false,
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
