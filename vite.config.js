import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
