import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LazyMotion, domAnimation } from 'framer-motion'
import { registrarServiceWorker } from './lib/sinConexion.js'
import { iniciarBitacora } from './lib/bitacora.js'

// Grabador de sesión: solo en desarrollo, se compila fuera del bundle final.
iniciarBitacora()

// Para que la app abra en la cancha sin señal. Solo en producción.
registrarServiceWorker()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Lo primero de todo: si algo revienta al arrancar —incluida la
        sesión— la pantalla de error tiene que aparecer igual. Antes, un
        error de render dejaba <div id="root"> vacío y no había salida. */}
    <ErrorBoundary>
      {/* framer-motion completo pesaba 99 kB comprimidos y lo cargaba todo el
          mundo en el arranque. `m` es el mismo componente sin las funciones
          que no usamos —arrastre y animaciones de layout, que no aparecen en
          ninguna pantalla—, y domAnimation trae solo lo que sí: initial,
          animate, exit, whileHover, whileTap. Los 746 usos de `motion.` no
          cambian: cada archivo importa `m` con ese alias. */}
      {/* Acá envolvía además un <AuthProvider> que no leía nadie: ningún
          componente llamaba a useAuth(), y mientras tanto montaba un segundo
          escuchador de sesión y volvía a pedir el perfil en cada cambio de
          login. App.jsx maneja la sesión por su cuenta desde siempre. */}
      <LazyMotion features={domAnimation} strict>
        <App />
      </LazyMotion>
    </ErrorBoundary>
  </StrictMode>,
)
