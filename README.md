# SportOS

Gestión de clubes deportivos: plantel, convocatorias, asistencia, cuotas,
estadísticas y salud, en una sola app que abre el jugador desde el celular y el
entrenador desde la cancha.

Está en producción con **Old Reds** (rugby, Chile): 142 fichas de jugador,
seis temporadas de estadísticas oficiales y cinco roles distintos usando la
misma pantalla.

---

## Índice

- [Qué hace](#qué-hace)
- [Cómo levantarlo](#cómo-levantarlo)
- [Cómo está armado](#cómo-está-armado)
- [Los datos del torneo (ARUSA)](#los-datos-del-torneo-arusa)
- [Base de datos](#base-de-datos)
- [Sin conexión](#sin-conexión)
- [Cómo entra la gente al club](#cómo-entra-la-gente-al-club)
- [Scripts de caps](#scripts-de-caps)
- [Deploy](#deploy)
- [Herramientas de desarrollo](#herramientas-de-desarrollo)
- [Cosas que conviene saber antes de tocar](#cosas-que-conviene-saber-antes-de-tocar)

---

## Qué hace

La app es la misma para todos, pero cada uno ve lo suyo. El rol define qué
módulos aparecen en el menú:

| Rol | Qué ve |
|---|---|
| **Jugador** | Su dashboard, sus estadísticas, su cuota, su plan de gimnasio, las nóminas del club y si está convocado |
| **Entrenador** | El muro, calendario, Match Center, armado de nóminas, estadísticas, asistencia y el panel de salud |
| **Preparador** | Microciclo, estado del plantel y ranking de fuerza |
| **Admin Club** | Todo lo del entrenador más jugadores, finanzas y la configuración del club |
| **Super Admin** | Los clubes de la plataforma, membresías y comisiones |

Un mismo usuario puede tener varios roles y cambiar entre ellos desde la barra
de arriba.

Además hay un **selector de categoría** (Adulta, M18, M16… hasta M6) que
filtra todo lo que se está viendo. El torneo oficial solo publica las tres
divisiones adultas: en las categorías menores la app lo dice en vez de mostrar
la tabla de adultos como si fuera la que se pidió.

### Módulos

- **El Muro** — publicaciones del club con likes y comentarios.
- **Calendario y Match Center** — el fixture se sincroniza solo desde el
  torneo; los resultados y las estadísticas del partido se ven ahí.
- **Nómina** — armado de la citación arrastrando jugadores sobre la cancha.
- **Asistencia** — grilla por fecha, marcar presentes de a uno o de a varios.
- **Estadísticas** — tabla de posiciones del torneo, caps de Primera, y
  rankings de tries, conversiones y penales.
- **Salud** — lesiones reportadas, semáforo por jugador y protocolo HIA.
- **Finanzas** — cuotas, movimientos, sueldos y gastos; cobro por Mercado Pago.
- **Gimnasio** — planes por jugador, registro de cargas e importación desde
  Excel.

---

## Cómo levantarlo

Hace falta Node 20 o más nuevo.

```bash
git clone https://github.com/ignaciomanzanares/sportsos.git
cd sportsos
npm install
cp .env.example .env      # y llenar los dos valores
npm run dev               # queda en http://localhost:5173
```

Las dos variables salen del proyecto de Supabase, en
**Settings → API**:

```
VITE_SUPABASE_URL=https://xxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

La `anon key` es pública por diseño — va en el navegador de todos los que usan
la app. Lo que protege los datos no es esconderla, es RLS (más abajo).
La `service_role`, en cambio, **nunca** va en `.env` ni en el repo: solo en las
variables de entorno de Vercel, y solo la usan las funciones de `/api`.

### Comandos

```bash
npm run dev        # desarrollo con recarga en caliente
npm run build      # build de producción a dist/
npm run preview    # servir dist/ para probar el build
npm run lint       # ESLint
```

---

## Cómo está armado

```
src/
  App.jsx           navegación, roles, módulos, estado compartido
  main.jsx          ErrorBoundary + LazyMotion + service worker
  views/            una pantalla por rol y por flujo de entrada
  components/       piezas reutilizables (cancha, tarjetas, tablas, modales)
  lib/              hooks de datos (use*.js) y utilidades
  data/             configuración de deportes + fotos de datos del torneo
  styles/           tokens de estilo y animaciones
api/                funciones serverless de Vercel
  leverade.js       datos del torneo, solo lectura
  cron/sync-arusa   sincroniza el fixture, una vez al día
  mercadopago-*     checkout y webhook de pagos
supabase/           el esquema y cada parche SQL que se corrió, en orden
scripts/            scraping de caps e informes (ver más abajo)
android/            envoltorio Capacitor (sin uso activo)
```

**Stack:** React 19 + Vite 8, Supabase (Postgres + Auth + RLS),
framer-motion, recharts, y Vercel para hosting y funciones.

Los paneles pesados por rol (`SuperAdminView`, `AdminView`, `EntrenadorView`,
`PreparadorView`) se cargan con `lazy()`. El jugador es la enorme mayoría del
club y el que peor señal tiene —parado en la cancha—; antes se descargaba los
tres paneles que no puede abrir para no ver ninguno.

---

## Los datos del torneo (ARUSA)

Las estadísticas oficiales salen de ARUSA / Leverade y entran por dos caminos.

**En vivo, por `/api/leverade`.** El navegador nunca habla con arusa.cl
directo: pasa por esta función, que lee de un caché. Si el caché está vacío
devuelve listas vacías y la vista dice que no hay datos, en vez de inventarlos.

**La foto guardada, en `src/data/plantelArusa.json`.** El caché en vivo pierde
a los jugadores que jugaron uno o dos partidos y no anotaron nunca — dejan de
venir en la respuesta. Un jugador que existe y no anota no es un jugador que no
existe, así que la foto completa los que faltan. Lo de arriba siempre manda.

### Dos reglas que parecen detalles y no lo son

**Las estadísticas se suman entre las tres divisiones adultas.** Un jugador
puede subir de Intermedia a Primera en la misma temporada y seguir anotando en
las dos; mostrar solo la fila de Primera le borra el resto del año. Se suma
todo lo que es un conteo de temporada: partidos, puntos, tries, conversiones,
penales, tarjetas.

**Los caps son la única excepción.** En rugby un *cap* es un partido del primer
equipo. Sumarle Intermedia y Pre-Intermedia infla el número y le quita
exactamente el sentido que tiene dentro del club, que es distinguir quién jugó
arriba. Por eso `capsPrimera` se calcula aparte y solo cuenta Primera.

Esto ya causó un bug real: el que más patea del club aparecía con **cero**
conversiones porque en Primera jugó de otra cosa y esa fila decía 0, mientras
sus 20 conversiones de Intermedia se descartaban. Quedaba con 59 puntos al
lado de 0 conversiones — los puntos se sumaban y las patadas que los
produjeron, no.

### El cruce con el plantel

Las estadísticas se pegan al jugador por `arusa_player_id`, una sola vez en
`App.jsx` y sobre la lista que reciben todas las vistas. Antes el cruce estaba
hecho en una sola pantalla y el resto leía otra cosa: dos números distintos
para el mismo jugador en dos pantallas es peor que no tener ninguno.

Lo que el club carga a mano manda; ARUSA solo rellena lo que falta. Y el
campo `arusaStats` deja ver de dónde salió cada número, para que la pantalla
pueda decir *"datos de ARUSA"* en vez de presentarlo como carga del club.

Vincular un jugador con su ficha del torneo se hace desde **Mi Club → Vincular
ARUSA**.

---

## Base de datos

Supabase (Postgres). Las tablas principales: `clubs`, `profiles`, `players`,
`teams`, `matches`, `lineups`, `attendance`, `payments`, `posts`,
`gym_plans`, `gym_logs`, `injury_reports`, `invitations`, `join_requests` y
las tres de finanzas.

`supabase/schema.sql` es el esquema base. Todo lo que se corrigió después está
en archivos aparte, cada uno con su nombre (`fix_*.sql`, `migrations/`), y se
corren pegándolos en el **SQL Editor** de Supabase. Están versionados a
propósito: es el registro de qué se le hizo a la base y en qué orden.

**Toda la seguridad es RLS.** Con la `anon key` sola no se lee nada — se puede
comprobar: una consulta directa a `players` sin sesión devuelve una lista
vacía, no un error. Los permisos por rol están en `fix_permisos_por_rol.sql`.

> ⚠️ **Postgres le da EXECUTE a PUBLIC por defecto.** Un `grant execute ... to
> authenticated` no restringe nada si antes no se hace
> `revoke ... from public`. Es la trampa más fácil de pisar acá.

### Respaldos

```bash
 DB_URL='postgresql://...' ./scripts/respaldo-supabase.sh
```

Saca el esquema `public` completo más las cuentas de `auth`. El espacio antes
del comando es a propósito: hace que bash no lo guarde en el historial.

Los dumps van a `~/respaldos-sportos` y **no al repo** — hay fechas de
nacimiento, teléfonos, contactos de emergencia y estado médico, de menores
incluidos.

---

## Sin conexión

`public/sw.js` es un service worker escrito a mano, sin Workbox ni nada
parecido: son cuarenta líneas y las librerías traen su propio build y sus
propias sorpresas al actualizar.

El caso real es concreto: el partido es en una cancha sin cobertura y el
entrenador necesita la nómina, o el jugador quiere ver a qué hora es la
citación.

Tres reglas según qué se pide:

1. **Archivos de la app** (JS, CSS) — llevan hash en el nombre y no cambian
   nunca: del caché, sin preguntar.
2. **El HTML** — siempre a la red primero. Es el único archivo con nombre fijo,
   así que es el que decide qué versión corre.
3. **Los datos** — a la red primero, y solo sin conexión se responde con la
   última copia. Nunca al revés: mostrar una cuota vieja como si fuera de ahora
   es peor que no mostrarla.

Y por eso mismo, cuando no hay señal la app **lo dice con un cartel**. Una app
que abre sin conexión y muestra la nómina de la semana pasada como si fuera la
de hoy es peor que una que no abre: el entrenador cita a alguien que ya no está
convocado y no tiene forma de saber que le mintieron.

La lista de archivos a precargar y la versión las calcula un plugin de Vite en
`vite.config.js`, leyendo el mapa real del build. No se escriben a mano.

Al cerrar sesión se borra la copia guardada: en un club el teléfono se presta.

Probarlo: `node scripts/probar-sin-conexion.mjs`.

---

## Cómo entra la gente al club

Hay tres caminos, de menos a más control:

**Código del club** (`supabase/unirme_con_codigo.sql`) — se manda un link al
grupo de WhatsApp y cada uno entra solo. Antes el admin tenía que aprobar cada
solicitud y mandar un link personal por WhatsApp: con 109 jugadores son 109
mensajes, y por eso el club tenía 142 fichas y casi ninguna cuenta.

Los límites son lo que hace que esto sea aceptable:

- Solo crea **jugadores**. Nunca admin, entrenador ni preparador. Un código
  filtrado no puede entregar el control del club.
- Exige sesión iniciada: sin `auth.uid()` no hace nada.
- No le saca el club a nadie que ya tenga uno.
- Engancha con la ficha existente **solo si hay una sola candidata por
  nombre**. Con dos Pérez no adivina: darle a alguien la ficha equivocada le
  entrega la asistencia y los tries de otro.

**Invitación dirigida** — el admin genera un link para una persona concreta.
Es el único camino para roles que no sean jugador.

**Solicitud de ingreso** — la persona pide entrar y el admin aprueba.

---

## Scripts de caps

Los caps del primer equipo no están en ninguna API: se arman partido por
partido desde arusa. `scripts/LEEME.md` tiene el detalle completo; el resumen:

```bash
node scripts/caps-partidos.mjs    # qué partidos jugó Titulares, por temporada
node scripts/caps-rivales.mjs     # el rival de cada partido
node scripts/caps-arusa.mjs       # nómina + sustituciones (~15 min)
node scripts/caps-consolidar.mjs  # arma src/data/capsHistoricos.json
```

`caps-arusa.mjs` guarda cada partido y salta los que ya tiene: se puede cortar
y retomar, y después de una fecha nueva baja solo lo que falta.

**Se navega con Playwright** porque arusa devuelve un *"Checking your browser"*
con código 429 a cualquier cliente que no ejecute JavaScript. No lo pasan ni
`curl` ni un proxy que reenvíe la petición tal cual.

**El número que muestra la app es un mínimo.** Las nóminas de arusa son
firmes, pero los ingresos desde la banca los anota a mano quien hace la
planilla y se le pasa cerca de un tercio. Por eso existe
`caps-correcciones.json`: ahí va lo que confirma el propio jugador, que es
quien sabe si entró, y manda sobre lo que dice arusa. Solo puede corregir a los
de banca — si estaba en la nómina de titulares, jugó.

Cobertura actual: **102 de 104 partidos desde 2021**, y 91 de ellos reconcilian
exacto contra el marcador real.

---

## Deploy

Producción: **https://sportos-app.vercel.app** — se despliega sola con cada
push a `main`.

Hosting en Vercel, con `vercel.json` declarando el cron diario que sincroniza
el fixture (10:00 UTC).

Variables de entorno que van en Vercel y no en el repo:

| Variable | Para qué |
|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | el cliente del navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | escrituras del cron, que no tiene sesión de usuario |
| `CRON_SECRET` | que solo Vercel pueda disparar el cron |
| `MP_ACCESS_TOKEN` | Mercado Pago |

También existe un envoltorio **Capacitor** en `android/` (`npx cap sync`
después de `npm run build`), sin uso activo hoy.

---

## Herramientas de desarrollo

**Bitácora de sesión.** En `npm run dev` se graban los clicks, los cambios de
pantalla, los errores de consola y las peticiones que fallan o van lentas, y
quedan en `bitacora-local.log`. Sirve para revisar después un recorrido
completo sin tener que reproducirlo.

Vive **solo en el servidor de desarrollo** (`apply: 'serve'` en el plugin,
`import.meta.env.DEV` en el cliente): no existe en el build, así que no hay
forma de que llegue a producción.

**ErrorBoundary.** Envuelve toda la app, por fuera del proveedor de sesión —
así un fallo al cargar la sesión igual muestra algo. Antes, un error de
renderizado dejaba `<div id="root">` vacío: pantalla negra, sin ningún camino
de vuelta. Ahora se ve el error y un botón para recargar.

---

## Cosas que conviene saber antes de tocar

**`npm run lint` es el único chequeo que atrapa las pantallas negras.**
`npm run build` compila igual con una variable que no existe; ESLint la caza
con `no-undef`. Dos veces se desplegó una pantalla en negro que el lint habría
frenado. **Correrlo antes de cada deploy.**

**`supabase-js` no lanza excepciones: devuelve `{ error }`.** Un
`await supabase.from(...).update(...)` suelto se ve exactamente igual si
guardó que si RLS lo bloqueó. Los hooks de datos revisan el error explícitamente
(ver `lanzarSiFalla` en `usePayments.js`); si escribís uno nuevo, hacé lo mismo.

**No definas componentes dentro del render.** React los trata como un tipo
nuevo en cada pasada y desmonta y vuelve a montar todo el subárbol.

**framer-motion entra por `LazyMotion`** con el alias `m`, no `motion`. Es lo
que evita cargar la librería entera para las animaciones que se usan.

**Los códigos de error de PostgREST dicen bastante:** `42501` es permiso
denegado (casi siempre RLS), `42703` columna que no existe, `PGRST202` función
que no existe, `23503` violación de clave foránea.

**Los campos calculados no son columnas.** El formulario de edición manda el
jugador entero de vuelta a Supabase, así que un campo derivado viaja como si
fuera columna y la escritura falla. Se declaran en `CAMPOS_DERIVADOS`
(`src/lib/statsArusa.js`) y `usePlayers` los saca antes de guardar.

**Nunca subir `.env` al repo. Nunca `git push --force`.**
