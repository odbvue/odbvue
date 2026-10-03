import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'

export default defineConfig({
  plugins: [
    vue(),
    AutoImport({
      imports: [
        'vue',
        'vue-i18n',
        {
          from: 'vuetify',
          imports: ['useDisplay', 'useDefaults'],
        },
      ],
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: [fileURLToPath(new URL('./test/components/setup.ts', import.meta.url))],
    server: { deps: { inline: ['vuetify'] } },
    alias: {
      '@intlify/unplugin-vue-i18n/messages': fileURLToPath(
        new URL('./test/messages.stub.ts', import.meta.url),
      ),
    },
  },
})
