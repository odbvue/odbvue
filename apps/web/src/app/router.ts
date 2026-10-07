import { createRouter, createWebHistory } from 'vue-router'
import { createAuthGuard, updatePageTitle, registerPageManifest } from '@/capabilities/routing'
import { manifest, routes } from 'virtual:odbvue-pages'
import { handleHotUpdate } from 'vue-router/auto-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

registerPageManifest(router, manifest)
router.beforeEach(createAuthGuard(router))
router.afterEach((to, _from, failure) => {
  if (!failure) updatePageTitle(to.meta)
})

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
