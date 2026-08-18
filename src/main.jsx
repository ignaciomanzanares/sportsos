import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './lib/useAuth.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { iniciarBitacora } from './lib/bitacora.js'

// Grabador de sesión: solo en desarrollo, se compila fuera del bundle final.
iniciarBitacora()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Por fuera del AuthProvider a propósito: si lo que revienta es la
        sesión, la pantalla de error tiene que seguir apareciendo igual. */}
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
