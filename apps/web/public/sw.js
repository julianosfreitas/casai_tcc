// Service worker do CASAI — PWA instalável + offline básico do app shell.
//
// IMPORTANTE: navegações (HTML) usam NETWORK-FIRST. O cache-first antigo servia
// o HTML velho após um redeploy (Vercel), e esse HTML aponta para chunks
// /_next/static/* com hash antigo que não existem mais → 404 → "Application
// error: a client-side exception". Network-first garante shell fresco apontando
// para os chunks atuais; o cache é só fallback offline.
//
// Bump de CACHE (v2) faz o 'activate' purgar o shell velho (v1) e recupera quem
// já estava quebrado no próximo reload.
const CACHE = 'casai-shell-v2';
const SHELL = ['/', '/dashboard', '/login', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // API/WebSocket: sempre rede, nunca cache (controle local em tempo real).
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/socket.io')) return;

  // Navegações (documento HTML): NETWORK-FIRST. Atualiza o cache em background
  // e cai pro shell cacheado só quando offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match('/'))),
    );
    return;
  }

  // Estáticos com hash imutável (/_next/static, ícones): cache-first é seguro
  // (a URL muda quando o conteúdo muda).
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
