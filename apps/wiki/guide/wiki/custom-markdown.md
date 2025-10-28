# Custom Markdown

VitePress uses **Markdown IT** for markdown rendering and it allows many [Markdown IT extensions](https://vitepress.dev/guide/markdown#advanced-configuration)

Here is an example of how to embed a YouTube video using custom markdown. Use the following syntax: `@[youtube](YOUR_VIDEO_ID)`. This will ensure the video is scaled correctly.

0. Install markdown-it

```bash
pnpm i --save-dev markdown-it
pnpm i --save-dev @types/markdown-it
```

1. Create markdown extension

::: details `./.vitepress/markdown-it-video.ts`
<<< ../../../.vitepress/markdown-it-video.ts
:::

2. Include extension in `/apps/.vitepress/config.ts`

```ts{2,8-12}
import { defineConfig } from "vitepress"
import videoPlugin from "./markdown-it-video"

export default defineConfig({
  title: "My site",
  description: "My site",
  // other configuration options
  markdown: {
    config: (md) => {
      md.use(videoPlugin)
    },
  },
})

```

3. Enjoy

@[youtube](mSd9nmPM7Vg)
