import { test, expect } from '@playwright/test'

test('renders the application shell while session restoration is pending', async ({ page }) => {
  let finish!: () => void
  const pending = new Promise<void>((resolve) => {
    finish = resolve
  })
  const requests: string[] = []
  await page.route('**/auth/refresh', async (route) => {
    requests.push('refresh')
    await pending
    await route.fulfill({ status: 401, json: {} })
  })
  try {
    await page.goto('/')
    await expect(page.getByRole('contentinfo')).toContainText('v1.0.0')
    await expect(page.getByRole('banner').first()).toContainText('OdbVue')
    expect(requests).toEqual(['refresh'])
  } finally {
    finish()
  }
  await expect(page).toHaveTitle('OdbVue - Home')
  await page.getByRole('main').getByRole('link', { name: 'About About page' }).click()
  await expect(page).toHaveTitle('OdbVue - About')
  expect(requests).toEqual(['refresh'])
})

test('renders the main application without exposing administrator modules', async ({ page }) => {
  await page.route('**/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }))
  await page.goto('/')
  await expect(page).toHaveTitle('OdbVue - Home')
  await expect(page.getByRole('main').getByRole('link', { name: 'About About page' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Sandbox/ })).toHaveCount(0)
  await expect(page.getByRole('contentinfo')).toContainText('v1.0.0')
})
