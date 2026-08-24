import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { createHead } from '@unhead/vue/client'
import { installOdbVueConfig } from '@odbvue/web'
import odbvueConfig from '../odbvue.config'

const app = createApp(App)

installOdbVueConfig(app, odbvueConfig)

app.use(router)
app.use(createHead())

app.mount('#app')
