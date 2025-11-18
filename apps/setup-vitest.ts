import { config } from '@vue/test-utils'
import vuetify from '@/plugins/vuetify'
import i18n from '@/plugins/i18n'

config.global.plugins = [vuetify, i18n]
