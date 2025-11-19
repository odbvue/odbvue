import { test, expect } from '@playwright/test';

test('visits the app root url', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('h1')).toHaveText('Home');
});

test('dark mode switch works', async ({ page }) => {
  await page.goto('/');

  await page.locator('h1').waitFor({ timeout: 10000 });

  const themeToggleBtn = page.locator('[data-cy="theme-toggle"]');
  await themeToggleBtn.first().click({ timeout: 10000 });

  const darkThemeElement = page.locator('[class*="v-theme--dark"]').first();
  await darkThemeElement.waitFor({ timeout: 5000 });

  const classAttr = await darkThemeElement.getAttribute('class');

  expect(classAttr).toContain('v-theme--dark');

  await themeToggleBtn.first().click();

  const lightThemeElement = page.locator('[class*="v-theme--light"]').first();
  await lightThemeElement.waitFor({ timeout: 5000 });

  const finalClassAttr = await lightThemeElement.getAttribute('class');

  expect(finalClassAttr).toContain('v-theme--light');
});
