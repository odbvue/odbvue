import { fileURLToPath, URL } from 'node:url'
import { promises as fs } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'unplugin-vue-router/vite'
import Markdown from 'unplugin-vue-markdown/vite'
import Vuetify from 'vite-plugin-vuetify'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { i18nDevPlugin}  from './src/plugins/i18n-dev'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { AutoImportMdiIcons } from './src/plugins/icons'
import { unheadVueComposablesImports } from '@unhead/vue'

async function extractMetaFromMarkdown(absolutePath: string): Promise<Record<string, unknown> | null> {
  try {
      const mdContent = await fs.readFile(absolutePath, 'utf-8');
      const metaRegex = /^---\n([\s\S]*?)\n---/;
      const match = mdContent.match(metaRegex);
      if (match && match[1]) {
          const metaString = match[1];
          const metaLines = metaString.split("\n");
          const metaObject: Record<string, unknown> = {};
          for (const line of metaLines) {
              const [key, ...valueParts] = line.split(":");
              if (key && valueParts.length) {
                  const value = valueParts.join(":").trim();
                  metaObject[key.trim()] = value.startsWith('"') && value.endsWith('"')
                      ? value.slice(1, -1)
                      : value;
              }
          }
          return metaObject;
      }
      return null;
  } catch (error) {
      console.error(`Error reading file at ${absolutePath}:`, error);
      return null;
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    Markdown({}),
    VueRouter({ extensions: ['.vue', '.md'], async extendRoute(route) {
      if (route.component?.endsWith('.md')) {
        const meta = await extractMetaFromMarkdown(route.component)
        if (meta)  route.meta = { ...route.meta, ...meta }
      }
    } }),
    vue({
      include: [/\.vue$/, /\.md$/]
    }),
    Vuetify(),
    VueI18nPlugin({
      include: path.resolve(__dirname, './src/i18n/**')
    }),
    i18nDevPlugin(),
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
      dirs: ['./src/composables/**', './src/stores/**', './src/components/**'],
    }),
    Components({}),
    AutoImportMdiIcons({}),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
