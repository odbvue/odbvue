import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { md3 } from 'vuetify/blueprints'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { light, dark } from '../themes/themes.json'
import { defaults } from '../themes/defaults'
import icons from '../themes/icons'

export default createVuetify({
  blueprint: md3,
  theme: {
    defaultTheme: 'system',
    themes: {
      light,
      dark,
    },
  },
  defaults,
  icons: {
    defaultSet: 'mdi',
    aliases: {
      ...aliases,
      ...icons,
    },
    sets: {
      mdi,
    },
  },
})
