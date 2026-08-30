import 'vuetify/styles'
import { mdiWeatherNight, mdiWeatherSunny } from '@mdi/js'
import { createVuetify, type VuetifyOptions } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { defineCapability } from '../../runtime/capability.js'
import { defineContract } from '../../runtime/contract.js'
import type { OdbVueUiConfig } from '../../runtime/config.js'
import { odbVueComponentIcons } from './icons.js'

export { usePreferencesStore } from './preferences.js'
export { useUi } from './store.js'
export type { AlertOptions, UiNotification, UiNotificationType } from './store.js'

type OdbVueVuetify = ReturnType<typeof createVuetify>

export const uiContract = defineContract<OdbVueVuetify>('ui')

export const uiCapability = defineCapability({
  name: 'ui',
  setup(context) {
    const vuetify = createOdbVueVuetify(context.config.ui)
    context.provide(uiContract, vuetify)
    context.app.use(vuetify)
  },
})

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
