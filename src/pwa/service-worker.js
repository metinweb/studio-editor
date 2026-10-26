// Studio workspace service worker. The build replaces the two placeholders below.
// Same-origin only: remote media and APIs are never cached or intercepted.
const VERSION = '__STUDIO_SW_VERSION__'
const { precache, lazy } = __STUDIO_SW_FILES__
const SHELL = `studio-shell-${VERSION}`
const RUNTIME = 'studio-runtime'
const scope = new URL(self.registration.scope)
const absolute = (file) => new URL(file, scope).href
const shellFiles = precache.map(absolute)
const knownFiles = new Set([...shellFiles, ...lazy.map(absolute)])

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL).then((cache) => cache.addAll(shellFiles)))
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const name of await caches.keys())
        if (name.startsWith('studio-shell-') && name !== SHELL) await caches.delete(name)
      // Hashed lazy chunks of older releases are no longer referenced.
      const runtime = await caches.open(RUNTIME)
      for (const request of await runtime.keys())
        if (!knownFiles.has(request.url)) await runtime.delete(request)
    })(),
  )
  // Then fetch the large optional chunks in the background so every feature works offline,
  // unless the browser asks to save data.
  if (!self.navigator.connection?.saveData) event.waitUntil(warmLazyFiles())
})
async function warmLazyFiles() {
  const runtime = await caches.open(RUNTIME)
  for (const file of lazy.map(absolute)) {
    if (await runtime.match(file)) continue
    try {
      const response = await fetch(file, { priority: 'low' })
      if (response.ok) await runtime.put(file, response)
    } catch {
      return
    }
  }
}
self.addEventListener('message', (event) => {
  if (event.data === 'studio:skip-waiting') self.skipWaiting()
})

async function navigation(request) {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    const response = await fetch(request, { signal: controller.signal })
    clearTimeout(timer)
    return response
  } catch {
    const cache = await caches.open(SHELL)
    return (await cache.match(absolute('index.html'), { ignoreVary: true })) || Response.error()
  }
}
async function asset(request) {
  // Hashed files are immutable; module requests carry Origin while warmed copies do not.
  const cached = await caches.match(request, { ignoreSearch: true, ignoreVary: true })
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok && knownFiles.has(new URL(request.url).href.split('?')[0])) {
    const cache = await caches.open(RUNTIME)
    await cache.put(request, response.clone())
  }
  return response
}
self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== scope.origin || !url.href.startsWith(scope.href)) return
  if (request.mode === 'navigate') event.respondWith(navigation(request))
  else if (knownFiles.has(url.href.split('?')[0])) event.respondWith(asset(request))
})
