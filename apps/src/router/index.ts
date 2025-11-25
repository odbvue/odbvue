import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { title } from '../../package.json'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  to.meta.performance = performance.now()
  const app = useAppStore()
  app.ui.clearMessages()
  const result: string | boolean = app.navigation.guard(to.path)
  if (result) {
    const appTitle = title || 'OdbVue'
    const pageTitle = app.navigation.title(to.path)
    const documentTitle = pageTitle ? `${appTitle} - ${pageTitle}` : appTitle
    useHead({ title: documentTitle })
  } else {
    window.scrollTo(0, 0)
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
  //
  const duration: number = performance.now() - (to.meta.performance as number)
  if (duration >= useAppStore().appPerformanceThresholdMs) {
    const appAudit = useAuditStore()
    appAudit.wrn('Slow Page Load', `Route ${to.path} took ${duration}ms`)
  }
})

if (import.meta.hot) {
  handleHotUpdate(router)
}

export default router
