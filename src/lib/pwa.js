import { ref } from 'vue'

/** A downloaded release waiting for the user to apply it. */
export const pendingUpdate = ref(false)
export const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine !== false)
if (typeof window !== 'undefined') {
  addEventListener('online', () => (online.value = true))
  addEventListener('offline', () => (online.value = false))
}
let registration = null
let reloading = false

/**
 * Registers the workspace service worker (production only). Automated browsers skip it unless
 * `force` is set, so tests that stub network requests are not served from the cache.
 */
export async function registerWorkspaceServiceWorker({ url = './sw.js', force = false } = {}) {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return null
  const secure =
    location.protocol === 'https:' ||
    ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)
  if (!secure || (navigator.webdriver && !force)) return null
  registration = await navigator.serviceWorker.register(url, { scope: './' })
  const waiting = () => {
    if (registration.waiting && navigator.serviceWorker.controller) pendingUpdate.value = true
  }
  waiting()
  registration.addEventListener('updatefound', () => {
    const worker = registration.installing
    worker?.addEventListener('statechange', () => {
      if (worker.state === 'installed') waiting()
    })
  })
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload()
  })
  return registration
}

/** Activates the waiting release and reloads. Save documents before calling it. */
export function applyWorkspaceUpdate() {
  if (!registration?.waiting) return false
  reloading = true
  registration.waiting.postMessage('studio:skip-waiting')
  return true
}
