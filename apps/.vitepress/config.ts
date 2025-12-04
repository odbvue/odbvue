import { defineConfig } from 'vitepress'
import videoPlugin from './markdown-it-video'

export default defineConfig({
  srcDir: './wiki',

  title: 'OdbVue',
  description: 'Take Ownership of Your Future',
  head: [
    [
      'script',
      {
        async: '',
        src: 'https://www.googletagmanager.com/gtag/js?id=G-DWY78X1WCH',
      },
    ],
    [
      'script',
      {},
      "window.dataLayer = window.dataLayer || [];\nfunction gtag(){dataLayer.push(arguments);}\ngtag('js', new Date());\ngtag('config', 'G-DWY78X1WCH');",
    ],
    ['link', { rel: 'icon', href: '/favicon.ico' }],
  ],
  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'OdbVue', link: 'https://odbvue.com' },
      { text: 'Apps', link: 'https://apps.odbvue.com' },
      { text: 'Introduction', link: '/introduction/vision' },
      { text: 'Guide', link: '/guide' },
      { text: 'Features', link: '/features' },
    ],

    sidebar: {
      '/introduction': [
        {
          text: 'Introduction',
          items: [
            { text: 'Why OdbVue?', link: '/introduction/vision' },
            { text: 'Skills and habits', link: '/introduction/skills-and-habits' },
            { text: 'Architecture and design', link: '/introduction/architecture-and-design' },
          ],
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
          text: 'Apis',
          items: [
            { text: 'Oracle AI Database', link: '/guide/apis/oracle-ai-database' },
            { text: 'Conventions', link: '/guide/apis/conventions' },
            { text: 'Setting up', link: '/guide/apis/setting-up' },
            {
              text: 'Capabilities',
              collapsed: true,
              items: [
                { text: 'API Reference', link: '/guide/apis/capabilities/api-reference' },
                { text: 'Audit', link: '/guide/apis/capabilities/pck-api-audit' },
                { text: 'Authentication', link: '/guide/apis/capabilities/pck-api-auth' },
                { text: 'Classifiers', link: '/guide/apis/capabilities/pck-api-classifiers' },
                { text: 'Consents', link: '/guide/apis/capabilities/pck-api-consents' },
                { text: 'Emails', link: '/guide/apis/capabilities/pck-api-emails' },
                { text: 'Labels', link: '/guide/apis/capabilities/pck-api-labels' },
                { text: 'LOB', link: '/guide/apis/capabilities/pck-api-lob' },
                { text: 'HTTP', link: '/guide/apis/capabilities/pck-api-http' },
                { text: 'Jobs', link: '/guide/apis/capabilities/pck-api-jobs' },
                { text: 'JSON', link: '/guide/apis/capabilities/pck-api-json' },
                { text: 'Markdown', link: '/guide/apis/capabilities/pck-api-md' },
                { text: 'OpenAI', link: '/guide/apis/capabilities/pck-api-openai' },
                { text: 'PDF', link: '/guide/apis/capabilities/pck-api-pdf' },
                { text: 'Settings', link: '/guide/apis/capabilities/pck-api-settings' },
                { text: 'Storage', link: '/guide/apis/capabilities/pck-api-storage' },
                { text: 'Validate', link: '/guide/apis/capabilities/pck-api-validate' },
                { text: 'XML', link: '/guide/apis/capabilities/pck-api-xml' },
                { text: 'YAML', link: '/guide/apis/capabilities/pck-api-yaml' },
                { text: 'ZIP', link: '/guide/apis/capabilities/pck-api-zip' },
              ],
            },
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
            { text: 'Application Features', link: '/guide/apps/application-features' },
            {
              text: 'Advanced UI Components',
              collapsed: true,
              items: [
                { text: 'Chart', link: '/guide/apps/advanced-ui-components/chart' },
                { text: 'Dialog', link: '/guide/apps/advanced-ui-components/dialog' },
                { text: 'Editor', link: '/guide/apps/advanced-ui-components/editor' },
                { text: 'Form', link: '/guide/apps/advanced-ui-components/form' },
                { text: 'Map', link: '/guide/apps/advanced-ui-components/map' },
                { text: 'Media', link: '/guide/apps/advanced-ui-components/media' },
                { text: 'Pad', link: '/guide/apps/advanced-ui-components/pad' },
                { text: 'Share', link: '/guide/apps/advanced-ui-components/share' },
                { text: 'Table', link: '/guide/apps/advanced-ui-components/table' },
                { text: 'View', link: '/guide/apps/advanced-ui-components/view' },
              ],
            },
            { text: 'Consuming Web Services', link: '/guide/apps/consuming-web-services' },
            {
              text: 'Authentication',
              collapsed: true,
              items: [
                { text: 'Concepts', link: '/guide/apps/authentication/concepts' },
                { text: 'Login', link: '/guide/apps/authentication/login' },
                { text: 'Sign Up', link: '/guide/apps/authentication/sign-up' },
                { text: 'Confirm Email', link: '/guide/apps/authentication/confirm-email' },
                { text: 'Recover Password', link: '/guide/apps/authentication/recover-password' },
                { text: 'Google Auth', link: '/guide/apps/authentication/google-auth' },
              ],
            },
            { text: 'Authorization', link: '/guide/apps/authorization' },
            { text: 'Audit', link: '/guide/apps/auditing' },
            { text: 'Performance', link: '/guide/apps/performance' },
            { text: 'Analytics', link: '/guide/apps/analytics' },
            { text: 'Progressive Web App', link: '/guide/apps/pwa' },
          ],
        },
        {
          text: 'QA',
          items: [
            { text: 'Overview', link: '/guide/qa/overview' },
            { text: 'Unit tests', link: '/guide/qa/unit-tests' },
            { text: 'E2E tests', link: '/guide/qa/e2e-tests' },
            { text: 'CI/CD', link: '/guide/qa/cicd-tests' },
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
              text: 'Local',
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
                { text: 'Access', link: '/guide/i13e/oci/access' },
              ],
            },
          ],
        },
        {
          text: 'CI/CD',
          items: [
            { text: 'Branching Strategies', link: '/guide/cicd/branching-strategies' },
            { text: 'Development Lifecycle', link: '/guide/cicd/development-lifecycle' },
            { text: 'GitHub Actions', link: '/guide/cicd/github-actions' },
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
