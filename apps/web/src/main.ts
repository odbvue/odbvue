import { createApp } from 'vue'

import App from './app/App.vue'
import router from './app/router'
import { installApp } from '@/app/plugins'
import { useUi } from '@/app/ui'
import odbvueConfig from '../odbvue.config'

const app = createApp(App)

const services = installApp(app, odbvueConfig, router)

router.onError((error, to) => {
  services.errors.capture(error, {
    source: 'router',
    context: { path: to.fullPath },
  })
  app.runWithContext(() => useUi().error(error))
})

void services.ready
  .then(async () => {
    await router.isReady()
    app.mount('#app')
  })
  .catch((error: unknown) => {
    console.error('Unable to start OdbVue', error)
    app.runWithContext(() => useUi().error(error))
  })
