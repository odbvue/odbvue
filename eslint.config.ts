import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'
import skipFormatting from '@vue/eslint-config-prettier/skip-formatting'

export default defineConfigWithVueTs(
  {
    name: 'repo/files-to-lint',
    files: [
      'apps/**/*.{vue,ts,mts,tsx,js,mjs,cjs}',
      'wiki/**/*.{ts,mts,tsx,js,mjs,cjs}',
      'cli/**/*.{ts,mts,tsx,js,mjs,cjs}',
    ],
  },

  globalIgnores([
    '**/node_modules/**',
    '**/dist/**',
    '**/dist-ssr/**',
    '**/coverage/**',
    '**/.vite/**',
    '**/.turbo/**',
    '**/.cache/**',

    // VitePress build/cache
    'wiki/**/.vitepress/cache/**',
    'wiki/**/.vitepress/dist/**',

    // Docs content is handled by Prettier
    'wiki/**/*.md',
  ]),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['apps/e2e/**/*.{test,spec}.{js,ts,jsx,tsx}'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['apps/src/**/__tests__/**/*.{js,ts,jsx,tsx}'],
  },

  skipFormatting,
)
