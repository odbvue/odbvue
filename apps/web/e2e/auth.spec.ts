import { expect, test, type Page } from '@playwright/test'

async function mockAuth(
  page: Page,
  options: { restored?: boolean; roles?: string[]; logoutFailure?: boolean } = {},
) {
  let session = options.restored ?? false
  const requests: string[] = []
  await page.route('**/auth/*', async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    requests.push(action ?? '')
    if (action === 'login') {
      const credentials = route.request().postDataJSON()
      if (credentials.password !== 'valid-password') {
        await route.fulfill({ status: 401, json: { message: 'Invalid credentials' } })
        return
      }
      session = true
      await route.fulfill({ json: { accessToken: 'test-access-token' } })
    } else if (action === 'refresh') {
      await route.fulfill({
        status: session ? 200 : 401,
        json: session ? { accessToken: 'test-access-token' } : {},
      })
    } else if (action === 'me') {
      expect(route.request().headers().authorization).toBe('Bearer test-access-token')
      await route.fulfill({
        json: {
          userId: 7,
          username: 'ada',
          displayName: 'Ada Lovelace',
          roles: options.roles ?? ['admin'],
          permissions: [],
        },
      })
    } else if (action === 'logout') {
      if (options.logoutFailure) {
        await route.fulfill({ status: 500, json: { message: 'Logout unavailable' } })
        return
      }
      session = false
      await route.fulfill({ status: 204 })
    } else {
      await route.abort()
    }
  })
  return requests
}

test('validates login, reports errors, returns to a protected page, and logs out', async ({
  page,
}) => {
  const requests = await mockAuth(page)
  await page.goto('/sandbox')
  await expect(page).toHaveURL(/\/login\?redirect=/)
  await expect(page.getByRole('heading', { name: 'Login', exact: true })).toBeVisible()
  await expect(page.getByLabel('Username')).toHaveAttribute('autocomplete', 'username')
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'current-password',
  )
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByText('Username is required', { exact: true })).toBeVisible()
  expect(requests).toEqual(['refresh'])

  await page.getByLabel('Username').fill('ada')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByText('Invalid username or password.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await page.getByLabel('Password', { exact: true }).fill('valid-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page).toHaveURL(/\/sandbox$/)
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible()
  expect(requests).toEqual(['refresh', 'login', 'login', 'me'])

  await page.reload()
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible()
  expect(requests).toEqual(['refresh', 'login', 'login', 'me', 'refresh', 'me'])
  const persisted = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))
  expect(JSON.stringify(persisted)).not.toMatch(/test-access-token|valid-password|Ada Lovelace/)

  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Login', exact: true }).first()).toBeVisible()
})

test('restores identity before handling an authenticated visit to login', async ({ page }) => {
  const requests = await mockAuth(page, { restored: true })
  await page.goto('/login?redirect=%2Fsandbox')
  await expect(page).toHaveURL(/\/sandbox$/)
  expect(requests).toEqual(['refresh', 'me'])
})

for (const field of ['Username', 'Password']) {
  test(`submits login once on Enter in ${field}`, async ({ page }) => {
    const requests = await mockAuth(page)
    await page.goto('/login?redirect=%2Fsandbox')
    await page.getByLabel('Username').fill('ada')
    await page.getByLabel('Password', { exact: true }).fill('valid-password')
    await page.getByLabel(field, { exact: true }).press('Enter')
    await expect(page).toHaveURL(/\/sandbox$/)
    expect(requests).toEqual(['refresh', 'login', 'me'])
  })
}

test('rejects external return URLs', async ({ page }) => {
  await mockAuth(page)
  await page.goto('/login?redirect=https%3A%2F%2Fexample.com')
  await page.getByLabel('Username').fill('ada')
  await page.getByLabel('Password', { exact: true }).fill('valid-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
})

test('denies role-protected pages and hides their home navigation', async ({ page }) => {
  await mockAuth(page, { restored: true, roles: [] })
  await page.goto('/sandbox')
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByText('You do not have permission to access this page.', { exact: true }),
  ).toBeVisible()
  await expect(page.getByRole('link', { name: /Sandbox/ })).toHaveCount(0)
})

test('reports failed logout while clearing local identity and returning home', async ({ page }) => {
  const requests = await mockAuth(page, { restored: true, logoutFailure: true })
  await page.goto('/sandbox')
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Login', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(requests).toEqual(['refresh', 'me', 'logout'])
})

test('loads app infrastructure and local shared components inside sandbox', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await mockAuth(page, { restored: true })

  await page.goto('/sandbox/capabilities/routing')
  await expect(page.getByRole('heading', { name: 'Routing', exact: true })).toBeVisible()
  await expect(page).toHaveTitle('OdbVue - Routing')

  await page.goto('/sandbox/capabilities/i18n')
  await expect(page.getByRole('heading', { name: 'Internationalization' })).toBeVisible()
  await expect(page.getByRole('row', { name: /Main application/ })).toContainText(/[1-9]\d*/)
  await expect(page.getByRole('row', { name: /sandbox/ })).toContainText(/[1-9]\d*/)

  await page.goto('/sandbox/capabilities/state')
  await expect(page.getByRole('heading', { name: 'Installed stores' })).toBeVisible()
  await expect(page.getByText('settings', { exact: true })).toBeVisible()
  await expect(page.getByText('ui', { exact: true })).toBeVisible()

  await page.goto('/sandbox/capabilities/components/form')
  await expect(page.getByLabel('Text 1', { exact: true })).toHaveValue('Hello World!')

  await page.goto('/sandbox/capabilities/components/editor')
  await expect(page.getByRole('heading', { name: 'HTML', exact: true })).toBeVisible()
  await expect(page.locator('.tiptap')).toBeVisible()

  await page.goto('/sandbox/capabilities/components/chart')
  await expect(page.getByRole('main').locator('canvas')).toHaveCount(3)
  expect(errors).toEqual([])
})
