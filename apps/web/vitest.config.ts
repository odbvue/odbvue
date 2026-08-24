import { fileURLToPath, URL } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { unheadVueComposablesImports } from '@unhead/vue'

const cssStubPlugin = {
  enforce: 'pre' as const,
  name: 'vitest-css-stub',
  resolveId(id: string) {
    if (id.endsWith('.css')) return '\0vitest-css-stub'
    return null
  },
  load(id: string) {
    if (id === '\0vitest-css-stub') return 'export default {}'
    return null
  },
}

export default defineConfig({
  plugins: [
    vue(),
    cssStubPlugin,
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'vue-i18n',
        {
          from: 'vuetify',
          imports: [
            'useDisplay',
            'useDate',
            'useDefaults',
            'useGoTo',
            'useLayout',
            'useLocale',
            'useRtl',
            'useTheme',
          ],
        },
        unheadVueComposablesImports,
      ],
      dirs: ['./src/composables/**', './src/stores/**'],
    }),
    Components({}),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ssr: {
    noExternal: ['vuetify'],
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
