# Auto Imports

OdbVue applications use generated declarations for configured auto imports. Application code can use Vue, routing, i18n, and selected Vuetify composables without repetitive imports.

```vue
<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
</script>
```

The generated `auto-imports.d.ts`, `components.d.ts`, and `typed-router.d.ts` files are build artifacts and should remain committed. The Vite implementation is a framework concern; customize auto-import sources only when the application introduces a new shared source.
