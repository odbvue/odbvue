import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import VueRouter from 'vue-router/vite'
import vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import Markdown from 'unplugin-vue-markdown/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import { autoImportMdiIcons, odbVueI18nPlugin } from '@odbvue/web/vite'
import { openapiPlugin } from './vite-plugin-openapi.ts'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { unheadVueComposablesImports } from '@unhead/vue'

import { readFile } from 'node:fs/promises'
import matter from 'gray-matter'

const metaCache = new Map<string, Record<string, unknown>>()

export async function extractMetaFromMarkdown(filePath: string) {
  if (metaCache.has(filePath)) return metaCache.get(filePath)!
  try {
    const content = await readFile(filePath, 'utf-8')
    const { data } = matter(content)
    metaCache.set(filePath, data)
    return data
  } catch (error) {
    console.warn(`[vue-router] Failed to extract meta from ${filePath}`, error)
    return {}
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    VueRouter({
      extensions: ['.vue', '.md'],
      async extendRoute(route) {
        if (route.component?.endsWith('.md')) {
          const meta = await extractMetaFromMarkdown(route.component)
          route.meta = { ...route.meta, ...meta }
        }
      },
    }),
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
      dirs: ['./src/composables/**', './src/stores/**'],
    }),
    Components({}),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
