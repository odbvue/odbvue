import { fileURLToPath, URL } from 'node:url'
import { promises as fs, existsSync, readdirSync } from 'node:fs'
import path from 'node:path'

import { defineConfig, loadEnv } from 'vite'

// Auto-detect modules with pages directories in src/modules/*
function getModuleRoutesFolders() {
  const modulesDir = path.resolve(__dirname, 'src/modules')
  const routesFolders: Array<{ src: string; path: string; exclude: string[] }> = []

  if (!existsSync(modulesDir)) return routesFolders

  const modules = readdirSync(modulesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())

  for (const mod of modules) {
    const pagesPath = path.join(modulesDir, mod.name, 'pages')
    if (existsSync(pagesPath)) {
      routesFolders.push({
        src: `src/modules/${mod.name}/pages`,
        path: `${mod.name}/`,
        exclude: ['**/_components/**', '**/_utils/**'],
      })
    }
  }

  return routesFolders
}

// Get module i18n paths for VueI18nPlugin
function getModuleI18nPaths() {
  const modulesDir = path.resolve(__dirname, 'src/modules')
  const i18nPaths: string[] = []

  if (!existsSync(modulesDir)) return i18nPaths

  const modules = readdirSync(modulesDir, { withFileTypes: true })
    .filter((dirent) => dirent.isDirectory())

  for (const mod of modules) {
    const i18nPath = path.join(modulesDir, mod.name, 'i18n')
    if (existsSync(i18nPath)) {
      i18nPaths.push(path.resolve(__dirname, `src/modules/${mod.name}/i18n/**`))
    }
  }

  return i18nPaths
}

// Build exclude patterns from detected modules
function getExcludedModules() {
  return ['**/_components/**', '**/modules/**']
}
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
import { VitePWA } from 'vite-plugin-pwa'

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
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd())
  const isProduction = mode === 'production'

  return {
    optimizeDeps: {
      entries: [
        'src/main.ts',
        'src/App.vue',
        'src/pages/**/*.{vue,md}',
        'src/modules/**/pages/**/*.{vue,md}',
      ],
      include: [
        'vuetify',
        'vuetify/styles',
        'vuetify/components',
        'vuetify/directives',
        'vuetify/iconsets/mdi-svg',
      ],
    },
    build: {
      rollupOptions: {
        external: ['workbox-window'],
      },
    },
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URI,
          changeOrigin: true,
          secure: isProduction ? true : false,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
      },
    },
    plugins: [
      Markdown({}),
      VueRouter({
        routesFolder: [
          {
            src: 'src/pages',
            exclude: getExcludedModules(),
          },
          ...getModuleRoutesFolders(),
        ],
        extensions: ['.vue', '.md'],
        async extendRoute(route) {
        if (route.component?.endsWith('.md')) {
          const meta = await extractMetaFromMarkdown(route.component)
          if (meta)  route.meta = { ...route.meta, ...meta }
        }
      },
      }),
      vue({
        include: [/\.vue$/, /\.md$/]
      }),
      Vuetify(),
      VueI18nPlugin({
        include: [
          path.resolve(__dirname, './src/i18n/**'),
          ...getModuleI18nPaths(),
        ]
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
      VitePWA({
       registerType: 'prompt',
       includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
       manifest: {
          name: "OdbVue",
          short_name: "OV",
          description: "OdbVue - Take Ownership of Your Future",
          theme_color: "#00629e",
          icons: [
            {
              src: "pwa-64x64.png",
              sizes: "64x64",
              type: "image/png"
            },
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png"
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png"
            },
            {
              src: "maskable-icon-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable"
            }
          ],
          screenshots: [
            {
              src: "screenshot-540x720.png",
              sizes: "540x720",
              type: "image/png"
            },
            {
              src: "screenshot-1280x720.png",
              sizes: "1280x720",
              type: "image/png",
              form_factor: "wide"
            }
          ]
        },
      }),
      vueDevTools(),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
