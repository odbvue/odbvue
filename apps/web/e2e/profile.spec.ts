import { expect, test, type Page } from '@playwright/test'

async function mockProfile(
  page: Page,
  passwordConnected = true,
  googleConnected = true,
  googlePhoto: string | null = null,
) {
  const updates: unknown[] = []
  let avatar: string | null = null
  let active = true
  await page.route('**/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    if (path.endsWith('/refresh')) {
      await route.fulfill({
        status: active ? 200 : 401,
        json: active ? { accessToken: 'profile-token' } : {},
      })
    } else if (path.endsWith('/state')) {
      await route.fulfill({
        json: {
          providers: { password: true, google: true },
          signup: true,
          twoFactor: true,
          user: active
            ? {
                userId: 7,
                username: 'ada@example.com',
                displayName: 'Ada Lovelace',
                avatarUrl: googlePhoto,
                avatarId: avatar ? 'a'.repeat(32) : null,
                avatarUploaded: avatar ? 1 : 0,
                passwordConnected: passwordConnected ? 1 : 0,
                googleConnected: googleConnected ? 1 : 0,
                roles: [],
                permissions: [],
              }
            : null,
        },
      })
    } else if (path.endsWith('/google/link/start')) {
      updates.push(route.request().postDataJSON())
      await route.fulfill({
        json: {
          authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=profile-link',
        },
      })
    } else if (path.endsWith(`/avatar/${'a'.repeat(32)}`)) {
      expect(route.request().headers().authorization).toBe(['Bearer', 'profile-token'].join(' '))
      await route.fulfill({
        contentType: 'image/jpeg',
        body: Buffer.from(avatar!.split(',')[1]!, 'base64'),
      })
    } else if (path.endsWith('/avatar')) {
      expect(route.request().headers().authorization).toBe(['Bearer', 'profile-token'].join(' '))
      const data = route.request().postDataJSON()
      updates.push(data)
      avatar = data.avatar
      await route.fulfill({ status: 204 })
    } else if (path.endsWith('/change-password')) {
      const data = route.request().postDataJSON()
      updates.push(data)
      if (data.currentPassword !== 'current-password') {
        await route.fulfill({ status: 403, json: { code: 'PASSWORD_CHANGE_CURRENT_INVALID' } })
      } else {
        active = false
        await route.fulfill({ status: 204 })
      }
    } else if (path.endsWith('/logout')) {
      active = false
      await route.fulfill({ status: 204 })
    } else await route.abort()
  })
  return updates
}

test('opens Settings through the identity menu and distinguishes local and Google sign-in', async ({
  page,
}) => {
  await mockProfile(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Account menu for Ada Lovelace' })).toBeVisible()
  await expect(page.getByRole('main').locator('a[href="/settings"]')).toHaveCount(0)
  await expect(page.getByRole('main').locator('a[href="/about"]')).toBeVisible()
  await page.getByRole('button', { name: 'Account menu for Ada Lovelace' }).click()
  const menu = page.locator('.v-menu .v-list')
  await expect(menu.getByRole('button', { name: 'Logout', exact: true })).toBeVisible()
  await menu.getByRole('link', { name: /Settings$/ }).click()
  await expect(page).toHaveURL(/\/settings\/account$/)
  await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute(
    'aria-selected',
    'true',
  )
  await expect(page.locator('.v-breadcrumbs')).toContainText('Settings')
  await expect(page.locator('.v-breadcrumbs')).toContainText('Account')
  await expect(page.getByRole('tab')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Ada Lovelace', exact: true })).toBeVisible()
  await expect(page.getByText('ada@example.com', { exact: true })).toBeVisible()
  await expect(page.getByLabel('Choose profile photo', { exact: true })).toHaveCount(0)
  await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Connected', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Connect Google', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toBeVisible()
})

test('redirects the settings entry and legacy account links without dropping query or hash', async ({
  page,
}) => {
  await mockProfile(page, true, false)
  for (const path of ['/settings', '/account']) {
    await page.goto(`${path}?redirect=%2F&other=kept#security`)
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === '/settings/account' &&
        url.searchParams.get('redirect') === '/' &&
        url.searchParams.get('other') === 'kept' &&
        url.hash === '#security',
    )
    await expect(page.getByLabel('Current password', { exact: true })).toBeVisible()
    await expect(page.getByRole('tab', { name: 'Account', exact: true })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  }
})

test('continues to handle Google callbacks from legacy account URLs', async ({ page }) => {
  await mockProfile(page)
  await page.goto('/account?google=linked&redirect=%2F')
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByText('Google is now connected to your account.', { exact: true }),
  ).toBeVisible()
})

test('protects account settings and preserves the destination through login', async ({ page }) => {
  await page.route('**/auth/**', async (route) => {
    if (new URL(route.request().url()).pathname.endsWith('/state')) {
      await route.fulfill({
        json: {
          user: null,
          providers: { password: true, google: true },
          signup: true,
          twoFactor: true,
        },
      })
    } else await route.fulfill({ status: 401, json: {} })
  })
  await page.goto('/settings')
  await expect(page).toHaveURL(/\/login\?redirect=\/settings\/account$/)
  await expect(page.getByRole('heading', { name: 'Account', exact: true })).toHaveCount(0)
})

test('reveals and closes editing forms on mobile without crowding the overview', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const updates = await mockProfile(page, true, false)
  await page.goto('/settings/account')
  await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Change photo', exact: true }).click()
  await expect(page.getByLabel('Choose profile photo', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(page.getByLabel('Choose profile photo', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByLabel('Current password', { exact: true }).fill('private-password')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByLabel('Current password', { exact: true })).toHaveValue('')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Connect Google', exact: true }).click()
  await page.getByLabel('Current password', { exact: true }).fill('private-password')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Connect Google', exact: true }).click()
  await expect(page.getByLabel('Current password', { exact: true })).toHaveValue('')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  expect(updates).toHaveLength(0)
})

test('Google-only accounts do not show a misleading local password form, including on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockProfile(page, false)
  await page.goto('/settings/account')
  await expect(page.getByText('Not connected', { exact: true })).toBeVisible()
  await expect(page.getByText(/This account uses Google sign-in/)).toBeVisible()
  await expect(page.getByLabel('Current password', { exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Change password', exact: true })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await page.getByRole('button', { name: 'Account menu for Ada Lovelace' }).click()
  await expect(page.getByRole('button', { name: 'Logout', exact: true })).toBeVisible()
})

for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
  test(`normalizes ${type} to a stored JPEG, updates navigation, persists on reload and removes it`, async ({
    page,
  }) => {
    const googlePhoto = 'https://lh3.googleusercontent.com/profile-test'
    await page.route(googlePhoto, (route) =>
      route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jfN0AAAAASUVORK5CYII=',
          'base64',
        ),
      }),
    )
    const updates = await mockProfile(page, true, true, googlePhoto)
    await page.goto('/settings/account')
    const data = await page.evaluate((mimeType) => {
      const canvas = document.createElement('canvas')
      canvas.width = 320
      canvas.height = 200
      const context = canvas.getContext('2d')!
      context.fillStyle = '#0055aa'
      context.fillRect(0, 0, 320, 200)
      return canvas.toDataURL(mimeType).split(',')[1]!
    }, type)
    await page.getByRole('button', { name: 'Change photo', exact: true }).click()
    await page.getByLabel('Choose profile photo', { exact: true }).setInputFiles({
      name: `avatar.${type.split('/')[1]}`,
      mimeType: type,
      buffer: Buffer.from(data, 'base64'),
    })
    await expect(page.getByRole('button', { name: 'Remove uploaded photo' })).toBeVisible()
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({
      avatar: expect.stringMatching(/^data:image\/jpeg;base64,\/9j\//),
    })
    await expect(
      page.getByRole('button', { name: 'Account menu for Ada Lovelace' }).locator('img'),
    ).toBeVisible()
    const thumbnail = await page
      .getByRole('button', { name: 'Account menu for Ada Lovelace' })
      .locator('img')
      .evaluate((image: HTMLImageElement) => ({
        width: image.naturalWidth,
        height: image.naturalHeight,
        source: image.src,
      }))
    expect(thumbnail).toMatchObject({ width: 128, height: 128 })
    expect(thumbnail.source).toMatch(/^blob:/)
    await page.reload()
    await page.getByRole('button', { name: 'Change photo', exact: true }).click()
    await expect(page.getByRole('button', { name: 'Remove uploaded photo' })).toBeVisible()
    await page.getByRole('button', { name: 'Remove uploaded photo' }).click()
    await expect(page.getByRole('button', { name: 'Remove uploaded photo' })).toHaveCount(0)
    expect(updates).toHaveLength(2)
    expect(updates[1]).toEqual({ avatar: null })
    await expect(
      page.getByRole('button', { name: 'Account menu for Ada Lovelace' }).locator('img'),
    ).toHaveAttribute('src', googlePhoto)
  })
}

test('still links Google with a current password and preserves the guided return destination', async ({
  page,
}) => {
  const updates = await mockProfile(page, true, false)
  await page.route('https://accounts.google.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>Google authorization</h1>' }),
  )
  await page.goto('/settings/account?redirect=/')
  await expect(page.getByText('Not connected', { exact: true })).toBeVisible()
  await page.getByLabel('Current password', { exact: true }).first().fill('current-password')
  await page.getByRole('button', { name: 'Connect Google', exact: true }).click()
  await expect(page).toHaveURL('https://accounts.google.com/o/oauth2/v2/auth?state=profile-link')
  expect(updates).toEqual([{ redirect: '/', password: 'current-password' }])
  await page.goto('/settings/account?google=linked&redirect=/')
  await expect(page).toHaveURL(/\/$/)
  await expect(
    page.getByText('Google is now connected to your account.', { exact: true }),
  ).toBeVisible()
})

test('validates password changes, retains the session on failure and returns to login on success', async ({
  page,
}) => {
  const updates = await mockProfile(page)
  await page.goto('/settings/account')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await page.getByLabel('Current password', { exact: true }).fill('wrong-password')
  await page.getByLabel('New password', { exact: true }).fill('new-password')
  await page.getByLabel('Repeat password', { exact: true }).fill('different-password')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page.getByText('Passwords must match', { exact: true })).toBeVisible()
  expect(updates).toHaveLength(0)
  await page.getByLabel('Repeat password', { exact: true }).fill('new-password')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(
    page.getByText('Your current password is incorrect. Please try again.', { exact: true }),
  ).toBeVisible()
  await expect(page).toHaveURL(/\/settings\/account$/)
  await expect(page.getByLabel('Current password', { exact: true })).toHaveValue('')
  await page.getByLabel('Current password', { exact: true }).fill('current-password')
  await page.getByLabel('New password', { exact: true }).fill('new-password')
  await page.getByLabel('Repeat password', { exact: true }).fill('new-password')
  await page.getByRole('button', { name: 'Change password', exact: true }).click()
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByText(/Password changed. All sessions/)).toBeVisible()
  expect(updates).toHaveLength(2)
  const persisted = await page.evaluate(() =>
    JSON.stringify({ ...localStorage, ...sessionStorage }),
  )
  expect(persisted).not.toMatch(/current-password|new-password|profile-token/)
})
