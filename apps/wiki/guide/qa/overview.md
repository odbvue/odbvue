# QA Strategy & Automation

## Philosophy

Keep it simple. Test what matters. Avoid duplicating tests for dependency packages.

## Test Types

### Unit Tests
- **Scope**: Custom components and composables only
- **Framework**: Vitest with Vue Test Utils
- **Command**: `pnpm test:unit`
- **Examples**:
  - Vue component logic and lifecycle
  - Composable hooks and reactive state
  - Utility functions

### E2E Tests
- **Scope**: Core business scenarios
- **Framework**: Playwright
- **Command**: `pnpm test:e2e`
- **Examples**:
  - User workflows (navigation, forms, data management)
  - Critical features and integrations
  - Cross-browser compatibility when needed

## CI/CD Integration
Both unit and e2E tests run in GitHub Actions pipeline:
- Required for all PRs
- Blocking gates before merge
- Fails on any test failure
