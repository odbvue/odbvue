import { createApp } from 'vue'

import App from './App.vue'
import router from './router'
import { installOdbVueConfig } from '@odbvue/web'
import '@odbvue/web/components.css'
import odbvueConfig from '../odbvue.config'

const app = createApp(App)

installOdbVueConfig(app, odbvueConfig, router)

app.mount('#app')
