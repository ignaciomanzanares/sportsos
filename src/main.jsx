import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/useAuth.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { LazyMotion, domAnimation } from 'framer-motion'
import { iniciarBitacora } from './lib/bitacora.js'

// Grabador de sesión: solo en desarrollo, se compila fuera del bundle final.
iniciarBitacora()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Por fuera del AuthProvider a propósito: si lo que revienta es la
        sesión, la pantalla de error tiene que seguir apareciendo igual. */}
    <ErrorBoundary>
      {/* framer-motion completo pesaba 99 kB comprimidos y lo cargaba todo el
          mundo en el arranque. `m` es el mismo componente sin las funciones
          que no usamos —arrastre y animaciones de layout, que no aparecen en
          ninguna pantalla—, y domAnimation trae solo lo que sí: initial,
          animate, exit, whileHover, whileTap. Los 746 usos de `motion.` no
          cambian: cada archivo importa `m` con ese alias. */}
      <LazyMotion features={domAnimation} strict>
        <AuthProvider>
          <App />
        </AuthProvider>
      </LazyMotion>
    </ErrorBoundary>
  </StrictMode>,
)
