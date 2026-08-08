// Service Worker do V-Stats
// Estratégia: "stale-while-revalidate" só pra arquivos estáticos (o HTML e as libs de CDN).
// Dados do Supabase NUNCA são cacheados aqui — eles sempre precisam vir da rede, atualizados.

const CACHE_NAME = 'vstats-cache-v1';
const PRECACHE_URLS = ['./', './index.html'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .catch(() => {}) // se o precache falhar (ex: offline na primeira visita), não trava a instalação
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Nunca intercepta chamadas ao Supabase (auth, banco, storage) — sempre direto na rede
    if (url.hostname.includes('supabase.co')) return;
    // Só trata requisições GET; POST/PATCH/DELETE (ex: uploads) passam direto
    if (event.request.method !== 'GET') return;

    event.respondWith(
        caches.match(event.request).then((cached) => {
            const networkFetch = fetch(event.request)
                .then((response) => {
                    if (response && response.status === 200) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => cached); // offline: cai pro que já estava em cache, se houver

            // Responde rápido com o cache (se existir) e atualiza em segundo plano
            return cached || networkFetch;
        })
    );
});
