import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { errorsContract, installOdbVue } from '@odbvue/web'
import '@odbvue/web/components.css'
import odbvueConfig from '../odbvue.config'
import { useAppStore } from './stores'

const app = createApp(App)

const runtime = installOdbVue(app, odbvueConfig, router)

router.onError((error, to) => {
  runtime.get(errorsContract).capture(error, {
    source: 'router',
    context: { path: to.fullPath },
  })
  app.runWithContext(() => useAppStore().ui.error(error))
})

app.mount('#app')
