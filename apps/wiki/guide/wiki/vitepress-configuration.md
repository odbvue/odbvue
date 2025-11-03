# VitePress Configuration

## Site configuration

VitePress provides a variety of [Site Configuration Options](https://vitepress.dev/reference/site-config).

As per current setup, public assets need to ne placed in `./wiki/` folder to be correctly applied. For example, place logo and favicon in `./wiki/public/` folder and reference in `./apps/.vitepress/config.ts` like this:

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

It is possible to create quite complex and nested content. Check constructions of `nav` and `sidebar` in `./apps/.vitepress/config.ts` as well as [Theme Configuration Options](https://vitepress.dev/reference/default-theme-config).

## Home page

Home page `./wiki/index.md` can be customized using [FrontMatter](https://vitepress.dev/reference/frontmatter-config). 

Styling can be customize in `./apps/.vitepress/theme/style.css`

## Local search

Local search can be enabled in `/apps/.vitepress/config.ts`

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
