import { useHead } from '@unhead/vue'
import type { Router } from 'vue-router'
import { useAppServices } from '../context'
import { useUi } from '../ui/store.js'
import { canAccessPage, resolveAuthRedirect } from './auth.js'
import type { OdbVuePageManifest } from './manifest.js'
import { registerOdbVuePageManifest } from './registry.js'

export function installAppRouting(router: Router, manifest: OdbVuePageManifest): () => void {
  registerOdbVuePageManifest(router, manifest)
  let titleEntry: ReturnType<typeof useHead> | undefined
  let appTitle = 'OdbVue'

  const removeGuard = router.beforeEach(async (to) => {
    const runtime = useAppServices()
    const auth = runtime.auth
    const ui = useUi()
    titleEntry ??= useHead({})
    appTitle = runtime.config.title || 'OdbVue'
    const login = runtime.config.auth?.routes?.login ?? '/login'
    const authenticated = runtime.config.auth?.routes?.authenticated ?? '/'
    const forbidden = runtime.config.auth?.routes?.forbidden ?? '/'
    await runtime.ready

    if (to.path === login && auth.authenticated.value) {
      const redirect = resolveAuthRedirect(router, to.query.redirect, authenticated, login)
      return redirect === to.fullPath ? false : redirect
    }
    const denied = to.matched.find((record) => !canAccessPage(record.meta, auth))
    if (!denied) return true
    if (
      !auth.authenticated.value &&
      (denied.meta.access === 'when-authenticated' || denied.meta.access === 'with-role') &&
      to.path !== login
    ) {
      return { path: login, query: { redirect: to.fullPath } }
    }
    ui.error('auth.forbidden')
    return to.path === forbidden ? false : forbidden
  })
  const removeTitle = router.afterEach((to, _from, failure) => {
    if (!failure)
      titleEntry?.patch({ title: to.meta.title ? `${appTitle} - ${to.meta.title}` : appTitle })
  })

  return () => {
    removeGuard()
    removeTitle()
    titleEntry?.dispose()
  }
}
