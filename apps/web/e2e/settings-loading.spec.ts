import { expect, test } from '@playwright/test'

for (const viewport of [
  { width: 1280, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`keeps settings save feedback local at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.route('**/auth/**', async (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.fallback()
      const action = new URL(route.request().url()).pathname.split('/').at(-1)
      if (action === 'config')
        await route.fulfill({
          json: { password: true, ldap: false, google: false, signup: true, twoFactor: false },
        })
      else if (action === 'refresh')
        await route.fulfill({ json: { accessToken: 'loading-test-token' } })
      else if (action === 'me')
        await route.fulfill({
          json: {
            userId: 7,
            username: 'test-admin',
            displayName: 'Test Admin',
            roles: ['admin'],
            permissions: [],
          },
        })
      else throw new Error(`Unexpected authentication request: ${action}`)
    })

    const write = Promise.withResolvers<void>()
    const refresh = Promise.withResolvers<void>()
    let reads = 0
    let value = 'Original'
    await page.route('**/admin/settings**', async (route) => {
      if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.fallback()
      if (route.request().method() === 'PUT') {
        if (route.request().postDataJSON().value === 'Rejected') {
          return route.fulfill({ status: 403, json: {} })
        }
        expect(route.request().postDataJSON()).toEqual({ value: 'Updated' })
        await write.promise
        value = 'Updated'
        return route.fulfill({ status: 204 })
      }
      reads++
      if (reads > 1) await refresh.promise
      await route.fulfill({
        json: {
          items: [
            { id: 'TEST_SETTING', value, secret: 'N', readonly: 'N', meta: { type: 'text' } },
          ],
        },
      })
    })

    try {
      await page.goto('/admin/settings')
      const edit = page.getByRole('button', { name: 'Edit setting', exact: true })
      await expect(edit).toBeVisible()
      // Focus restoration can scroll on mobile; compare document coordinates.
      const mainTop = await page
        .locator('main')
        .evaluate((main) => main.getBoundingClientRect().top + window.scrollY)
      await edit.click()
      const dialog = page.getByRole('dialog')
      const field = dialog.getByRole('textbox', { name: 'Value', exact: true })
      const save = dialog.getByRole('button', { name: 'Save setting', exact: true })
      const loadingOverlay = '.v-overlay--active:has(> .v-overlay__content > .v-progress-circular)'
      await field.fill('Updated')
      await save.click()
      await expect(save).toBeDisabled()
      await expect(field).toBeDisabled()
      await expect(dialog.getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled()
      await expect(dialog.locator(loadingOverlay)).toHaveCount(1)
      await expect(page.locator(loadingOverlay)).toHaveCount(1)
      await expect(page.locator('main > .v-overlay--active')).toHaveCount(0)
      await expect(page.locator('.v-progress-linear--active')).toHaveCount(0)
      await expect(page.locator('.v-progress-circular--indeterminate:visible')).toHaveCount(1)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()

      write.resolve()
      await expect(dialog).not.toBeVisible()
      await expect(page.locator(loadingOverlay)).toHaveCount(1)
      await expect(page.locator('main > .v-overlay--active')).toHaveCount(0)
      await expect(page.locator('table').getByText('Original', { exact: true })).toBeVisible()
      await expect(
        page.locator('.v-snackbar').getByText('Setting saved.', { exact: true }),
      ).toBeVisible()
      expect(
        await page
          .locator('main')
          .evaluate((main) => main.getBoundingClientRect().top + window.scrollY),
      ).toBe(mainTop)

      refresh.resolve()
      await expect(page.locator('table').getByText('Updated', { exact: true })).toBeVisible()
      await expect(page.locator(loadingOverlay)).toHaveCount(0)
      await expect(page.locator('.v-progress-linear--active')).toHaveCount(0)
      expect(reads).toBe(2)

      await edit.click()
      await field.fill('Rejected')
      await save.click()
      await expect(dialog.locator(loadingOverlay)).toHaveCount(0)
      await expect(save).toBeEnabled()
      await expect(field).toHaveValue('Rejected')
      await field.fill('Updated')
      await save.click()
      await expect(dialog).not.toBeVisible()
      await expect(page.locator(loadingOverlay)).toHaveCount(0)
      const saved = page.locator('.v-snackbar').filter({ hasText: 'Setting saved.' })
      await expect(saved).toBeVisible()
      await expect(
        page.getByText('The setting could not be saved. Please try again.', { exact: true }),
      ).not.toBeVisible()
      await saved.getByRole('button', { name: 'Close', exact: true }).click()
      await expect(
        page
          .locator('.v-snackbar')
          .getByText('The setting could not be saved. Please try again.', { exact: true }),
      ).toBeVisible()
      await expect(page.locator('.v-snackbar:visible')).toHaveCount(1)
      expect(reads).toBe(3)
    } finally {
      write.resolve()
      refresh.resolve()
      await page.unrouteAll({ behavior: 'wait' })
    }
  })
}
