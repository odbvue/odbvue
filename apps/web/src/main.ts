import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { installOdbVue } from '@odbvue/web'
import '@odbvue/web/components.css'
import odbvueConfig from '../odbvue.config'

const app = createApp(App)

installOdbVue(app, odbvueConfig, router)

app.mount('#app')
