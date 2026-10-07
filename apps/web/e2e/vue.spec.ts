import { test, expect } from '@playwright/test'

test('renders the main application without exposing administrator modules', async ({ page }) => {
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto('/')
  await expect(page).toHaveTitle('OdbVue - Home')
  await expect(page.getByRole('main').getByRole('link', { name: 'About About page' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sandbox/ })).toHaveCount(0)
  await expect(page.getByRole('contentinfo')).toContainText('v1.0.0')
})
