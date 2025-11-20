# End to End Tests

## Overview

End-to-end (E2E) tests simulate real user interactions with your application, testing complete workflows across the entire system.

### UI E2E Tests

Test user interface workflows by automating browser interactions:
- Navigate between pages, click buttons, fill out forms
- Verify visual outputs and page behavior
- Run against multiple browsers (Chromium, Firefox, WebKit)
- Catch integration issues that unit tests might miss

### API Tests

Test backend API endpoints and integration:
- Validate authentication, authorization, and error handling
- Test API status codes and response data
- Ensure backend functionality works correctly

### Why Use E2E Tests?

- **Catch integration issues** between frontend and backend
- **Verify user workflows** work end-to-end
- **Test real browser behavior** and API responses
- **Regression detection** - prevent breaking existing features
- **Confidence in production** - validate features before deployment

### Playwright

This project uses **[Playwright](https://playwright.dev/)**, a modern E2E testing framework that supports multiple browsers, parallel test execution, and excellent debugging tools.

## Setup

Before running tests, install Playwright browsers. And API tests will also need to read `.env` variables

```bash
pnpm exec playwright install
pnpm add -D dotenv
```

Update Playwright configuration to handle API and UI tests separately.

::: details `./apps/playwright.config.ts` 
<<< ../../../playwright.config.ts
:::

::: details `./apps/playwright.config.api.ts` 
<<< ../../../playwright.config.ts
:::

And create script shortcuts in `./apps/package.json` 

```json
    //
    "test:api": "playwright test --config=playwright.config.api.ts",
    "test:e2e": "playwright test",
    //
```

## Running Tests

### UI E2E Tests

Run UI end-to-end tests against all configured browsers:

```bash
pnpm test:e2e
```

This executes all tests in `e2e/ui/` directory.

> [!TIP] 
> Add `data-cy` attributes to elements you want to test. e.g.
>
> ```vue
> <button data-cy="theme-toggle" @click="toggleTheme()">Toggle Theme</button>
> ```
>
> Then select them in tests:
> 
> ```typescript
> const button = page.locator('[data-cy="theme-toggle"]');
> await button.click();
> ```
>
> Using a dedicated attribute like `data-cy` is good practice because it provides stable, test-only selectors that don’t break when classes, styles, or DOM structure change. It also makes the testing intent explicit and decouples tests from implementation details, which is now a de-facto industry standard

### API Tests

Run API integration tests:

```bash
pnpm test:api
```

This executes all tests in `e2e/api/` directory using a dedicated configuration.

## Test Organization

Tests are organized by purpose:

- **`e2e/ui/`** - User interface E2E tests
  - Test real browser interactions
  - Run against multiple browsers (Chromium, Firefox, WebKit)
  - Simulate user workflows

- **`e2e/api/`** - API integration tests
  - Test backend API endpoints
  - Validate authentication and authorization
  - Test error handling and status codes

## Tests

### UI Tests

::: details `app.spec.ts` 
<<< ../../../e2e/ui/app.spec.ts
:::

### API Tests

::: details `api.spec.ts`
<<< ../../../e2e/api/api.spec.ts
:::