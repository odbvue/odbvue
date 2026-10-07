import { createApp } from 'vue'

import App from './app/App.vue'
import router from './app/router'
import { pinia } from '@/app/state'
import { i18n } from '@/app/i18n'
import { vuetify } from '@/app/ui'
import { captureError } from '@/app/errors'

const app = createApp(App)

app.config.errorHandler = (error, instance, info) => {
  captureError(error, { source: 'vue', context: { component: instance?.$options.name, info } })
}

app.use(pinia)
app.use(i18n)
app.use(vuetify)
app.use(router)

router.onError((error, to) => {
  captureError(error, {
    source: 'router',
    context: { path: to.fullPath },
  })
})

app.mount('#app')
