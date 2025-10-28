import { fileURLToPath, URL } from 'node:url'
import { promises as fs } from 'node:fs'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import VueRouter from 'unplugin-vue-router/vite'
import Markdown from 'unplugin-vue-markdown/vite'

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
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
})
