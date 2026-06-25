// Service worker minimal : juste ce qu'il faut pour que la PWA soit
// "installable" et se mette à jour automatiquement.
//
// Stratégie volontairement simple : on ne met PAS en cache les appels API
// (les données du stock doivent toujours être fraîches), seulement les
// fichiers de l'appli elle-même (HTML/JS/CSS/icônes).
//
// CACHE_VERSION : change ce numéro à chaque mise à jour notable de l'appli
// pour forcer le téléphone à retélécharger les nouveaux fichiers.
const CACHE_VERSION = "alimentation-v4";

const FICHIERS_A_METTRE_EN_CACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./css/base.css",
  "./css/composants.css",
  "./css/responsive.css",
  "./js/api.js",
  "./js/theme.js",
  "./js/modale.js",
  "./js/profils.js",
  "./js/produit.js",
  "./js/scanner.js",
  "./js/stock.js",
  "./js/consommation.js",
  "./js/historique.js",
  "./js/courses.js",
  "./js/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(FICHIERS_A_METTRE_EN_CACHE))
  );
  self.skipWaiting(); // active la nouvelle version dès qu'elle est prête
});

self.addEventListener("activate", (event) => {
  // Nettoie les anciennes versions du cache (celles qui ne correspondent
  // plus à CACHE_VERSION), ce qui garantit que les mises à jour arrivent bien.
  event.waitUntil(
    caches.keys().then((noms) =>
      Promise.all(
        noms
          .filter((nom) => nom !== CACHE_VERSION)
          .map((nom) => caches.delete(nom))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ne jamais mettre en cache les appels vers l'API (Tailscale) : on veut
  // toujours les données fraîches, pas une vieille copie locale.
  // On reconnaît ces appels parce qu'ils ne pointent pas vers le même
  // domaine que la PWA elle-même (l'API tourne sur ton PC via Tailscale).
  if (url.origin !== self.location.origin) {
    return; // laisse la requête passer normalement, sans interception
  }

  event.respondWith(
    caches.match(event.request).then((reponseEnCache) => {
      return reponseEnCache || fetch(event.request);
    })
  );
});
