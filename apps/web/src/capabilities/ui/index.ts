import 'vuetify/styles'
import { mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { appConfig } from '../config.js'
import { odbVueComponentIcons } from './icons.js'

export { usePreferencesStore } from './preferences.js'
export { useUi } from './store.js'
export { useCardBackground, useNotificationMessage } from './composables.js'
export type { AlertOptions, UiNotification, UiNotificationType } from './store.js'

const ui = appConfig.ui ?? {}

export const vuetify = createVuetify({
  ...ui.vuetify,
  blueprint: md3,
  theme: {
    defaultTheme: ui.theme?.default ?? 'system',
    themes: {
      ...(ui.theme?.light ? { light: ui.theme.light } : {}),
      ...(ui.theme?.dark ? { dark: ui.theme.dark } : {}),
    },
  },
  defaults: ui.defaults,
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      mdiWeatherNight,
      mdiWeatherSunny,
      ...odbVueComponentIcons,
      ...ui.icons,
    },
    sets: { mdi },
  },
} satisfies VuetifyOptions)
