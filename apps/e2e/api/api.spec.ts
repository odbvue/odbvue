import { test, expect, APIRequestContext } from '@playwright/test'

const apiUrl = process.env.VITE_API_URI
const baseRequestOptions = { ignoreHTTPSErrors: true }

let token: string

test.beforeAll(async ({ playwright }) => {
  const context = await playwright.chromium.launchPersistentContext('', {})
  const page = context.pages()[0] || (await context.newPage())
  const request = context.request
  const response = await request.post(`${apiUrl}app/login/`, {
    data: {
      username: process.env.VITE_APP_USERNAME,
      password: process.env.VITE_APP_PASSWORD,
    },
    ...baseRequestOptions,
  })
  const loginData = await response.json()
  token = loginData.access_token
  await context.close()
})

function getRequestOptionsAnon() {
  return baseRequestOptions
}

function getRequestOptionsAuth() {
  return {
    ...baseRequestOptions,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }
}

test('app context API returns version with v prefix', async ({ request }) => {
  const response = await request.get(`${apiUrl}app/context/`, getRequestOptionsAnon())
  expect(response.ok()).toBeTruthy()

  const data = await response.json()
  expect(data.version).toBeDefined()
  expect(data.version).toMatch(/^v/)
})

test('login with invalid credentials returns 401', async ({ request }) => {
  const response = await request.post(`${apiUrl}app/login/`, {
    data: {
      username: 'foo',
      password: 'bar',
    },
    ...getRequestOptionsAnon(),
  })
  expect(response.status()).toBe(401)
})

test('login with valid credentials returns 200', async ({ request }) => {
  const response = await request.post(`${apiUrl}app/login/`, {
    data: {
      username: process.env.VITE_APP_USERNAME,
      password: process.env.VITE_APP_PASSWORD,
    },
    ...getRequestOptionsAnon(),
  })
  expect(response.status()).toBe(200)
})

test('login with valid credentials and get context', async ({ request }) => {
  const response = await request.get(`${apiUrl}app/context/`, getRequestOptionsAuth())
  expect(response.ok()).toBeTruthy()

  const data = await response.json()
  expect(data.user[0].uuid).toBeDefined()
})

test('login with invalid password 7 times, should get 429', async ({ request }) => {
  let status = 0
  for (let i = 0; i < 7; i++) {
    const response = await request.post(`${apiUrl}app/login/`, {
      data: {
        username: process.env.VITE_APP_USERNAME,
        password: 'bar',
      },
      ...getRequestOptionsAnon(),
    })
    status = response.status()
  }
  expect(status).toBe(429)
})
