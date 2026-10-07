import { afterEach, describe, expect, it, vi } from 'vitest'
import type { App } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import { auth, useAuth } from '@/capabilities/auth'
import { http, useHttp } from '@/capabilities/http'
import { errors, useErrors } from '@/capabilities/errors'
import * as errorService from '@/capabilities/errors'
import { createAuthGuard } from '@/capabilities/routing/auth'
import { useUi } from '@/capabilities/ui'

const bootstrap = vi.hoisted((): { router?: Router; app?: App } => ({}))

vi.mock('@/app/router', () => ({
  get default() {
    return bootstrap.router
  },
}))
vi.mock('@/app/App.vue', () => ({
  default: { template: '<div id="shell">Application shell</div>' },
}))
vi.mock('vue', async (importOriginal) => {
  const vue = await importOriginal<typeof import('vue')>()
  return {
    ...vue,
    createApp: (...args: Parameters<typeof vue.createApp>) => {
      bootstrap.app = vue.createApp(...args)
      return bootstrap.app
    },
  }
})

describe('application bootstrap', () => {
  afterEach(() => {
    bootstrap.app?.unmount()
    bootstrap.app = undefined
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('exposes single services without installing a container or restoring auth', () => {
    const restore = vi.spyOn(auth, 'restore')
    expect(useAuth()).toBe(auth)
    expect(useHttp()).toBe(http)
    expect(useErrors()).toBe(errors)
    expect(useUi().error).toBeTypeOf('function')
    expect(restore).not.toHaveBeenCalled()
  })

  it('mounts the shell while initial auth restoration is pending and captures errors without notifications', async () => {
    let finish!: (authenticated: boolean) => void
    const restoration = new Promise<boolean>((resolve) => {
      finish = resolve
    })
    const restore = vi.spyOn(auth, 'restore').mockReturnValue(restoration)
    const capture = vi.spyOn(errorService, 'captureError')
    const ui = useUi()
    ui.clear()
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<div />' } }],
    })
    router.beforeEach(createAuthGuard(router))
    bootstrap.router = router
    document.body.innerHTML = '<div id="app"></div>'

    try {
      await import('@/main')
      expect(document.querySelector('#shell')?.textContent).toBe('Application shell')
      expect(router.currentRoute.value.matched).toHaveLength(0)
      expect(restore).toHaveBeenCalledOnce()
      const error = new Error('Render failed')
      bootstrap.app?.config.errorHandler?.(error, null, 'render')
      expect(capture).toHaveBeenCalledWith(error, expect.objectContaining({ source: 'vue' }))
      expect(ui.notification.value).toBeUndefined()
    } finally {
      finish(false)
      await router.isReady()
    }
    const failure = new Error('Navigation failed')
    router.beforeEach(() => {
      throw failure
    })
    await expect(router.push('/?next=1')).rejects.toBe(failure)
    expect(capture).toHaveBeenCalledWith(failure, {
      source: 'router',
      context: { path: '/?next=1' },
    })
    expect(ui.notification.value).toBeUndefined()
  })
})
