import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'

const ARCHIVO = 'bitacora-local.log'

/**
 * Recibe los eventos del grabador de sesión (src/lib/bitacora.js) y los
 * escribe en bitacora-local.log, para poder revisar después un recorrido
 * completo: qué se clickeó, qué pantalla se abrió, qué petición falló.
 *
 * Vive solo en el servidor de desarrollo — no existe en el build, así que
 * no hay forma de que este endpoint llegue a producción.
 */
function bitacora() {
  const ETIQUETAS = { ERROR: '⚠️ ERROR', RED: '⚠️ RED  ', consola: '⚠️ CONS ', lento: '🐢 LENTO',
                      click: 'click ', ruta: 'ruta  ', inicio: 'INICIO' }
  return {
    name: 'bitacora-local',
    apply: 'serve',
    configureServer(server) {
      fs.writeFileSync(ARCHIVO, `── sesión abierta ${new Date().toLocaleString('es-CL')} ──\n`)
      server.middlewares.use('/__bitacora', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 405; return res.end() }
        let cuerpo = ''
        req.on('data', c => { cuerpo += c })
        req.on('end', () => {
          try {
            const lineas = JSON.parse(cuerpo).map(e => {
              const hora = new Date(e.t).toLocaleTimeString('es-CL', { hour12: false })
              return `[${hora}] ${ETIQUETAS[e.tipo] || e.tipo} → ${e.detalle}`
            })
            fs.appendFileSync(ARCHIVO, lineas.join('\n') + '\n')
          } catch { /* un lote malformado no debe tumbar el dev server */ }
          res.statusCode = 204
          res.end()
        })
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), bitacora()],
  server: {
    // En local no corren las funciones de /api: el dev server respondía el
    // HTML de la app y el fetch reventaba con "no es JSON válido", que parecía
    // un bug de la app y no lo era. Se redirigen a producción, que es de solo
    // lectura y datos públicos del torneo.
    proxy: {
      '/api': {
        target: 'https://sportos-v02.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
