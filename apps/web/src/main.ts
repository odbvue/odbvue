import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import { createHttpPlugin } from './plugins/http'
import piniaPersist from './plugins/pinia-persist'
import { createHead } from '@unhead/vue/client'
import { installOdbVueConfig } from '@odbvue/web'
import odbvueConfig from '../odbvue.config'

const app = createApp(App)

installOdbVueConfig(app, odbvueConfig)

const pinia = createPinia()
pinia.use(piniaPersist)
app.use(pinia)
app.use(createHttpPlugin())

app.use(router)
app.use(vuetify)
app.use(i18n)
app.use(createHead())

app.mount('#app')
