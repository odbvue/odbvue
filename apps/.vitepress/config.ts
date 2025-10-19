import { defineConfig } from 'vitepress'
import videoPlugin from './markdown-it-video'

export default defineConfig({
  srcDir: '../wiki',

  title: 'OdbVue',
  description: 'Take Ownership of Your Future',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction' },
      { text: 'Guide', link: '/guide' },
    ],

    sidebar: {
      '/introduction': [
        {
          text: 'Introduction',
          items: [{ text: 'What is OdbVue?', link: '/introduction' }],
        },
      ],
      '/guide': [
        {
          text: 'Apps',
          items: [{ text: 'Setting up VueJs', link: '/guide/apps/setting-up-vuejs' }],
        },
        {
          text: 'Wiki',
          items: [
            { text: 'Setting up VitePress', link: '/guide/wiki/setting-up-vitepress' },
            { text: 'VitePress configuration', link: '/guide/wiki/vitepress-configuration' },
            { text: 'Custom Markdown Extensions', link: '/guide/wiki/custom-markdown' },
          ],
        },
      ],
    },

    search: {
      provider: 'local',
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com/odbvue/odbvue' }],
  },

  markdown: {
    config: (md) => {
      md.use(videoPlugin)
    },
  },

  vite: {
    build: {
      rollupOptions: {
        external: ['vue/server-renderer', 'vue'],
      },
    },
  },
})
