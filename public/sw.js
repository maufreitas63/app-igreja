/* Service worker mínimo para habilitar instalação do PWA no Chrome/Android. */
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', () => {
  // Estratégia network-first implícita: o navegador busca na rede normalmente.
});
