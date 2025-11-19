# End to End Tests

## Overview

End-to-end (E2E) tests simulate real user interactions with your application, testing complete workflows across the entire system. They verify that different components and features work together correctly in a production-like environment.

### What are E2E Tests?

E2E tests automatically interact with your application the same way a user would:
- Navigate between pages
- Click buttons and form elements
- Fill out forms
- Verify visual outputs and page behavior

They test the entire application stack from the user interface down to the backend, ensuring all components integrate properly.

### Why Use E2E Tests?

- **Catch integration issues** that unit tests might miss
- **Verify user workflows** work end-to-end
- **Test real browser behavior** and compatibility
- **Regression detection** - prevent breaking existing features
- **Confidence in production** - validate features before deployment

### Playwright

This project uses **[Playwright](https://playwright.dev/)**, a modern E2E testing framework that:
- Supports multiple browsers (Chromium, Firefox, WebKit)
- Runs tests in parallel for faster feedback
- Provides excellent debugging tools and trace viewer
- Works across Windows, Mac, and Linux

## Best Practices

### Using `data-cy` Attributes

Add `data-cy` attributes to elements you want to test:

```vue
<button data-cy="theme-toggle" @click="toggleTheme()">Toggle Theme</button>
```

Then select them in tests:

```typescript
const button = page.locator('[data-cy="theme-toggle"]');
await button.click();
```

**Why `data-cy`?**
- **Stable**: Won't break if styling changes
- **Explicit**: Shows test intent clearly
- **Decoupled**: Doesn't rely on implementation details
- **Standard**: Industry convention across testing frameworks

## Setup

Before running tests, install Playwright browsers:

```bash
pnpm exec playwright install
```

## Running Tests

```bash
pnpm test:e2e
```

This will run all E2E tests against all configured browsers.

## Tests

::: details `app.spec.ts` 
<<< ../../../e2e/app.spec.ts
:::