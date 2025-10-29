import './themes/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'

import App from './App.vue'
import router from './router'
import vuetify from './plugins/vuetify'
import i18n from './plugins/i18n'
import { createPiniaPluginStorage } from '@erlihs/pinia-plugin-storage'
import { createHead } from '@unhead/vue/client'

const app = createApp(App)

app.use(createPinia().use(createPiniaPluginStorage()))
app.use(router)
app.use(vuetify)
app.use(i18n)
app.use(createHead())

app.mount('#app')
