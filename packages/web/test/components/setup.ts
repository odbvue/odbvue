import { vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'
import { aliases, mdi } from 'vuetify/iconsets/mdi-svg'
import { createI18n } from 'vue-i18n'
import { odbVueComponentIcons } from '../../src/components/icons'

if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver
}

if (typeof globalThis.visualViewport === 'undefined') {
  Object.defineProperty(globalThis, 'visualViewport', {
    value: {
      addEventListener: vi.fn<() => void>(),
      removeEventListener: vi.fn<() => void>(),
      width: 1024,
      height: 768,
      offsetLeft: 0,
      offsetTop: 0,
      pageLeft: 0,
      pageTop: 0,
      scale: 1,
    },
    writable: true,
  })
}

HTMLCanvasElement.prototype.toDataURL = vi.fn<() => string>(() => 'data:image/png;base64,test')

const vuetify = createVuetify({
  components,
  directives,
  icons: {
    defaultSet: 'mdi',
    aliases: { ...aliases, ...odbVueComponentIcons },
    sets: { mdi },
  },
})

export const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} },
  missing: () => {},
})

config.global.plugins = [vuetify]

export const globalPlugins = [i18n]
