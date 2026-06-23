import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (_to) => {
  const appTitle = useAppStore().title || 'OdbVue'
  useHead({ title: appTitle })
  useAppStore().ui.clearAlertForRouteChange()
  return true
})

export default router

if (import.meta.hot) {
  handleHotUpdate(router)
}
