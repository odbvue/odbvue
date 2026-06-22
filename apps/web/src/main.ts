import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import piniaPersist from './plugins/pinia-persist'
import { createHead } from '@unhead/vue/client'

const app = createApp(App)

const pinia = createPinia()
pinia.use(piniaPersist)
app.use(pinia)

app.use(router)
app.use(vuetify)
app.use(i18n)
app.use(createHead())

app.mount('#app')
