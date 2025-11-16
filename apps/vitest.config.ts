import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      css: false,
      globals: true,
      server: {
        deps: {
          inline: ['vuetify'],
        },
      },
      setupFiles: ['./setup-vitest.ts'],
    },
  }),
)
