# Layouts

Layouts are reusable page shells. OdbVue resolves application layouts by name; applications create or customize layout components in `src/layouts` and select one through page metadata.

```text
src/layouts/
  DefaultLayout.vue
  FullscreenLayout.vue
```

```vue
<script setup lang="ts">
definePage({
  meta: { layout: 'fullscreen' },
})
</script>
```

`default` is used when a page does not choose a layout. Application developers own the layout markup and page metadata; layout discovery is framework behavior.
