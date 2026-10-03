# VitePress Configuration

## Site configuration

VitePress provides a variety of [Site Configuration Options](https://vitepress.dev/reference/site-config).

As per current setup, public assets need to be placed in `./wiki/` to be correctly applied. For example, place the logo and favicon in `./wiki/public/` and reference them in `./wiki/.vitepress/config.ts` like this:

```ts{4,6}
export default defineConfig({
  title: "My Site",
  description: "My Site",
  head: [['link', { rel: 'icon', href: '/favicon.ico' }]],
  themeConfig: {
    logo: "/logo.svg",
    // other theme settings
  },
  //other configuration options
})
```

## Navigation structure

It is possible to create quite complex and nested content. Check the `nav` and `sidebar` configuration in `./wiki/.vitepress/config.ts` as well as [Theme Configuration Options](https://vitepress.dev/reference/default-theme-config).

## Home page

Home page `./wiki/pages/index.md` can be customized using [FrontMatter](https://vitepress.dev/reference/frontmatter-config).

Styling can be customized in `./wiki/.vitepress/theme/style.css`

## Local search

Local search can be enabled in `/wiki/.vitepress/config.ts`

```ts{6-8}
export default defineConfig({
  title: "My site",
  description: "My site",
  themeConfig: {
    // other options
    search: {
      provider: "local",
    },
  },
})
```
