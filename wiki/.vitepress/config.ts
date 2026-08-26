import { defineConfig } from 'vitepress'
import videoPlugin from './markdown-it-video'

export default defineConfig({
  srcDir: './pages',

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
      { text: 'Guide', link: '/guide/getting-started/overview' },
      //{ text: 'Features', link: '/features/overview' },
    ],

    sidebar: {
      '/introduction': [
        {
          text: 'Introduction',
          items: [
            { text: 'Why OdbVue?', link: '/introduction/vision' },
            { text: 'Framework overview', link: '/introduction/framework-overview' },
            { text: 'Skills and habits', link: '/introduction/skills-and-habits' },
            { text: 'Architecture and design', link: '/introduction/architecture-and-design' },
          ],
        },
      ],
      '/guide': [
        {
          text: 'Getting Started',
          items: [
            { text: 'Overview', link: '/guide/getting-started/overview' },
            { text: 'Prerequisites', link: '/guide/getting-started/prerequisites' },
            { text: 'Getting started', link: '/guide/getting-started/getting-started' },
          ],
        },
        {
          text: 'Database',
          items: [
            { text: 'Oracle AI Database', link: '/guide/db/oracle-ai-database' },
            { text: 'In TypeScript', link: '/guide/db/oracle-database-in-typescript' },
            { text: 'TypeScript Toolkit', link: '/guide/db/toolkit' },
            {
              text: 'Capabilities',
              collapsed: true,
              items: [
                { text: 'Framework Packages', link: '/guide/db/capabilities/api-reference' },
                { text: 'Oracle Packages', link: '/guide/db/capabilities/oracle-packages' },
                { text: 'Lob', link: '/guide/db/capabilities/lob' },
                { text: 'JWT', link: '/guide/db/capabilities/jwt' },
                { text: 'Audit', link: '/guide/db/capabilities/audit' },
                { text: 'Settings', link: '/guide/db/capabilities/settings' },
              ],
            },
            { text: 'Under the hood', link: '/guide/db/under-the-hood' },
          ],
        },
        {
          text: 'Web',
          items: [
            {
              text: 'Build',
              collapsed: true,
              items: [
                { text: 'Overview', link: '/guide/web/setting-up-vuejs' },
                { text: 'ORDS and generated clients', link: '/guide/web/consuming-web-services' },
              ],
            },
            {
              text: 'Runtime',
              collapsed: true,
              items: [
                { text: 'Web configuration', link: '/guide/web/web-configuration' },
                { text: 'UI and themes', link: '/guide/web/ui-component-framework' },
                { text: 'Internationalization', link: '/guide/web/i18n' },
                { text: 'State management', link: '/guide/web/state-management' },
                { text: 'Layouts', link: '/guide/web/layouts' },
                {
                  text: 'Application features',
                  collapsed: true,
                  items: [
                    {
                      text: 'Default Layout',
                      link: '/guide/web/application-features/default-layout',
                    },
                    {
                      text: 'Title and version',
                      link: '/guide/web/application-features/title-and-version',
                    },
                    { text: 'Settings', link: '/guide/web/application-features/settings' },
                    { text: 'Navigation', link: '/guide/web/application-features/navigation' },
                    { text: 'Home page', link: '/guide/web/application-features/home-page' },
                    { text: 'UI Feedback', link: '/guide/web/application-features/ui-feedback' },
                    {
                      text: 'Page not found',
                      link: '/guide/web/application-features/page-not-found',
                    },
                    { text: 'Drag and drop', link: '/guide/web/application-features/drag-n-drop' },
                  ],
                },
                {
                  text: 'Advanced UI components',
                  collapsed: true,
                  items: [
                    { text: 'Chart', link: '/guide/web/advanced-ui-components/chart' },
                    { text: 'Dialog', link: '/guide/web/advanced-ui-components/dialog' },
                    { text: 'Editor', link: '/guide/web/advanced-ui-components/editor' },
                    { text: 'Form', link: '/guide/web/advanced-ui-components/form' },
                    { text: 'Map', link: '/guide/web/advanced-ui-components/map' },
                    { text: 'Media', link: '/guide/web/advanced-ui-components/media' },
                    { text: 'Pad', link: '/guide/web/advanced-ui-components/pad' },
                    { text: 'Share', link: '/guide/web/advanced-ui-components/share' },
                    { text: 'Table', link: '/guide/web/advanced-ui-components/table' },
                    { text: 'View', link: '/guide/web/advanced-ui-components/view' },
                  ],
                },
              ],
            },
            {
              text: 'Capabilities',
              collapsed: true,
              items: [{ text: 'Routing', link: '/guide/web/capabilities/routing' }],
            },
            {
              text: 'Vite',
              collapsed: true,
              items: [
                { text: 'Routing and pages', link: '/guide/web/file-based-routing' },
                { text: 'Auto imports', link: '/guide/web/auto-imports' },
              ],
            },
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
      ],
      /*
      '/guide': [
        {
          text: 'Apis',
          items: [
            { text: 'Conventions', link: '/guide/apis/conventions' },
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
            
            {
              text: 'Authentication',
              collapsed: true,
              items: [
                { text: 'Concepts', link: '/guide/web/authentication/concepts' },
                { text: 'Login', link: '/guide/web/authentication/login' },
                { text: 'Sign Up', link: '/guide/web/authentication/sign-up' },
                { text: 'Confirm Email', link: '/guide/web/authentication/confirm-email' },
                { text: 'Recover Password', link: '/guide/web/authentication/recover-password' },
                { text: 'Google Auth', link: '/guide/web/authentication/google-auth' },
              ],
            },
            { text: 'Authorization', link: '/guide/web/authorization' },
            { text: 'Audit', link: '/guide/web/auditing' },
            { text: 'Performance', link: '/guide/web/performance' },
            { text: 'Analytics', link: '/guide/web/analytics' },
            { text: 'Progressive Web App', link: '/guide/web/pwa' },
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
          items: [
            { text: 'Overview', link: '/features/overview' },
            { text: 'Application', link: '/features/app' },
            { text: 'Administration', link: '/features/adm' },
            { text: 'Travail', link: '/features/travail' },
          ],
        },
      ],
*/
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
