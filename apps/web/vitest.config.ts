import { fileURLToPath, URL } from 'node:url'
import { defineConfig, configDefaults } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'

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
          from: '@/capabilities/routing',
          imports: [
            'useRouting',
            'usePageMeta',
            'useRouteParams',
            'computedRouteParam',
            'computedRouteParams',
            'computedRouteQuery',
          ],
        },
        {
          from: '@/capabilities/ui',
          imports: ['useUi', 'usePreferencesStore', 'useCardBackground', 'useNotificationMessage'],
        },
        { from: '@/capabilities/dnd', imports: ['useHtml5DragDrop'] },
        { from: '@/capabilities/http', imports: ['useHttp'] },
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
      ],
      dirs: ['./src/modules/*/composables/**'],
      dts: false,
    }),
    Components({ dirs: ['src/components'], dts: false }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@intlify/unplugin-vue-i18n/messages': fileURLToPath(
        new URL('./test/support/messages.stub.ts', import.meta.url),
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
          include: [
            'test/app/**/*.test.ts',
            'test/capabilities/**/*.test.ts',
            'test/modules/**/*.test.ts',
            'test/plugins/**/*.test.ts',
            'test/*.test.ts',
          ],
        },
      },
      {
        extends: true,
        test: {
          name: 'components',
          include: ['test/components/**/*.test.ts'],
          setupFiles: ['./test/support/components.setup.ts'],
        },
      },
    ],
  },
})
