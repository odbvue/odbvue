import { createLocalStorageErrorReporter } from '@/capabilities/errors/reporters'
import type { AppConfig } from '@/capabilities/config'

import { light, dark } from './src/capabilities/ui/themes/themes.json'
import icons from './src/capabilities/ui/themes/icons'
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
