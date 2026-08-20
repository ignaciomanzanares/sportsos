import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import { resolve } from 'node:path'

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

/**
 * Rellena public/sw.js con la lista real de archivos del build y una versión.
 *
 * El service worker necesita saber qué precargar, y esos nombres llevan un
 * hash que recién existe cuando termina el build. La versión sale del nombre
 * del bundle principal: cambia sola en cada despliegue, que es lo que hace que
 * el navegador note el service worker nuevo y tire el caché viejo.
 */
function serviceWorker() {
  let shell = []
  return {
    name: 'sw-lista-de-archivos',
    apply: 'build',
    // Acá Vite entrega el mapa del build: qué trozo importa a cuál, y cuáles
    // se cargan bajo demanda. Se precarga el arranque y todo lo que este
    // necesita para poder ejecutarse — nada más. Los paneles por rol y el
    // importador de Excel se bajan cuando se abren; meterlos en el caché
    // costaría megas en el primer ingreso por pantallas que casi nadie abre.
    generateBundle(_opts, bundle) {
      const entrada = Object.values(bundle).find(c => c.type === 'chunk' && c.isEntry)
      if (!entrada) return
      const vistos = new Set()
      const recorrer = (nombre) => {
        if (!nombre || vistos.has(nombre)) return
        vistos.add(nombre)
        const c = bundle[nombre]
        if (!c || c.type !== 'chunk') return
        // Solo `imports`: son los estáticos, los que el navegador necesita sí o
        // sí para que el archivo corra. `dynamicImports` queda fuera adrede.
        for (const dep of c.imports || []) recorrer(dep)
        for (const css of c.viteMetadata?.importedCss || []) vistos.add(css)
      }
      recorrer(entrada.fileName)
      shell = ['/', '/index.html', '/manifest.webmanifest', '/icon-192.png', '/favicon.svg']
        .concat([...vistos].map(f => `/${f}`))
    },
    closeBundle() {
      const swPath = resolve('dist/sw.js')
      if (!fs.existsSync(swPath) || !shell.length) return
      const version = (shell.find(f => /\/assets\/index-.*\.js$/.test(f)) || 'dev')
        .replace(/.*index-|\.js$/g, '')
      fs.writeFileSync(swPath, fs.readFileSync(swPath, 'utf8')
        .replace('__SHELL__', JSON.stringify(shell))
        .replace('__VERSION__', version))
      console.log(`  service worker: ${shell.length} archivos precargados · versión ${version}`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), bitacora(), serviceWorker()],
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
