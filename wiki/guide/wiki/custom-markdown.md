# Custom Markdown

VitePress uses **Markdown IT** for markdown rendering and it allows many [Markdown IT extensions](https://vitepress.dev/guide/markdown#advanced-configuration)

Here is an example of how to embed a YouTube video using custom markdown. Use the following syntax: `@[youtube](YOUR_VIDEO_ID)`. This will ensure the video is scaled correctly.

1. Create markdown extension

::: details `./apps/.vitepress/markdown-it-video.ts`
<<< ../../../apps/.vitepress/markdown-it-video.ts
:::

2. Append classes to `/apps/.vitepress/theme/style.css`

```css
.embed-responsive-16by9 {
  padding-top: 56.25%;
  position: relative;
  display: block;
}

.embed-responsive-item {
  position: absolute;
  top: 0;
  left: 0;
  border: 0px;
}
```

3. Include extension in `/apps/.vitepress/config.ts`

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

4. Enjoy

@[youtube](mSd9nmPM7Vg)
