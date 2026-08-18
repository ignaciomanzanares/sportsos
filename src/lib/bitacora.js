/**
 * Grabador de sesión — SOLO en desarrollo.
 *
 * Anota en un archivo lo que va pasando en el navegador (clicks, cambios de
 * pantalla, errores de consola, peticiones que fallan) para poder revisar
 * después un recorrido completo. Existe porque describir un problema por
 * escrito pierde justo lo que importa: el error que apareció medio segundo
 * y se fue, la petición que devolvió 403 sin que la pantalla dijera nada.
 *
 * Nunca corre en producción: `import.meta.env.DEV` lo deja fuera del bundle
 * compilado, y el endpoint que recibe los eventos solo existe en el servidor
 * de desarrollo de Vite.
 */

const COLA = [];
let programado = null;

function enviar() {
  programado = null;
  if (!COLA.length) return;
  const lote = COLA.splice(0, COLA.length);
  // keepalive para que el último lote salga aunque se esté cerrando la pestaña.
  fetch("/__bitacora", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(lote),
    keepalive: true,
  }).catch(() => { /* si el servidor no está, no pasa nada */ });
}

function anotar(tipo, detalle) {
  COLA.push({ t: Date.now(), tipo, detalle });
  // Se agrupa: un recorrido normal genera decenas de eventos por segundo y no
  // tiene sentido una petición por cada uno.
  if (!programado) programado = setTimeout(enviar, 400);
}

/** Cómo nombrar el elemento que se clickeó, en lenguaje humano. */
function describir(el) {
  if (!el) return "?";
  const boton = el.closest("button, a, [role=button], select, input, textarea");
  if (!boton) return `<${el.tagName.toLowerCase()}>`;
  const etiqueta = (boton.getAttribute("aria-label") || boton.getAttribute("title") ||
                    boton.textContent || boton.value || "").replace(/\s+/g, " ").trim();
  const tag = boton.tagName.toLowerCase();
  return etiqueta ? `${tag} "${etiqueta.slice(0, 60)}"` : `<${tag}>`;
}

export function iniciarBitacora() {
  if (!import.meta.env.DEV) return;
  if (window.__bitacoraViva) return;   // el StrictMode monta dos veces
  window.__bitacoraViva = true;

  anotar("inicio", `${navigator.userAgent.slice(0, 80)} · ${innerWidth}x${innerHeight}`);
  anotar("ruta", location.hash || "(sin hash)");

  document.addEventListener("click", (e) => anotar("click", describir(e.target)), true);

  let hashPrevio = location.hash;
  setInterval(() => {
    if (location.hash === hashPrevio) return;
    hashPrevio = location.hash;
    anotar("ruta", location.hash);
  }, 300);

  // Errores que no se ven en pantalla
  window.addEventListener("error", (e) =>
    anotar("ERROR", `${e.message} @ ${e.filename?.split("/").pop()}:${e.lineno}`));
  window.addEventListener("unhandledrejection", (e) =>
    anotar("ERROR", `promesa sin atrapar: ${e.reason?.message || e.reason}`));

  const errorOriginal = console.error;
  console.error = (...args) => {
    anotar("consola", args.map(a => String(a?.message || a)).join(" ").slice(0, 300));
    errorOriginal.apply(console, args);
  };

  // Peticiones: interesa lo que falla y lo que tarda
  const fetchOriginal = window.fetch;
  window.fetch = async (...args) => {
    const url = String(args[0]?.url || args[0]);
    const metodo = args[1]?.method || args[0]?.method || "GET";
    const t0 = performance.now();
    try {
      const r = await fetchOriginal(...args);
      const ms = Math.round(performance.now() - t0);
      const corta = url.replace(/^https?:\/\/[^/]+/, "").slice(0, 110);
      if (!r.ok) {
        // El cuerpo trae el código de Postgres (42501 = RLS, 23505 = duplicado),
        // que es lo que de verdad explica el fallo.
        let motivo = "";
        try { motivo = (await r.clone().text()).slice(0, 200); } catch { /* sin cuerpo */ }
        anotar("RED", `${metodo} ${corta} → ${r.status} (${ms}ms) ${motivo}`);
      } else if (ms > 1500) {
        anotar("lento", `${metodo} ${corta} → ${ms}ms`);
      }
      return r;
    } catch (err) {
      anotar("RED", `${metodo} ${url.slice(0, 110)} → falló: ${err.message}`);
      throw err;
    }
  };

  addEventListener("pagehide", enviar);
}
