# Layouts

Layouts are reusable page shells. The main app resolves layouts by name; create or customize layout components in `src/app/layouts` and select one through page metadata. Module pages can use the same layouts.

```text
src/app/layouts/
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

`default` is used when a page does not choose a layout. Layout discovery lives in `src/app/App.vue`; layout markup and page metadata remain application-owned.
