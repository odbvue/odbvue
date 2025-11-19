# Unit tests

## Overview

Unit tests isolate and verify individual components and composables in isolation. In Vue.js with Vitest:

- **Vitest**: Lightning-fast unit test runner compatible with Vite
- **Vue Test Utils**: Mount Vue components in a test environment, interact with them, and assert behavior
- **Focus**: Test component logic (props, emits, state, lifecycle) and composable hooks without DOM rendering
- **Isolation**: Mock external dependencies (API calls, third-party libraries) to test only the code you wrote

Run tests with:

```bash
pnpm test:unit
```

## Components

::: details `VOvChart.test.ts` 
<<< ../../../src/components/__tests__/VOvChart.test.ts
:::

::: details `VOvDialog.test.ts` 
<<< ../../../src/components/__tests__/VOvDialog.test.ts
:::

::: details `VOvEditor.test.ts` 
<<< ../../../src/components/__tests__/VOvEditor.test.ts
:::

::: details `VOvForm.test.ts` 
<<< ../../../src/components/__tests__/VOvForm.test.ts
:::

::: details `VOvMap.test.ts` 
<<< ../../../src/components/__tests__/VOvMap.test.ts
:::

::: details `VOvMedia.test.ts` 
<<< ../../../src/components/__tests__/VOvMedia.test.ts
:::

::: details `VOvPad.test.ts` 
<<< ../../../src/components/__tests__/VOvPad.test.ts
:::

::: details `VOvShare.test.ts` 
<<< ../../../src/components/__tests__/VOvShare.test.ts
:::

::: details `VOvTable.test.ts` 
<<< ../../../src/components/__tests__/VOvTable.test.ts
:::

::: details `VOvView.test.ts` 
<<< ../../../src/components/__tests__/VOvView.test.ts
:::

## Composables

::: details `http.test.ts` 
<<< ../../../src/composables/__tests__/http.test.ts
:::

::: details `ui.test.ts` 
<<< ../../../src/composables/__tests__/ui.test.ts
:::

