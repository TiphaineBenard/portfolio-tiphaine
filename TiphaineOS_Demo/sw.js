/* ═══════════════════════════════════════════════════════════
   SERVICE WORKER — minimal, uniquement pour rendre l'appli
   installable (icône sur l'écran d'accueil, plein écran sans barre
   de navigateur). Volontairement SANS mise en cache de l'app shell :
   chaque fichier JS/CSS est déjà "cache-busté" via `?v=N` dans
   index.html (voir CLAUDE.md, règle du projet), et un vrai cache de
   service worker par-dessus créerait un 2e système de versions à
   synchroniser avec le premier — source classique de bugs "je vois
   encore l'ancienne version après un hard reload" (06/09/2026).
   Si un vrai mode hors-ligne est demandé un jour, ajouter un cache
   ici en le vidant sur chaque `activate` (`caches.delete`) pour ne
   jamais servir un fichier périmé.
═══════════════════════════════════════════════════════════ */

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Simple passthrough réseau — nécessaire pour que Chrome/Android
// considère l'appli comme installable, mais ne cache jamais rien.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
