import { defineConfig } from 'vitepress'
import videoPlugin from './markdown-it-video'

export default defineConfig({
  srcDir: './wiki',

  title: 'OdbVue',
  description: 'Take Ownership of Your Future',
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Introduction', link: '/introduction' },
      { text: 'Guide', link: '/guide' },
      { text: 'Features', link: '/features' },
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
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/guide' },
            { text: 'Prerequisites', link: '/guide/prerequisites' },
            { text: 'Getting started', link: '/guide/getting-started' },
          ],
        },
        {
          text: 'Apps',
          items: [
            { text: 'Setting up VueJs', link: '/guide/apps/setting-up-vuejs' },
            { text: 'File based routing', link: '/guide/apps/file-based-routing' },
            { text: 'UI Component Framework', link: '/guide/apps/ui-component-framework' },
            { text: 'Internationalization', link: '/guide/apps/i18n' },
            { text: 'State Management', link: '/guide/apps/state-management' },
            { text: 'Auto imports', link: '/guide/apps/auto-imports' },
            { text: 'Layouts', link: '/guide/apps/layouts' },
          ],
        },
        {
          text: 'Wiki',
          items: [
            { text: 'Setting up VitePress', link: '/guide/wiki/setting-up-vitepress' },
            { text: 'VitePress configuration', link: '/guide/wiki/vitepress-configuration' },
            { text: 'Custom Markdown Extensions', link: '/guide/wiki/custom-markdown' },
          ],
        },
        {
          text: 'Infrastructure',
          items: [
            { text: 'Architecture', link: '/guide/i13e/architecture' },
            {
              text: 'Assets',
              collapsed: true,
              items: [
                { text: 'Domain name', link: '/guide/i13e/assets/domain-name' },
                { text: 'SSL Certificates', link: '/guide/i13e/assets/ssl-certificates' },
              ],
            },
            {
              text: 'Local development',
              collapsed: true,
              items: [
                { text: 'Environment', link: '/guide/i13e/local-development/environment.md' },
                { text: 'Podman Containers', link: '/guide/i13e/local-development/podman.md' },
                { text: 'Local database', link: '/guide/i13e/local-development/database.md' },
                { text: 'Local web', link: '/guide/i13e/local-development/web.md' },
              ],
            },
            {
              text: 'Oracle Cloud',
              collapsed: true,
              items: [
                { text: 'Overview', link: '/guide/i13e/oci/overview' },
                { text: 'Sign up', link: '/guide/i13e/oci/signup' },
                { text: 'Manage', link: '/guide/i13e/oci/manage' },
                { text: 'Deploy', link: '/guide/i13e/oci/deploy' },
              ],
            },
            {
              text: 'CI/CD',
              collapsed: true,
              items: [
                { text: 'Branching Strategies', link: '/guide/i13e/cicd/branching-strategies' },
                { text: 'GitHub Actions', link: '/guide/i13e/cicd/github-actions' },
              ],
            },
          ],
        },
      ],
      '/features': [
        {
          text: 'Features',
          items: [{ text: 'Overview', link: '/features' }],
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
})
