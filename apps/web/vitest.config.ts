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
          from: '@/app/router/api',
          imports: [
            'useRouting',
            'usePageMeta',
            'useRouteParams',
            'computedRouteParam',
            'computedRouteParams',
            'computedRouteQuery',
          ],
        },
        { from: '@/app/ui', imports: ['useUi', 'usePreferencesStore'] },
        { from: '@/app/http', imports: ['useHttp'] },
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
      dirs: ['./src/app/composables/**', './src/modules/*/composables/**'],
      dts: false,
    }),
    Components({ dirs: ['src/components'], dts: false }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@intlify/unplugin-vue-i18n/messages': fileURLToPath(
        new URL('./test/messages.stub.ts', import.meta.url),
      ),
    },
  },
  ssr: {
    noExternal: ['vuetify'],
  },
  test: {
    environment: 'jsdom',
    exclude: [...configDefaults.exclude, 'e2e/**'],
    projects: [
      {
        extends: true,
        test: {
          name: 'app',
          include: ['src/**/*.spec.ts', 'test/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['test/components/*.test.ts'],
          setupFiles: ['./test/components/setup.ts'],
        },
      },
    ],
  },
})
