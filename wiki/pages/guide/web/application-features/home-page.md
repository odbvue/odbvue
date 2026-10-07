# Home Page

The main home page lives in `src/app/pages/index.vue`. It uses `useRouting()` to
render navigable root-level pages as cards, excluding the home page itself.

```ts
import { computed } from 'vue'
import { useRouting } from '@/app/router/api'
import { useCardBackground } from '@/app/composables/ui'

const routing = useRouting()
const navigationPages = computed(() =>
  routing.pages.value.filter((page) => page.level === 0 && page.path !== '/'),
)
```

Each card uses the page's title, icon, description, color, and path.
`useCardBackground()` adapts the gradient to the current Vuetify theme.
No application-store wrapper is needed.

Set Vue page metadata with `definePage()` or Markdown metadata with frontmatter.
For example, `src/app/pages/about.md` supplies the About card.

Modules can contribute root cards too. `src/modules/sandbox/pages/index.vue`
produces `/sandbox` and declares `access: ['admin']` and `navigation: true`, requiring
authentication and the `admin` role for access and navigation.
Navigation uses the same authorization predicate as the router, so unauthorized
users cannot see that card and direct visits are denied.

The main drawer intentionally lists only non-module pages; the home page links
to authorized modules. See [Routing](/guide/web/capabilities/routing) for the
shared metadata and navigation rules.
