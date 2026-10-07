import { createLocalStorageErrorReporter } from '@/app/errors/reporters'
import type { AppConfig } from '@/app/config'

import { light, dark } from './src/app/themes/themes.json'
import icons from './src/app/themes/icons'
import openapi from '../db/dist/openapi.json'

export default {
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
} satisfies AppConfig
