# Running Tests in CI/CD Pipeline

## GitHub Actions Strategy

### Overview

Tests are **required gates** before code merges. Unit tests run on every pull request to catch issues early and ensure code quality.

> [!NOTE] 
> E2E tests are currently **excluded** from the pipeline. They require additional setup (API/database configuration) and will be integrated in a future phase once those dependencies are established.

### Approach

A dedicated test workflow (`test.yml`) that runs on:
- **Pull requests** - blocks merge if tests fail
- **Push to main** - validates code quality before deployment
- **Manual trigger** - for debugging

### Workflow Structure

#### `.github/workflows/test.yml`

::: details source
<<< ../../../../.github/workflows/test.yml
:::
