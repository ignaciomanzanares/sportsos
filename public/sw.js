/* eslint-env serviceworker */
/**
 * Service worker de SportOS — que la app abra sin señal.
 *
 * El caso real: el partido es en una cancha sin cobertura y el entrenador
 * necesita la nómina, o el jugador quiere ver a qué hora es la citación. Hasta
 * ahora, sin señal la app no abría: pantalla del navegador diciendo que no hay
 * internet.
 *
 * Escrito a mano y sin librerías a propósito. Las que generan esto solo
 * (Workbox y compañía) traen su propio build, sus propias sorpresas al
 * actualizar, y para lo que hace falta acá son cuarenta líneas.
 *
 * Tres reglas distintas según qué se pide:
 *
 *  1. Los archivos de la app (JS, CSS) llevan un hash en el nombre y no
 *     cambian nunca: se sirven del caché sin preguntar. Si el contenido
 *     cambia, cambia el nombre.
 *  2. El HTML se pide siempre a la red primero. Es el único archivo con nombre
 *     fijo, así que es el que decide qué versión corre: servirlo del caché
 *     dejaría a la gente con una versión vieja pegada aunque haya señal.
 *  3. Los datos (Supabase) también van a la red primero, y solo si no hay
 *     conexión se responde con la última copia. Nunca al revés: mostrar una
 *     cuota vieja como si fuera de ahora es peor que no mostrarla.
 *
 *  4. Todas las búsquedas en el caché van con `ignoreVary`. Los archivos se
 *     guardan con una petición hecha desde acá, sin cabecera Origin, pero el
 *     navegador pide los módulos con ella; y como el servidor responde
 *     "Vary: Origin", para el caché eran dos peticiones distintas y no
 *     encontraba nada. Es la razón por la que la primera versión de esto
 *     abría el HTML sin conexión y después se quedaba en blanco.
 *
 * Lo que NUNCA se toca: nada que no sea GET. Un pago, una asistencia o una
 * confirmación tienen que llegar al servidor o fallar a la vista — jamás
 * quedar guardados acá dando la impresión de que se guardaron.
 */

const VERSION = "__VERSION__";
const CACHE_APP    = `sportos-app-${VERSION}`;
const CACHE_DATOS  = "sportos-datos-v1";
const SHELL        = __SHELL__;

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE_APP)
      .then(c => c.addAll(SHELL))
      // Si un archivo del shell no está, no se cae la instalación entera: es
      // preferible un caché incompleto a quedarse sin service worker.
      .catch(() => {})
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(
        ks.filter(k => k.startsWith("sportos-app-") && k !== CACHE_APP)
          .map(k => caches.delete(k)),
      ))
      .then(() => self.clients.claim()),
  );
});

const esSupabase = (url) => /\.supabase\.co\/rest\/v1\//.test(url);
const esFuente   = (url) => /fonts\.(googleapis|gstatic)\.com/.test(url);

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;                  // ver la nota de arriba
  const url = req.url;

  // El HTML: red primero, caché como red de emergencia.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copia = r.clone();
          caches.open(CACHE_APP).then(c => c.put("/index.html", copia));
          return r;
        })
        .catch(() => caches.match("/index.html", { ignoreVary: true })),
    );
    return;
  }

  // Archivos con hash en el nombre: del caché, y si no está se busca y guarda.
  if (url.includes("/assets/") && url.startsWith(self.location.origin)) {
    e.respondWith(
      caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE_APP).then(c => c.put(req, copia));
        return r;
      })),
    );
    return;
  }

  // Tipografías: iguales para siempre, del caché si están.
  if (esFuente(url)) {
    e.respondWith(
      caches.match(req, { ignoreVary: true }).then(hit => hit || fetch(req).then(r => {
        const copia = r.clone();
        caches.open(CACHE_APP).then(c => c.put(req, copia));
        return r;
      }).catch(() => hit)),
    );
    return;
  }

  // Datos: red primero. La copia solo aparece si de verdad no hay conexión.
  if (esSupabase(url)) {
    e.respondWith(
      fetch(req)
        .then(r => {
          if (r.ok) {
            const copia = r.clone();
            caches.open(CACHE_DATOS).then(c => c.put(req, copia));
          }
          return r;
        })
        .catch(() => caches.match(req, { ignoreVary: true }).then(hit => hit || Promise.reject(new Error("sin conexión")))),
    );
  }
});
