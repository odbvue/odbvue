import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { title } from '../../package.json'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const app = useAppStore()
  const appTitle = title || 'OdbVue'
  const pageTitle = app.navigation.title(to.path)
  const documentTitle = pageTitle ? `${appTitle} - ${pageTitle}` : appTitle
  useHead({ title: documentTitle })
  app.ui.clearMessages()
  const result: string | boolean = app.navigation.guard(to.path)
  if (result) {
    app.ui.clearMessages()
  } else {
    app.ui.setError('unauthorized')
  }
  return result === '/login' ? { path: result, query: { redirect: to.path } } : result
})

router.afterEach(async (to) => {
  // Update live region for screen readers
  const live = document.getElementById('route-announcer')
  const page = typeof to.meta?.title === 'string' ? to.meta.title : 'Page'
  if (live) {
    live.textContent = '' // clear to re-trigger
    setTimeout(() => (live.textContent = `${page} loaded`), 30)
  }
  // Wait for new view to render, then move focus to first heading
  await nextTick()
  const heading = document.querySelector('main h1') as HTMLElement | null
  if (heading) {
    heading.setAttribute('tabindex', '-1')
    heading.focus({ preventScroll: true })
    heading.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
})

if (import.meta.hot) {
  handleHotUpdate(router)
}

export default router
