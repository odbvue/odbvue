import { createRouter, createWebHistory } from 'vue-router'
import { installAppRouting } from '@/app/router/api'
import { manifest, routes } from 'virtual:odbvue-pages'
import { handleHotUpdate } from 'vue-router/auto-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

installAppRouting(router, manifest)

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
