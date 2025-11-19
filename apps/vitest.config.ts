import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config'

export default defineConfig(async (configEnv) => {
  const resolvedViteConfig = typeof viteConfig === 'function'
    ? await viteConfig(configEnv)
    : viteConfig

  return mergeConfig(
    resolvedViteConfig,
    {
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
        setupFiles: ['./vitest.config.setup.ts'],
      },
    },
  )
})
