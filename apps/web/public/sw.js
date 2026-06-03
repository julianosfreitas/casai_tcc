// Service worker mínimo do CASAI — habilita instalação como PWA e um cache
// básico do app shell. Dados da API NUNCA são cacheados (controle local em tempo real).
const CACHE = 'casai-shell-v1';
const SHELL = ['/', '/dashboard', '/login', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  // Não cacheia chamadas de API/WebSocket — sempre rede.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request)),
  );
});
