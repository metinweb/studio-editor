import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { registerWorkspaceServiceWorker } from './lib/pwa.js'
import './style.css'

createApp(App).use(createPinia()).mount('#app')
if (import.meta.env.PROD)
  registerWorkspaceServiceWorker({
    force: new URLSearchParams(location.search).has('pwa'),
  }).catch(() => {
    /* The workspace still works online without offline support. */
  })
