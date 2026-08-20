/**
 * Registro del service worker y aviso de "estás sin conexión".
 *
 * Lo segundo importa tanto como lo primero. Una app que abre sin señal y
 * muestra la nómina de la semana pasada como si fuera la de hoy es peor que
 * una que no abre: el entrenador cita a alguien que ya no está convocado y no
 * tiene forma de saber que le mintieron. El cartel es la mitad de esta función.
 */

/** Registra el service worker. Silencioso: si falla, la app anda igual. */
export function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;   // en desarrollo estorba: sirve archivos viejos
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(err => {
      console.warn("[sw] no se pudo registrar:", err?.message);
    });
  });
}

/**
 * Avisa cuando se cae y cuando vuelve la conexión.
 * Devuelve una función para dejar de escuchar.
 */
export function vigilarConexion(alCambiar) {
  const emitir = () => alCambiar(navigator.onLine);
  window.addEventListener("online", emitir);
  window.addEventListener("offline", emitir);
  emitir();
  return () => {
    window.removeEventListener("online", emitir);
    window.removeEventListener("offline", emitir);
  };
}

/**
 * Borra la copia de datos guardada para uso sin conexión.
 *
 * Se llama al cerrar sesión. En un club el teléfono se presta —el ayudante
 * mira la nómina en el celular del entrenador— y sin esto el siguiente en
 * entrar podía ver, sin conexión, las cuotas y los datos médicos del anterior
 * servidos desde el caché.
 */
export async function olvidarDatosGuardados() {
  if (!("caches" in window)) return;
  try {
    await caches.delete("sportos-datos-v1");
  } catch { /* si no se puede, no hay nada mejor que hacer acá */ }
}
