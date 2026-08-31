import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Sacar un campo con destructuring es la forma normal de descartarlo:
      // `const { gym, ...rest } = jugador` deja gym fuera de rest a propósito.
      // Sin ignoreRestSiblings, eso se marcaba como variable sin usar, y el
      // "arreglo" obvio —borrar gym de la lista— le devuelve el campo a rest
      // y cambia lo que hace el código. Un aviso que empuja a romper cosas es
      // peor que no tenerlo.
      'no-unused-vars': ['error', { ignoreRestSiblings: true, argsIgnorePattern: '^_' }],
    },
  },
  // api/ y scripts/ corren en Node, no en el navegador. Sin esto, `process`
  // era "no está definido" doce veces — todas falsas, y todas ocupando el
  // lugar de un no-undef de verdad, que es el único aviso que ataja una
  // pantalla en negro antes del despliegue. Un chequeo que grita por cosas
  // sanas se termina ignorando entero.
  {
    files: ['api/**/*.js', 'scripts/**/*.mjs', 'scripts/**/*.js', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } },
    rules: {
      // Ninguno de estos archivos es un componente de React.
      'react-refresh/only-export-components': 'off',
    },
  },
  // El service worker no tiene window ni document: vive en su propio mundo,
  // con self, caches y clients.
  {
    files: ['public/sw.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
])
