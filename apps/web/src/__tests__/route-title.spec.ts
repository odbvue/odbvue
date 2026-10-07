import { describe, expect, it } from 'vitest'
import { createApp } from 'vue'
import { createHead, renderDOMHead } from '@unhead/vue/client'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createPageTitleUpdater } from '../router/title'

describe('route titles', () => {
  it('updates a single head entry after awaited initialization without an injection context', async () => {
    const app = createApp({})
    const head = createHead()
    app.use(head)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div />' } },
        { path: '/login', component: { template: '<div />' }, meta: { title: 'Login' } },
      ],
    })
    let updateTitle: ReturnType<typeof createPageTitleUpdater> | undefined
    router.beforeEach(async (to) => {
      updateTitle ??= createPageTitleUpdater()
      await Promise.resolve()
      updateTitle('OdbVue', to.meta.title)
    })
    app.use(router)

    await router.push('/login')
    await renderDOMHead(head)
    expect(document.title).toBe('OdbVue - Login')

    await router.push('/')
    await renderDOMHead(head)
    expect(document.title).toBe('OdbVue')
    expect(document.querySelectorAll('title')).toHaveLength(1)
    expect(head.entries.size).toBe(1)
  })
})
