import 'vuetify/styles'
import { mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import type { OdbVueUiConfig } from '../config/index.js'
import { odbVueComponentIcons } from '../components/icons.js'

type OdbVueVuetify = ReturnType<typeof createVuetify>

let vuetify: OdbVueVuetify | undefined

/** Creates OdbVue's Vuetify runtime from stable application UI settings. */
export function createOdbVueVuetify(ui: OdbVueUiConfig = {}): OdbVueVuetify {
  return createVuetify({
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
}

export function setOdbVueVuetify(instance: OdbVueVuetify): void {
  vuetify = instance
}

/** Returns the Vuetify runtime installed with the OdbVue application. */
export function getOdbVueVuetify(): OdbVueVuetify {
  if (!vuetify) {
    throw new Error('OdbVue UI is not installed. Call installOdbVue() before using it.')
  }
  return vuetify
}
