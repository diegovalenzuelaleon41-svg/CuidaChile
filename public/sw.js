/*
 * Service worker de CuidaChile: la app abre aunque la señal sea mala.
 * · Páginas: primero la red; sin red, la última versión guardada.
 * · /assets (archivos con hash, no cambian): primero la caché.
 * · Nada de otros dominios (Supabase, mapas, rutas): siempre a la red, nunca se guarda.
 */
const CACHE = 'cuidachile-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copia = res.clone()
          caches.open(CACHE).then((c) => c.put('/index.html', copia))
          return res
        })
        .catch(() => caches.match('/index.html')),
    )
    return
  }

  if (url.pathname.startsWith('/assets/') || /\.(png|svg|webmanifest)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (guardada) =>
          guardada ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copia = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copia))
            }
            return res
          }),
      ),
    )
  }
})
