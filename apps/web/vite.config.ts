import { fileURLToPath, URL } from 'node:url'

import { defineConfig, loadEnv } from 'vite'
import VueRouter from 'vue-router/vite'
import vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import Markdown from 'unplugin-vue-markdown/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import {
  autoImportMdiIcons,
  discoverPageFolders,
  extractMetaFromMarkdown,
  moduleFromComponent,
  odbVueI18nPlugin,
  odbVuePagesPlugin,
} from './plugins/index.ts'
import { openapiPlugin } from './plugins/openapi.ts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { unheadVueComposablesImports } from '@unhead/vue'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const isProduction = mode === 'production'

  return {
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URI,
          changeOrigin: true,
          secure: isProduction,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    plugins: [
      VueRouter({
        extensions: ['.vue', '.md'],
        routesFolder: discoverPageFolders(),
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
        dest: 'src/app/services/openapi.generated.ts',
      }),
      AutoImport({
        imports: [
          'vue',
          'vue-router',
          'vue-i18n',
          {
            from: '@/app/router/api',
            imports: [
              'computedRouteParam',
              'computedRouteParams',
              'computedRouteQuery',
              'usePageMeta',
              'useRouteParams',
              'useRouting',
            ],
          },
          { from: '@/app/http', imports: ['useHttp'] },
          { from: '@/app/ui', imports: ['usePreferencesStore', 'useUi'] },
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
        dirs: ['./src/app/composables/**', './src/modules/*/composables/**'],
      }),
      Components({
        dirs: ['src/components', 'src/app/components', 'src/modules/*/components'],
      }),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
  }
})
