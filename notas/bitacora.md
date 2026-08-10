# Bitácora — sportsos

## 2026-06-18 — Membresías y super admin completados

### Supabase: RLS y tabla nueva
- Añadidas políticas RLS para que `admin@sportostest.com` (UUID `fe1c22a4-...`) pueda:
  - **SELECT y UPDATE en `clubs`** — leer y modificar todos los clubes
  - **SELECT y UPDATE en `profiles`** — leer y modificar perfiles de cualquier usuario
- Nuevas columnas en `clubs`: `plan_vence` (date), `plan_notas` (text), `suspended` (boolean), `plan_updated_at` (timestamptz)
- Nueva tabla `plan_history`: registra cada cambio de plan con plan anterior, plan nuevo, notas y quién lo cambió

### SuperAdminView — módulo Membresías
- Reescrito con editor inline por club: selector de plan (Free/Pro/Elite), fecha de vencimiento, notas internas
- Indicador visual de plan vencido (rojo) y por vencer (naranja)
- Botón Suspender / Reactivar usa campo `suspended` (booleano) en vez de cambiar el plan
- Historial de cambios visible por club (últimos 3) y listado completo colapsable
- KPIs: clubes activos, MRR total, cuenta Elite, cuenta suspendidos
- Doble escritura: actualiza `clubs.plan` y también `profiles.plan` de todos los usuarios del club

## IDEAS FUTURAS (pendientes de implementar)

### QR de asistencia
- Entrenador genera QR único del día → jugadores escanean con su celular → confirma presencia automática
- Vista entrenador: lista en tiempo real (Supabase Realtime)
- Vista jugador: pantalla "Confirmar presencia ✅" al abrir el link del QR
- Tabla Supabase: `asistencia` con jugador_id, club_id, fecha, metodo (qr/manual)
- Librería: qrcode.react
- URL del QR: sportsos-iota.vercel.app?asistencia=<club_id>&fecha=<hoy>


## 2026-06-14
- Creado `src/views/HomeView.jsx`: dashboard de inicio con métricas por rol
  - Admin: jugadores activos, cuotas (pagadas/pendientes/vencidas), próximo partido, barra de progreso
  - Entrenador: próximo partido hero, asistencia del día, victorias, últimos partidos
  - Preparador: estado del plantel wellness (lesionados/alertas/aptos), microciclo, ranking fuerza
  - Jugador: ¿Estoy convocado? hero (grande), cuota, wellness, ranking gym
  - SuperAdmin: clubes activos, comisiones, usuarios, retención
- HomeView conectado en App.jsx como módulo por defecto al entrar/cambiar de rol
- Todas las tarjetas clickeables navegan al módulo correspondiente (`onNavigate`)


## 2026-06-08
- Repo clonado y configurado con stack de IA (Cline + CLAUDE.md)
- .env protegido (sacado de git)

## 2026-06-10
- UX/UI completo — refactorización mayor
  - Proyecto dividido en src/components/, src/views/, src/data/, src/styles/
  - Aurora background animado con blobs de color
  - Glassmorphism en topbar, sidebar, cards y modales
  - Onboarding inmersivo con animaciones framer-motion
  - Design tokens en CSS custom properties (tokens.js + index.css)
  - framer-motion instalado para transiciones y micro-interacciones
  - Fuente Inter + meta tags en index.html
- Git push a GitHub (commit 9f43910)
- Deploy producción Vercel: https://sportsos-iota.vercel.app
- Proyecto 100% independiente — fuera de Lovable, en repo propio + Vercel

## 2026-06-10 (Supabase + datos reales)
- Supabase integrado como backend real
  - src/lib/supabase.js — cliente Supabase
  - src/lib/auth.js — signIn/signUp/signOut/getProfile
  - src/lib/useAuth.jsx — AuthProvider + useAuth hook
  - src/lib/db.js — funciones CRUD para todas las tablas
  - supabase/schema.sql — schema completo con RLS
- Hooks de datos creados:
  - src/lib/usePlayers.js — jugadores con fallback mock
  - src/lib/usePosts.js — El Muro con realtime Supabase
  - src/lib/useAttendance.js — asistencia con guardado en BD
- App.jsx actualizado: usa usePlayers() en lugar de PLAYERS_RUGBY hardcodeado
- Login tiene modo dual: Supabase real + fallback mock usuarios demo
- Variables de entorno configuradas en Vercel (no en git)

## 2026-08-08 (cuentas sin club + seguridad)
Causa raíz: Supabase tiene "Confirm email" activado, así que `signUp` devuelve
usuario pero **sin sesión**. Sin sesión no hay `auth.uid()`, y las funciones que
asignan club (`claim_new_club_admin`, `accept_invitation`) no asignaban nada.
Resultado: clubes huérfanos, perfiles con `club_id` nulo y ninguna invitación
funcionando en producción.

Cambios en el código:
- `src/views/SinClubScreen.jsx` (nuevo) — un usuario real sin club ya no ve la
  vitrina de demo (TOROS RC) creyendo que es suya; ve "Crear mi club" o
  "Unirme con un código".
- `src/views/ClubOnboarding.jsx` — primero la cuenta, después el club. Si no
  hay sesión, guarda la intención en `user_metadata.club_pendiente` y muestra
  "Confirma tu correo". Al volver logueado, retoma y crea el club.
- `src/lib/pendingInvitation.js` (nuevo) — canjea el token guardado en
  `user_metadata.invitacion_token` en el primer login con sesión real.
- `src/views/InvitationScreen.jsx` — el link ya no lleva `clubId`, `playerId`
  ni `rol` en la URL. Sin token no hay registro; el rol lo decide el servidor.
- `src/views/SuperAdminView.jsx` — sin ID de superadmin hardcodeado; los planes
  se cambian con `cambiar_plan()` / `suspender_club()` y los errores se muestran.

Cambios en la base de datos (aplicados en producción):
- Crear clubes dejó de estar abierto a `anon`: la policy ahora es
  `to authenticated`.
- Migración `002_proteger_rol_y_plan.sql` — se quitó el UPDATE sobre toda la
  tabla `profiles` y se dieron GRANT por columna (16 columnas inofensivas).
  Antes, cualquiera desde la consola del navegador podía hacer
  `update profiles set rol='admin', plan='elite'`.
- Se borró 1 club huérfano (RUGBY-TEST2).

Verificado: `update_tabla_entera = 0`, `update_por_columna = 16`,
`clubes_huerfanos = 0`, policy de clubs = `{authenticated}`.

## 2026-08-10 (infraestructura, invitaciones y lesiones)
- Se descubrió que producción es `sportos-v02.vercel.app` (no `sportsos-iota`,
  que apunta a un Supabase borrado y ya no lo usa nadie). El proyecto de Vercel
  no tiene Git conectado: cada deploy es manual con `npx vercel --prod`.
- Registro de club probado de punta a punta: funciona.
- Invitaciones: funcionan, pero aparecieron tres problemas y se arreglaron.
  1. Aceptar una invitación degradaba de rol a quien ya estaba en el club (un
     admin quedó como jugador de su propio club).
  2. El link genérico de "Jugador" no creaba la ficha en `players`, así que el
     invitado entraba al club pero el Plantel seguía en 0.
  3. El token se canjeaba dos veces (InvitationScreen y App.jsx a la vez) y el
     segundo mostraba "link inválido" aunque la asignación había funcionado.
- Nuevo módulo **Salud** para admin, con historial de lesiones
  (`injury_reports`): reportes por jugador y sesión, alerta cuando alguien
  acumula 2+ sesiones seguidas fuera de verde, y el semáforo de la ficha se
  sincroniza solo con el último reporte. La idea venía de la rama
  `demo/usuarios` (archivada en el tag `archivo/demo-usuarios`), donde estaba
  resuelta con datos falsos; acá quedó persistida y con RLS.
- Ramas: `version-0.2` renombrada a `callejas`; `demo/usuarios` borrada pero
  archivada en el tag `archivo/demo-usuarios` (tenía 13 commits propios).
