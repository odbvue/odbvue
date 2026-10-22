import { expect, test, type Page } from '@playwright/test'

test('enrolls an authenticator and requires saving recovery codes before redirecting', async ({
  page,
}) => {
  const challenge = 'A'.repeat(64)
  const setupSecret = 'B'.repeat(32)
  const recoveryCodes = Array.from({ length: 10 }, (_, index) => String(index).padStart(32, '0'))
  let authenticated = false
  const actions: string[] = []
  await page.route('**/auth/**', async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    actions.push(action ?? '')
    if (action === 'refresh') await route.fulfill({ status: 401, json: {} })
    else if (action === 'state')
      await route.fulfill({
        json: {
          user: authenticated
            ? { userId: 7, username: 'ada', displayName: 'Ada', roles: ['admin'], permissions: [] }
            : null,
          providers: { password: true, google: false },
          signup: true,
          twoFactor: true,
        },
      })
    else if (action === 'login')
      await route.fulfill({ json: { accessToken: null, challenge, setupSecret } })
    else if (action === 'verify') {
      expect(route.request().postDataJSON()).toEqual({ challenge, code: '123456' })
      authenticated = true
      await route.fulfill({ json: { accessToken: 'verified-token', recoveryCodes } })
    } else await route.abort()
  })
  await page.goto('/login?redirect=%2Fsandbox')
  await page.getByLabel('Username').fill('ada')
  await page.getByLabel('Password', { exact: true }).fill('valid-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Two-factor authentication', exact: true }),
  ).toBeVisible()
  const qr = page.getByRole('img', { name: 'Authenticator setup QR code', exact: true })
  await expect(qr).toBeVisible()
  await expect(qr).toHaveAttribute('src', /^data:image\/svg\+xml;charset=utf-8,/)
  await expect
    .poll(() =>
      qr.evaluate(
        (image) =>
          image instanceof HTMLImageElement &&
          image.complete &&
          image.naturalWidth === 256 &&
          image.naturalHeight === 256,
      ),
    )
    .toBe(true)
  await expect(page.getByLabel('Authenticator setup key')).not.toBeVisible()
  await page.getByText("Can't scan the code? Enter the setup key manually", { exact: true }).click()
  await expect(page.getByLabel('Authenticator setup key')).toBeVisible()
  await expect(page.getByLabel('Authenticator setup key')).toHaveValue(setupSecret)
  await expect(page).toHaveURL(/\/login\?redirect=/)
  expect(actions).toEqual(['refresh', 'state', 'login'])
  await page.getByLabel('Authenticator or recovery code').fill('123456')
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await expect(page.locator('li code')).toHaveCount(10)
  await expect(page.getByText(recoveryCodes[0]!, { exact: true })).toBeVisible()
  await expect(page.getByLabel('Authenticator setup key')).toHaveCount(0)
  await expect(qr).toHaveCount(0)
  await expect(page).toHaveURL(/\/login\?redirect=/)
  const persisted = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  )
  expect(persisted).not.toMatch(/verified-token|BBBBBBBBBBBBBBBB|0000000000000000/)
  await page.getByRole('button', { name: 'I have saved my recovery codes', exact: true }).click()
  await expect(page).toHaveURL(/\/sandbox$/)
  expect(actions).toEqual(['refresh', 'state', 'login', 'verify', 'state'])
})

test('requests recovery and resets a password only after explicit submission', async ({ page }) => {
  const token = 'A'.repeat(64)
  const actions: string[] = []
  await page.route('**/auth/*', async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').at(-1)
    actions.push(action ?? '')
    if (action === 'refresh') {
      await route.fulfill({ status: 401, json: {} })
    } else if (action === 'state') {
      await route.fulfill({
        json: {
          user: null,
          providers: { password: true, google: false },
          signup: true,
          twoFactor: true,
        },
      })
    } else if (action === 'recover-password') {
      expect(route.request().postDataJSON()).toEqual({ email: 'ada+reset@example.com' })
      await route.fulfill({ status: 204 })
    } else if (action === 'reset-password') {
      expect(route.request().postDataJSON()).toEqual({
        token,
        password: 'new secure password!',
        passwordRepeat: 'new secure password!',
      })
      await route.fulfill({ status: 204 })
    } else await route.abort()
  })

  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?', exact: true }).click()
  await expect(page).toHaveURL(/\/recover-password$/)
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  await expect(page.getByText('Email is required', { exact: true })).toBeVisible()
  expect(actions).toEqual(['refresh', 'state'])
  await page.getByLabel('Email', { exact: true }).fill('ada+reset@example.com')
  await page.getByLabel('Email', { exact: true }).press('Enter')
  await expect(page.getByText(/If an active account exists/)).toBeVisible()
  expect(actions).toEqual(['refresh', 'state', 'recover-password'])

  await page.goto(`/reset-password#token=${token}`)
  await expect(page).toHaveURL(/\/reset-password$/)
  expect(actions).toEqual(['refresh', 'state', 'recover-password', 'refresh', 'state'])
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  )
  await page.getByLabel('Password', { exact: true }).fill('new secure password!')
  await page.getByLabel('Repeat password', { exact: true }).fill('different')
  await page.getByRole('button', { name: 'Reset password', exact: true }).click()
  await expect(page.getByText('Passwords must match', { exact: true })).toBeVisible()
  expect(actions).toHaveLength(5)
  await page.getByLabel('Repeat password', { exact: true }).fill('new secure password!')
  await page.getByLabel('Repeat password', { exact: true }).press('Enter')
  await expect(page.getByText(/Password reset. All previous sessions/)).toBeVisible()
  expect(actions).toEqual([
    'refresh',
    'state',
    'recover-password',
    'refresh',
    'state',
    'reset-password',
  ])
  const persisted = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))
  expect(JSON.stringify(persisted)).not.toContain(token)
  expect(JSON.stringify(persisted)).not.toContain('new secure password!')
  await page.getByRole('link', { name: 'Login', exact: true }).last().click()
  await expect(page).toHaveURL(/\/login$/)
})

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
    } else if (action === 'state') {
      expect(route.request().headers().authorization).toBe(
        session ? 'Bearer test-access-token' : undefined,
      )
      await route.fulfill({
        json: {
          providers: { password: true, google: false },
          signup: true,
          twoFactor: true,
          user: session
            ? {
                userId: 7,
                username: 'ada',
                displayName: 'Ada Lovelace',
                roles: options.roles ?? ['admin'],
                permissions: [],
              }
            : null,
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
  expect(requests).toEqual(['refresh', 'state'])

  await page.getByLabel('Username').fill('ada')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page.getByText('Invalid username or password.', { exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/login\?redirect=/)

  await page.getByLabel('Password', { exact: true }).fill('valid-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
  await expect(page).toHaveURL(/\/sandbox$/)
  await expect(
    page.getByRole('button', { name: 'Account menu for Ada Lovelace', exact: true }),
  ).toBeVisible()
  expect(requests).toEqual(['refresh', 'state', 'login', 'login', 'state'])

  await page.reload()
  await expect(
    page.getByRole('button', { name: 'Account menu for Ada Lovelace', exact: true }),
  ).toBeVisible()
  expect(requests).toEqual(['refresh', 'state', 'login', 'login', 'state', 'refresh', 'state'])
  const persisted = await page.evaluate(() => ({
    local: { ...localStorage },
    session: { ...sessionStorage },
  }))
  expect(JSON.stringify(persisted)).not.toMatch(/test-access-token|valid-password|Ada Lovelace/)

  await page.getByRole('button', { name: 'Account menu for Ada Lovelace', exact: true }).click()
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('link', { name: 'Login', exact: true }).first()).toBeVisible()
})

test('restores identity before handling an authenticated visit to login', async ({ page }) => {
  const requests = await mockAuth(page, { restored: true })
  await page.goto('/login?redirect=%2Fsandbox')
  await expect(page).toHaveURL(/\/sandbox$/)
  expect(requests).toEqual(['refresh', 'state'])
})

for (const field of ['Username', 'Password']) {
  test(`submits login once on Enter in ${field}`, async ({ page }) => {
    const requests = await mockAuth(page)
    await page.goto('/login?redirect=%2Fsandbox')
    await page.getByLabel('Username').fill('ada')
    await page.getByLabel('Password', { exact: true }).fill('valid-password')
    await page.getByLabel(field, { exact: true }).press('Enter')
    await expect(page).toHaveURL(/\/sandbox$/)
    expect(requests).toEqual(['refresh', 'state', 'login', 'state'])
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
  await page.getByRole('button', { name: 'Account menu for Ada Lovelace', exact: true }).click()
  await page.getByRole('button', { name: 'Logout', exact: true }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Login', exact: true }).first()).toBeVisible()
  await expect(page.getByRole('alert')).toBeVisible()
  expect(requests).toEqual(['refresh', 'state', 'logout'])
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
