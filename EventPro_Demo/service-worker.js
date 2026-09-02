// Service worker - met en cache la coquille de l'application (app shell)
// pour un chargement rapide et une tolérance aux coupures réseau ponctuelles.
// Les données (Firestore) restent en ligne / temps réel et ne sont PAS mises en cache ici.

const CACHE_NOM = "vanba-commandes-v29";
const FICHIERS_A_METTRE_EN_CACHE = [
  "./index.html",
  "./manifest.json",
  "./css/style.css",
  "./js/config.js",
  "./js/sauvegarde.js",
  "./js/catalogue.js",
  "./js/data.js",
  "./js/etiquettes.js",
  "./js/ecran_etiquettes.js",
  "./js/ecran_nc.js",
  "./js/ecran_suivi_commandes.js",
  "./js/ecran_production.js",
  "./js/ecran_classeur.js",
  "./js/ecran_dashboard.js",
  "./js/ecran_admin.js",
  "./js/ecran_audit.js",
  "./js/app.js"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NOM).then(cache => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(noms =>
      Promise.all(noms.filter(n => n !== CACHE_NOM).map(n => caches.delete(n)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  event.respondWith(
    caches.match(event.request).then(reponseCache => {
      return reponseCache || fetch(event.request).then(reponseReseau => {
        if (event.request.method === "GET" && reponseReseau.ok) {
          const clone = reponseReseau.clone();
          caches.open(CACHE_NOM).then(cache => cache.put(event.request, clone));
        }
        return reponseReseau;
      }).catch(() => reponseCache);
    })
  );
});
