import { fileURLToPath, URL } from 'node:url'
import { relative, resolve } from 'node:path'

import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'
import vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import Markdown from 'unplugin-vue-markdown/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import {
  autoImportMdiIcons,
  extractMetaFromMarkdown,
  moduleFromComponent,
  odbVueComponentsResolver,
  odbVueI18nPlugin,
  odbVuePagesPlugin,
} from '@odbvue/web/vite'
import { openapiPlugin } from './vite-plugin-openapi.ts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { unheadVueComposablesImports } from '@unhead/vue'

// https://vite.dev/config/
export default defineConfig({
  optimizeDeps: {
    exclude: ['@odbvue/web'],
  },
  plugins: [
    VueRouter({
      extensions: ['.vue', '.md'],
      routesFolder: [
        'src/pages',
        {
          src: 'src/modules',
          path: (filePath) => {
            const [moduleName, pagesDirectory, ...pagePath] = relative(
              resolve(process.cwd(), 'src/modules'),
              filePath,
            ).split(/[/\\]/)
            return `${moduleName}/${pagesDirectory === 'pages' ? pagePath.join('/') : ''}`
          },
        },
      ],
      async extendRoute(route) {
        const moduleName = moduleFromComponent(route.component)
        if (route.component?.endsWith('.md')) {
          const meta = await extractMetaFromMarkdown(route.component)
          route.meta = { ...route.meta, ...meta }
        }
        if (moduleName) {
          route.meta = {
            ...route.meta,
            module: moduleName,
          }
        }
      },
    }),
    odbVuePagesPlugin(),
    vue({
      include: [/\.vue$/, /\.md$/],
    }),
    Vuetify(),
    Markdown({}),
    autoImportMdiIcons(),
    odbVueI18nPlugin(),
    openapiPlugin({
      source: '../db/dist/openapi.json',
      dest: 'src/services/openapi.generated.ts',
    }),
    AutoImport({
      imports: [
        'vue',
        'vue-router',
        'vue-i18n',
        {
          from: '@odbvue/web',
          imports: [
            'computedRouteParam',
            'computedRouteParams',
            'computedRouteQuery',
            'configureHttp',
            'useAppStore',
            'useHttp',
            'useNavigationStore',
            'usePageMeta',
            'useRouteParams',
            'useRouting',
            'useSettingsStore',
            'useUiStore',
          ],
        },
        {
          from: 'vuetify',
          imports: [
            'useDisplay',
            'useDate',
            'useDefaults',
            'useDisplay',
            'useGoTo',
            'useLayout',
            'useLocale',
            'useRtl',
            'useTheme',
          ],
        },
        unheadVueComposablesImports,
      ],
      dirs: ['./src/composables/**', './src/modules/*/composables/**'],
    }),
    Components({
      resolvers: [odbVueComponentsResolver],
    }),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
