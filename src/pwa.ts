import { registerSW } from 'virtual:pwa-register'

// Side-effect import: registers a service worker to enable installation and offline caching.
registerSW({
  immediate: true,
})
