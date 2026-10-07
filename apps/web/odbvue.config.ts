import { createLocalStorageErrorReporter } from '@/app/errors'
import { defineAppConfig } from '@/app/config'

import { light, dark } from './src/app/themes/themes.json'
import icons from './src/app/themes/icons'
import openapi from '../db/dist/openapi.json'

export default defineAppConfig({
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
  modules: ['sandbox'],
})
