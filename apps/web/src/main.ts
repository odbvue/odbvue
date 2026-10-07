import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { errorsContract, installOdbVue, useUi } from '@odbvue/web'
import '@odbvue/web/components.css'
import odbvueConfig from '../odbvue.config'

const app = createApp(App)

const runtime = installOdbVue(app, odbvueConfig, router)

router.onError((error, to) => {
  runtime.get(errorsContract).capture(error, {
    source: 'router',
    context: { path: to.fullPath },
  })
  app.runWithContext(() => useUi().error(error))
})

void runtime.ready
  .then(async () => {
    await router.isReady()
    app.mount('#app')
  })
  .catch((error: unknown) => {
    console.error('Unable to start OdbVue', error)
    app.runWithContext(() => useUi().error(error))
  })
