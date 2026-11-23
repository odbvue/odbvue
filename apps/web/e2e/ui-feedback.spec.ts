import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`demonstrates independent page alerts and snackbar queues at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport)
    await page.route('**/auth/**', async (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.fallback()
      const action = new URL(route.request().url()).pathname.split('/').at(-1)
      if (action === 'config')
        return route.fulfill({
          json: { password: true, ldap: false, google: false, signup: true, twoFactor: false },
        })
      if (action === 'refresh')
        return route.fulfill({ json: { accessToken: 'ui-feedback-test-token' } })
      if (action === 'me')
        return route.fulfill({
          json: {
            userId: 7,
            username: 'test-admin',
            displayName: 'Test Admin',
            roles: ['admin'],
            permissions: [],
          },
        })
      throw new Error(`Unexpected authentication request: ${action}`)
    })

    await page.goto('/sandbox/capabilities/ui')
    const alertCard = page.locator('.v-card').filter({
      has: page.getByText('Page alert', { exact: true }),
    })
    const queueCard = page.locator('.v-card').filter({
      has: page.getByText('Snackbar queue', { exact: true }),
    })
    const alert = page.locator('.v-app-bar .v-alert')
    const snackbar = page.locator('.v-snackbar:visible')
    await alertCard.getByRole('button', { name: 'Warning', exact: true }).click()
    await expect(alert).toContainText('Please review this warning.')
    await queueCard.getByRole('button', { name: 'Queue four messages', exact: true }).click()
    await expect(snackbar).toContainText('An informational message.')
    await expect(alert).toContainText('Please review this warning.')
    await snackbar.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(snackbar).toContainText('The operation completed successfully.')

    await alertCard.getByRole('button', { name: 'Clear alert', exact: true }).click()
    await expect(alert).toHaveCount(0)
    await expect(snackbar).toContainText('The operation completed successfully.')
    await alertCard.getByRole('button', { name: 'Error', exact: true }).click()
    await expect(alert).toContainText('The operation could not be completed.')
    await snackbar.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(snackbar).toContainText('Please review this warning.')
    await snackbar.getByRole('button', { name: 'Close', exact: true }).click()
    await expect(snackbar).toContainText('The operation could not be completed.')
    await queueCard.getByRole('button', { name: 'Persistent snackbar', exact: true }).click()
    await queueCard.getByRole('button', { name: 'Clear snackbars', exact: true }).click()
    await expect(snackbar).toHaveCount(0)
    await expect(alert).toContainText('The operation could not be completed.')
    await queueCard.getByRole('button', { name: 'Persistent snackbar', exact: true }).click()
    await expect(snackbar).toContainText('This snackbar stays until you close it.')
    await page.getByRole('button', { name: 'Clear all feedback', exact: true }).click()
    await expect(alert).toHaveCount(0)
    await expect(snackbar).toHaveCount(0)

    await page.getByRole('button', { name: 'Load for two seconds', exact: true }).click()
    await expect(page.locator('main > .v-overlay--active')).toHaveCount(1)
    await expect(page.locator('.v-progress-linear--active')).toHaveCount(1)
    await expect(page.locator('main > .v-overlay--active')).toHaveCount(0)
    await expect(page.locator('.v-progress-linear--active')).toHaveCount(0)
  })
}
