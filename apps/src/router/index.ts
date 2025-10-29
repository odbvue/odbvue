import { createRouter, createWebHistory } from 'vue-router'
import { routes, handleHotUpdate } from 'vue-router/auto-routes'
import { title } from '../../package.json'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
})

router.beforeEach(async (to) => {
  const appTitle = title || 'OdbVue'
  const pageTitle = useNavigationStore().title(to.path)
  const documentTitle = pageTitle ? `${appTitle} - ${pageTitle}` : appTitle
  useHead({ title: documentTitle })
  return true
})

router.afterEach((to) => {
  const live = document.getElementById('route-announcer')
  if (!live) return
  const page = typeof to.meta?.title === 'string' ? to.meta.title : 'Page'
  live.textContent = `${page} loaded`
})

if (import.meta.hot) {
  handleHotUpdate(router)
}

export default router
