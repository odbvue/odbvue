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

if (import.meta.hot) {
  handleHotUpdate(router)
}

export default router
