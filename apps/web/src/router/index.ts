import { createRouter, createWebHistory } from 'vue-router'
import { registerOdbVuePageManifest } from '@odbvue/web'
import { manifest, routes } from 'virtual:odbvue-pages'
import { handleHotUpdate } from 'vue-router/auto-routes'
import { useAppStore } from '@/stores'
import { isPageAllowed, loginRedirect } from './auth'
import { createPageTitleUpdater } from './title'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

registerOdbVuePageManifest(router, manifest)

let updateTitle: ReturnType<typeof createPageTitleUpdater> | undefined

router.beforeEach(async (to) => {
  const app = useAppStore()
  updateTitle ??= createPageTitleUpdater()
  await app.init()

  if (to.path === '/login' && app.auth.isAuthenticated) {
    return loginRedirect(router, to.query.redirect)
  }
  const denied = to.matched.find(
    (record) => !isPageAllowed(record.meta.access, record.meta, app.auth),
  )
  if (denied) {
    if (
      !app.auth.isAuthenticated &&
      (denied.meta.access === 'when-authenticated' || denied.meta.access === 'with-role')
    ) {
      return { path: '/login', query: { redirect: to.fullPath } }
    }
    app.ui.error('auth.forbidden')
    return to.path === '/' ? false : '/'
  }

  updateTitle(app.title, to.meta.title)
  return true
})

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
