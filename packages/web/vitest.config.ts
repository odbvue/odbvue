import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    alias: {
      '@intlify/unplugin-vue-i18n/messages': fileURLToPath(
        new URL('./test/messages.stub.ts', import.meta.url),
      ),
    },
  },
})
