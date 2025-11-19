import { config } from '@vue/test-utils'
import vuetify from './src/plugins/vuetify'
import i18n from './src/plugins/i18n'

config.global.plugins = [vuetify, i18n]
