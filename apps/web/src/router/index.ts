import { createRouter, createWebHistory } from 'vue-router'
import { installOdbVueRouting } from '@odbvue/web'
import { manifest, routes } from 'virtual:odbvue-pages'
import { handleHotUpdate } from 'vue-router/auto-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

installOdbVueRouting(router, manifest)

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
