import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { SPORTS_CONFIG, COUNTRIES, CLUBS, partidoEsDeCategoria, categoriaDePartido } from "./data/sports";
import { MOCK_PAYMENTS, MOCK_PARTIDOS } from "./data/mockData";
import { usePlayers } from "./lib/usePlayers";
import { useArusaJugadores } from "./lib/useArusaTorneo";
import { enriquecerConArusa } from "./lib/statsArusa";
import { useClub } from "./lib/useClub";
import { usePayments } from "./lib/usePayments";
import { useMatches } from "./lib/useMatches";
import { supabase } from "./lib/supabase";

import { fadeUp } from "./styles/motion";
import { ss } from "./styles/tokens";

import AuroraBg from "./components/AuroraBg";
import Toast from "./components/Toast";
import WhatsAppModal from "./components/WhatsAppModal";
import GlobalSearch from "./components/GlobalSearch";
import OnboardingTip from "./components/OnboardingTip";
import UpgradeModal from "./components/UpgradeModal";
import { canAccess, requiredPlan, DEMO_PLAN, PLANS } from "./lib/freemium";

import OnboardingScreen from "./views/OnboardingScreen";
import InvitationScreen from "./views/InvitationScreen";
import LoginScreen from "./views/LoginScreen";
import LandingPage from "./views/LandingPage";
import ClubOnboarding from "./views/ClubOnboarding";
import JoinRequestScreen from "./views/JoinRequestScreen";
import SuperAdminView from "./views/SuperAdminView";
import AdminView from "./views/AdminView";
import EntrenadorView from "./views/EntrenadorView";
import PreparadorView from "./views/PreparadorView";
import JugadorView from "./views/JugadorView";
import HomeView from "./views/HomeView";
import PerfilView from "./views/PerfilView";
import NewPasswordScreen from "./views/NewPasswordScreen";
import SinClubScreen from "./views/SinClubScreen";
import { redeemPendingInvitation } from "./lib/pendingInvitation";

const ROLES = [
  {id:"superadmin",label:"Super Admin",icon:"⚡"},
  {id:"admin",label:"Admin Club",icon:"🏢"},
  {id:"entrenador",label:"Entrenador",icon:"📋"},
  {id:"preparador",label:"Preparador",icon:"💪"},
  {id:"jugador",label:"Jugador",icon:"👤"},
];

const MODULE_MAP = {
  superadmin:[{id:"home",label:"Inicio",icon:"🏠"},{id:"dashboard",label:"Dashboard Global",icon:"📊"},{id:"clubes",label:"Clubes",icon:"🏢"},{id:"membresias",label:"Membresías",icon:"💳"},{id:"comisiones",label:"Comisiones",icon:"💰"},{id:"comparativa",label:"vs SportEasy",icon:"📈"},{id:"vistaroles",label:"Vista Roles",icon:"👁️"}],
  // El admin tenía inicio, club, jugadores, salud y finanzas — pero su propia
  // portada le ofrecía "ver todos" los partidos, el KPI de partidos ganados y
  // el de tries, todos apuntando a módulos que su rol no tenía: la pantalla
  // quedaba en negro. Calendario, Match Center y Estadísticas son los mismos
  // del entrenador; quien administra el club también los mira.
  admin:[{id:"home",label:"Inicio",icon:"🏠"},{id:"miclub",label:"Mi Club",icon:"🏢"},{id:"jugadores",label:"Jugadores",icon:"👥"},{id:"calendario",label:"Calendario",icon:"📅"},{id:"matchcenter",label:"Match Center",icon:"🏆"},{id:"estadisticas",label:"Estadísticas",icon:"📊"},{id:"salud",label:"Salud",icon:"🩺"},{id:"finanzas",label:"Finanzas",icon:"💰"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
  entrenador:[{id:"home",label:"Inicio",icon:"🏠"},{id:"muro",label:"El Muro",icon:"💬"},{id:"calendario",label:"Calendario",icon:"📅"},{id:"matchcenter",label:"Match Center",icon:"🏆"},{id:"nomina",label:"Nómina",icon:"📋"},{id:"estadisticas",label:"Estadísticas",icon:"📊"},{id:"asistencia",label:"Asistencia",icon:"✅"},{id:"salud",label:"Salud",icon:"🩺"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
  preparador:[{id:"home",label:"Inicio",icon:"🏠"},{id:"microciclo",label:"Microciclo",icon:"📅"},{id:"estadoplantel",label:"Estado Plantel",icon:"💪"},{id:"rankingfuerza",label:"Ranking Fuerza",icon:"🏋️"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
  jugador:[{id:"home",label:"Inicio",icon:"🏠"},{id:"midashboard",label:"Mi Dashboard",icon:"📊"},{id:"noticias",label:"Noticias",icon:"📰"},{id:"micuota",label:"Mi Cuota",icon:"💳"},{id:"migym",label:"Mi Gym",icon:"🏋️"},{id:"nominasclub",label:"Nóminas Club",icon:"📋"},{id:"miconvocatoria",label:"Mi Convocatoria",icon:"🎽"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
};

const ROL_ICONS = {superadmin:"⚡",admin:"🏢",entrenador:"📋",preparador:"💪",jugador:"👤"};

// Módulos que el admin comparte con el entrenador: los renderiza EntrenadorView.
const MODULOS_COMPARTIDOS = ["calendario", "matchcenter", "estadisticas"];

// Colores explícitos para el desplegable de categorías: el menú nativo lo
// dibuja el sistema operativo y no hereda las variables del tema.
const OPCION = { background:"#16140f", color:"#f0ede8" };
const GRUPO  = { background:"#0f0d0b", color:"#8a8681", fontWeight:700 };

/**
 * ¿Hay una sesión guardada en este navegador?
 *
 * Supabase la valida de forma asíncrona, así que la app arrancaba siempre en
 * la landing y saltaba a la app un instante después: al recargar veías el
 * "TU CLUB DE RUGBY MERECE ALGO MEJOR" por medio segundo antes de volver a tu
 * pantalla. Mirar el token guardado no valida nada — solo evita mostrar la
 * puerta de entrada a alguien que ya está adentro.
 */
function haySesionGuardada() {
  try {
    return Object.keys(window.localStorage).some(k => /^sb-.*-auth-token$/.test(k));
  } catch { return false; }
}

export default function SportOS() {
  const [screen,setScreen]               = useState(() => haySesionGuardada() ? "cargando" : "landing");
  const [sport,setSport]                 = useState("rugby");
  const [country,setCountry]             = useState("CL");
  const [role,setRole]                   = useState("entrenador");
  const [module,setModule]               = useState("muro");
  const [category,setCategory]           = useState(0);
  const [toast,setToast]                 = useState(null);
  // Arrancaba fijo en rugby+futbol+basketball para todos los clubes. Se
  // reemplaza con lo que diga clubs.sports apenas llega el club real.
  const [activeClubs,setActiveClubs]     = useState({rugby:true,futbol:true,basketball:true,handball:false,hockey:false});
  const [whatsappModal,setWhatsappModal] = useState(null); // null | { team, rival, date, starters, bench }
  const [convocado,setConvocado]         = useState(null);
  const [rankTab,setRankTab]             = useState("volumen");
  const [expandedDay,setExpandedDay]     = useState("lunes");
  const [hiaModal,setHiaModal]           = useState(false);
  const [gymPlanExercises,setGymPlanExercises] = useState(null);
  const [newExForm,setNewExForm]         = useState(false);
  const [newEx,setNewEx]                 = useState({name:"",sets:3,reps:8,pct:70,rest:120,notes:"",muscles:""});
  const [publishedPlan,setPublishedPlan] = useState(false);
  // Vitrina de modo demo/preview (sin login real) — ver payments/partidos reales más abajo.
  const [demoPayments,setDemoPayments]   = useState(MOCK_PAYMENTS);
  const [demoPartidos,setDemoPartidos]   = useState(MOCK_PARTIDOS);

  // null = modo demo | { nombre, email, rol, club, cats[], club_id, plan } = usuario real
  const [currentUser,setCurrentUser]     = useState(null);
  // Usuario ya autenticado (ej. Google OAuth) que aún no tiene club_id asignado
  const [pendingUser,setPendingUser]     = useState(null);
  const [searchOpen,setSearchOpen]       = useState(false);
  // El listener de auth se crea una sola vez y captura currentUser en null para
  // siempre. Sin esto, cada vez que Supabase reemitía SIGNED_IN (al volver a la
  // pestaña, al refrescar el token) el guard "!currentUser" seguía siendo
  // verdadero, se recalculaba el perfil y el rol volvía al del perfil: si
  // estabas mirando como Entrenador, te devolvía a Super Admin.
  const sesionYaResuelta = useRef(false);
  const [upgradeFor,setUpgradeFor]       = useState(null); // id de feature bloqueada
  // Editar un jugador desde la tabla del Inicio: la ficha se edita en
  // Jugadores, así que se anota a quién y se navega. Sin esto, la fila del
  // Inicio tenía cursor de mano y no hacía nada.
  const [jugadorAEditar,setJugadorAEditar] = useState(null);

  // Jugadores/club/pagos/partidos: datos reales de Supabase si hay club_id, vitrina demo si no
  const clubId = currentUser?.club_id ?? null;
  const { players: playersCrudos, addPlayer, importOrUpdatePlayers, updatePlayer, removePlayer } = usePlayers(clubId);
  const { club: clubRow, error: clubError, reload: reloadClub } = useClub(clubId);
  const { payments: realPayments, addPayment, declarePayment, confirmPayment, rejectPayment, registrarPagoManual, borrarPago, setPayments: setRealPayments } = usePayments(clubId);
  const { partidos: realPartidos, error: partidosError, setPartidos: setRealPartidos } = useMatches(clubId);
  // Los tries y los puntos del torneo se pegan acá, sobre la lista que reciben
  // todas las vistas: si se hiciera en cada pantalla, unas mostrarían los datos
  // y otras cero para el mismo jugador.
  const arusaJugadores = useArusaJugadores(sport === "rugby" && !!clubId, clubRow?.name || null);
  const players = enriquecerConArusa(playersCrudos, arusaJugadores);
  const isDemo = currentUser === null;
  const userCats = isDemo ? [] : (currentUser.cats || []);

  // Badge de "Clubes" en el sidebar: cuántas solicitudes de club nuevas hay sin revisar
  const [clubRequestsUnseen, setClubRequestsUnseen] = useState(0);
  useEffect(() => {
    if (role !== "superadmin") return;
    supabase.from("club_requests").select("id", { count: "exact", head: true }).eq("visto", false)
      .then(({ count }) => setClubRequestsUnseen(count || 0));
  }, [role, module]);

  // Badge de "Jugadores": solicitudes de gente que quiere entrar al club y
  // todavía nadie aprobó ni rechazó. La lista completa vive en AdminView;
  // acá solo se cuenta, para que el admin no tenga que entrar a buscarla.
  const [solicitudesPendientes, setSolicitudesPendientes] = useState(0);
  useEffect(() => {
    if (!clubId || role !== "admin") { setSolicitudesPendientes(0); return; }
    supabase.from("join_requests").select("id", { count: "exact", head: true })
      .eq("club_id", clubId).eq("status", "pendiente")
      .then(({ count }) => setSolicitudesPendientes(count || 0));
  }, [clubId, role, module]);

  const payments = clubId ? realPayments : demoPayments;
  const setPayments = clubId ? setRealPayments : setDemoPayments;
  const cuotasPorConfirmar = clubId && role === "admin"
    ? payments.filter(p => p.estado === "declarado").length : 0;
  const partidos = clubId ? realPartidos : demoPartidos;
  const setPartidos = clubId ? setRealPartidos : setDemoPartidos;

  // Plan del usuario: demo ve todo hasta Pro; usuarios reales usan su plan
  const userPlan = isDemo ? DEMO_PLAN : (currentUser?.plan || "free");

  // Historial de navegación para el botón ← dentro de la app
  const [moduleHistory, setModuleHistory] = useState([]);

  const navigateTo = (moduleId) => {
    if (!canAccess(userPlan, moduleId)) { setUpgradeFor(moduleId); return; }
    setModuleHistory(prev => [...prev.slice(-9), module]); // guarda el módulo actual antes de cambiar
    setModule(moduleId);
  };

  // Deportes que el club practica de verdad. Antes esto era estado local: los
  // interruptores de Mi Club parecían una configuración pero no se guardaban
  // en ningún lado y al recargar volvían a rugby+futbol+basketball.
  useEffect(() => {
    if (!clubRow) return;
    const lista = Array.isArray(clubRow.sports) && clubRow.sports.length
      ? clubRow.sports : [clubRow.sport];
    setActiveClubs({ rugby:false, futbol:false, basketball:false, handball:false, hockey:false,
      ...Object.fromEntries(lista.filter(Boolean).map(d => [d, true])) });
  }, [clubRow]);

  const cambiarDeportes = (actualizador) => {
    setActiveClubs(prev => {
      const siguiente = typeof actualizador === "function" ? actualizador(prev) : actualizador;
      if (clubId) {
        const lista = Object.entries(siguiente).filter(([,v]) => v).map(([k]) => k);
        supabase.from("clubs").update({ sports: lista }).eq("id", clubId);
      }
      return siguiente;
    });
  };

  const goBack = () => {
    if (moduleHistory.length === 0) {
      // Antes esto mandaba a la landing. Para alguien con sesion iniciada eso
      // se ve como que la app lo echo: la landing muestra "Ingresar / Crear
      // club" y parece que se cerro la sesion, aunque siga abierta. Solo el
      // modo demo (sin usuario) vuelve a la vitrina.
      if (currentUser) { setModule("home"); return; }
      setScreen("landing");
      return;
    }
    const prev = moduleHistory[moduleHistory.length - 1];
    setModuleHistory(h => h.slice(0, -1));
    setModule(prev);
  };

  const deportesActivos = Object.entries(activeClubs).filter(([,v])=>v).map(([k])=>k);
  // Qué categorías ofrece el selector. No basta con las del plantel: el club
  // tiene fixture de M13 a M18 y ningún jugador cargado en esas categorías
  // todavía, y ocultarlas dejaría esos partidos sin forma de mirarlos.
  const sp           = SPORTS_CONFIG[sport];
  const currentCategory = sp.categories[category]||sp.categories[0];
  const categoriasEnUso = new Set([
    ...players.map(p => p.category).filter(Boolean),
    ...partidos.map(p => categoriaDePartido(sp, p.cat)).filter(Boolean),
  ]);
  // Club real (nombre/colores de Supabase) con próximo/último partido derivados
  // de los partidos reales. Sin club_id (demo/preview) usa la vitrina CLUBS[sport].
  // El selector de categoría no filtraba nada: "próximo partido" se calculaba
  // sobre todos los partidos del club mezclados — Primera, Intermedia, M13… —
  // así que ganaba el de fecha más cercana fuera del equipo que fuera. Con
  // Adulta elegida se saltaba el partido de Primera y mostraba uno de juveniles.
  const partidosVisibles = partidos.filter(p => partidoEsDeCategoria(sp, currentCategory, p.cat));
  // El selector filtraba los partidos pero no el plantel: eligiendo M13 salían
  // los seis partidos de M13 al lado de "140 jugadores", que son los adultos.
  // Quien no tiene categoría cargada aparece en todas, como los partidos sin
  // categoría: es preferible verlo donde quizá no corresponde a que quede
  // invisible en la app y nadie se entere de que hay que categorizarlo.
  const playersVisibles = players.filter(p => !p.category || p.category === currentCategory);
  // En adulta los tres equipos juegan el mismo día, así que "el último" y "el
  // próximo" son tres partidos empatados en fecha y ganaba cualquiera: el Match
  // Center mostraba el resultado de Pre-Intermedia como si fuera el del club.
  // A igualdad de fecha manda el equipo de arriba (Primera), que es el que uno
  // quiere decir cuando dice "el partido".
  const equiposCat = sp.teamsByCategory?.[currentCategory] || [];
  const prioridad = (p) => {
    const i = equiposCat.findIndex(e => String(p.cat||"").toLowerCase().includes(e.toLowerCase()));
    return i < 0 ? equiposCat.length : i;
  };
  const jugados    = partidosVisibles.filter(p=>p.estado==="jugado")
    .sort((a,b)=> b.fecha.localeCompare(a.fecha) || prioridad(a)-prioridad(b));
  const programados = partidosVisibles.filter(p=>p.estado==="programado")
    .sort((a,b)=> a.fecha.localeCompare(b.fecha) || prioridad(a)-prioridad(b));
  const ultimo     = jugados[0];
  // El "próximo" tiene que estar en el futuro. Leverade deja partidos viejos
  // sin marcar como jugados (el de Old Johns del 18/07 nunca se cerró), y esos
  // ordenaban primero: el Match Center anunciaba como próximo un partido que ya
  // se había jugado hace semanas.
  const hoyISO     = new Date().toISOString().slice(0,10);
  const proximo    = programados.find(p => p.fecha >= hoyISO) || null;
  const club = clubRow ? {
    name: clubRow.name,
    country: clubRow.country,
    colors: clubRow.colors,
    // `equipo` para que la tarjeta diga de cuál de los tres está hablando.
    prev: ultimo ? { res: ultimo.resultado==="victoria"?"Victoria":ultimo.resultado==="derrota"?"Derrota":"Empate", score: `${ultimo.golesLocal}-${ultimo.golesVisita}`, rival: ultimo.rival, equipo: equiposCat.length ? ultimo.cat : null, fecha: ultimo.fecha } : { res:null, score:null, rival:null, equipo:null, fecha:null },
    // "sábado" a secas no dice cuál sábado. Va el día y el mes.
    next: proximo ? {
      rival: proximo.rival,
      dia:   new Date(proximo.fecha+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"}),
      fecha: proximo.fecha,
      hora:  proximo.hora||null,
      lugar: proximo.lugar||null,
      equipo: equiposCat.length ? proximo.cat : null,
    } : { rival:null, dia:null, fecha:null, hora:null, lugar:null, equipo:null },
  } : CLUBS[sport];
  const countryData  = COUNTRIES[country];
  // Jugador logueado: su propia ficha (por profile_id), no simplemente el primero del plantel.
  // La ficha del jugador logueado se busca por profile_id, no por nombre: dos
  // personas pueden llamarse igual y el nombre lo escribe quien carga la
  // planilla. Si no hay ninguna enlazada a esta cuenta se muestra la primera
  // del plantel, para que la vista de rol sirva de algo — pero eso son los
  // datos de otra persona y hay que decirlo, no dejar que se lean como propios.
  const miFicha   = (!isDemo && currentUser) ? players.find(p=>p.profile_id===currentUser.id) : null;
  const miJugador = miFicha || players[0];
  const fichaAjena = !isDemo && !miFicha && !!miJugador;
  const sportColor   = sp.color;
  const sportModules = MODULE_MAP[role]||[];

  // Toast con soporte undo
  const showToast = (msg, type="success", onUndo=null) => setToast({msg, type, onUndo});

  // Atajo de teclado para búsqueda global
  useEffect(()=>{
    const handler = (e) => {
      if ((e.metaKey||e.ctrlKey) && e.key==="k") { e.preventDefault(); setSearchOpen(p=>!p); }
      if (e.key==="Escape") {
        // Antes Escape solo cerraba la búsqueda: cualquier otro modal quedaba
        // abierto y había que buscarle la ✕ con el mouse.
        setSearchOpen(false); setUpgradeFor(null); setWhatsappModal(null); setHiaModal(false);
      }
    };
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  },[]);

  // ── La navegación vive en la URL ───────────────────────────────
  // Todo el estado de navegación estaba solo en memoria: el navegador no tenía
  // historial que recorrer (el gesto de atrás/adelante no hacía nada) y al
  // recargar se perdía el módulo y volvías al inicio.
  // Se usa el hash y no la query porque los links de invitación ya ocupan la
  // query (?token=...) y no queremos pisarlos.
  // La URL guarda módulo, rol y categoría: #/calendario?rol=entrenador&cat=Adulta
  // Antes solo el módulo, así que al recargar volvías a tu rol de perfil
  // (Super Admin) y a la primera categoría (M6): perdías dos de las tres cosas
  // que te ubican en la app.
  const estadoDeUrl = () => {
    const bruto = window.location.hash.replace(/^#\/?/, "");
    const [ruta, query] = bruto.split("?");
    const params = new URLSearchParams(query || "");
    return {
      modulo: /^[a-z]+$/.test(ruta) ? ruta : null,
      rol: params.get("rol"),
      cat: params.get("cat"),
    };
  };
  // Se guarda en una ref porque los efectos de abajo corren después (el rol
  // llega con la sesión) y pondrían los valores por defecto encima.
  const urlPendiente = useRef(estadoDeUrl());

  // El rol de la URL solo se respeta si el perfil puede verlo: el superadmin
  // previsualiza cualquiera, el resto solo el suyo. Si no, un link compartido
  // te metería en una vista que no te corresponde.
  useEffect(()=>{
    const pedido = urlPendiente.current?.rol;
    if (!pedido || !currentUser) return;
    const propio = currentUser.rol;
    const permitido = (pedido === propio || propio === "superadmin") && MODULE_MAP[pedido];
    // Si no se puede aplicar se saca del pendiente: si no, el efecto de abajo
    // se quedaría esperando para siempre un rol que nunca va a llegar y no
    // soltaría nunca la restauración.
    if (permitido) setRole(pedido);
    else urlPendiente.current = { ...urlPendiente.current, rol: null };
  },[currentUser]);

  // Se descartaba al primer render, antes de que llegara la sesión. Y la
  // sesión, cuando llega, fija el rol del perfil (superadmin) y el deporte —
  // que a su vez reseteaba la categoría a la primera (M6). O sea: Ctrl+R
  // restauraba bien durante unos milisegundos y después la sesión lo pisaba,
  // con la restauración ya tirada a la basura. Ahora la URL manda hasta que se
  // sabe quién es el usuario, y recién ahí se suelta.
  useEffect(()=>{
    const pedido = urlPendiente.current;
    if (!pedido) return;
    const permitido = (MODULE_MAP[role]||[]).some(m=>m.id===pedido.modulo);
    setModule(permitido ? pedido.modulo : "home");
    setModuleHistory([]);
    // La categoría se restaura acá y no en su propio efecto porque cambiar de
    // rol no debe perderla, pero sí tiene que ocurrir después de que el rol
    // quedó fijo.
    const i = pedido.cat ? (SPORTS_CONFIG[sport]?.categories || []).indexOf(pedido.cat) : -1;
    if (i >= 0) setCategory(i);
    // Se suelta cuando el rol pedido ya quedó puesto (o se descartó): mientras
    // el rol siga moviéndose, el módulo permitido todavía puede cambiar.
    const rolListo = !pedido.rol || role === pedido.rol;
    if (rolListo && (currentUser || screen === "app")) urlPendiente.current = null;
  },[role, currentUser, sport, screen]);

  // Cada cambio de módulo deja una entrada en el historial del navegador.
  useEffect(()=>{
    if (screen!=="app") return;
    const destino = `#/${module}?rol=${role}&cat=${encodeURIComponent(currentCategory || "")}`;
    if (window.location.hash === destino) return;
    // La primera vez se reemplaza: si no, quedaría una entrada de más y el
    // primer "atrás" no haría nada visible.
    // Cambiar de rol o de categoría no es "navegar": reemplaza, no apila. Si
    // no, el botón atrás se llenaría de pasos invisibles.
    const soloModuloCambio = !window.location.hash.startsWith(`#/${module}?`);
    if (!window.location.hash || !soloModuloCambio) window.history.replaceState({module}, "", destino);
    else                                            window.history.pushState({module}, "", destino);
  },[module,screen,role,currentCategory]);

  useEffect(()=>{
    const onPop = () => {
      const { modulo } = estadoDeUrl();
      // Sin restricción de plan: si el usuario estuvo ahí, puede volver.
      if (modulo) setModule(modulo);
    };
    window.addEventListener("popstate", onPop);
    return ()=>window.removeEventListener("popstate", onPop);
  },[]);

  // Cambiar de deporte vuelve a la primera categoría (las de rugby no existen
  // en fútbol). Pero al recargar, la sesión fija el deporte del club y esto se
  // disparaba pisando la categoría que venía en la URL: por eso Ctrl+R te
  // dejaba siempre en M6. Mientras haya URL por restaurar, no toca nada.
  useEffect(()=>{ if (!urlPendiente.current) setCategory(0); },[sport]);

  // Detecta sesión de Supabase al cargar (OAuth redirect o sesión guardada)
  useEffect(()=>{
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT") { sesionYaResuelta.current = false; }
      if (event === "PASSWORD_RECOVERY") {
        setScreen("newpassword");
        return;
      }
      // El token guardado existía pero ya no vale (expiró, se cerró sesión en
      // otra pestaña): se suelta la pantalla de carga y se muestra la landing,
      // que es lo que corresponde.
      if (event === "INITIAL_SESSION" && !session?.user) {
        setScreen(p => p === "cargando" ? "landing" : p);
        return;
      }
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user && !sesionYaResuelta.current) {
        sesionYaResuelta.current = true;
        const u = session.user;
        // Buscar perfil en tabla profiles. Reintenta una vez: un hipo
        // transitorio de red/sincronización acá (ej. "JWT issued at future")
        // hacía que se tratara a un admin real como cuenta nueva sin club.
        let profile = null;
        for (let intento = 0; intento < 2; intento++) {
          const r = await supabase.from("profiles").select("*").eq("id", u.id).single();
          if (!r.error) { profile = r.data; break; }
          await new Promise(res => setTimeout(res, 600));
        }

        // Invitación que no se pudo canjear al registrarse porque faltaba
        // confirmar el correo. Ahora sí hay sesión: se canjea y el perfil
        // vuelve a leerse con el rol y el club ya asignados.
        if (!profile?.club_id && u.user_metadata?.invitacion_token) {
          const asignado = await redeemPendingInvitation(u);
          if (asignado) {
            const r = await supabase.from("profiles").select("*").eq("id", u.id).single();
            if (!r.error) profile = r.data;
          }
        }

        const esSuperAdmin = u.email === "admin@sportostest.com";
        const rolPerfil = esSuperAdmin ? "superadmin" : (profile?.rol || "admin");

        // Usuarios no-admin heredan el plan del admin de su club (cubre antiguos y nuevos)
        let planEfectivo = esSuperAdmin ? "elite" : (profile?.plan || "free");
        if (!esSuperAdmin && profile?.club_id && !["admin","superadmin"].includes(rolPerfil)) {
          const { data: adminClub } = await supabase
            .from("profiles")
            .select("plan")
            .eq("club_id", profile.club_id)
            .eq("rol", "admin")
            .single();
          if (adminClub?.plan) planEfectivo = adminClub.plan;
        }
        const usuario = {
          id: u.id,
          nombre: profile?.nombre || u.user_metadata?.full_name || u.email,
          email: u.email,
          rol: rolPerfil,
          club: profile?.clubs?.name || "Mi Club",
          club_id: profile?.club_id || null,
          sport: profile?.clubs?.sport || "rugby",
          plan: planEfectivo,
          onboarding_done: profile?.onboarding_done || false,
          avatar_url: profile?.avatar_url || null,
          cats: [],
          isReal: true,
        };
        setRole(usuario.rol);
        if (usuario.sport) setSport(usuario.sport);

        // Sin club: a configurarlo. Vale para el admin recién creado por Google
        // y para quien acaba de confirmar el correo — ese todavía figura como
        // "jugador" en profiles, pero trae el club elegido en el user_metadata.
        const clubPendiente = u.user_metadata?.club_pendiente || null;
        if (!esSuperAdmin && !profile?.club_id && (rolPerfil === "admin" || clubPendiente)) {
          // currentUser también se fija acá. Antes solo se hacía en la rama de
          // abajo, así que en el onboarding la app no sabía quién eras: el
          // botón Volver caía al login, el login te reconocía como admin sin
          // club y te devolvía al onboarding. Un círculo sin salida.
          setCurrentUser(usuario);
          setPendingUser({ id: u.id, nombre: usuario.nombre, email: u.email, club_pendiente: clubPendiente });
          setScreen("club-onboarding");
        } else {
          setCurrentUser(usuario);
          setScreen("app");
        }
      }
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Detecta link de invitación en la URL — va ANTES de landing para que no la tape
  const urlParams = new URLSearchParams(window.location.search);
  const isInvitation = urlParams.has("token") && urlParams.has("rol");

  if(isInvitation) return (
    <InvitationScreen
      params={urlParams}
      onBack={()=>{ window.history.replaceState({},"","/"); setScreen("landing"); }}
      onComplete={(usuario)=>{
        setCurrentUser(usuario);
        setRole(usuario.rol);
        setScreen("app");
        window.history.replaceState({},"","/");
      }}
    />
  );

  // Pantalla de nueva contraseña (viene del link de recuperación por email)
  if(screen==="newpassword") return (
    <NewPasswordScreen onSuccess={()=>setScreen("login")}/>
  );

  // Solicitud de jugador con código de club
  if(screen==="join-request") return (
    <JoinRequestScreen onBack={()=>setScreen("landing")}/>
  );

  // Sesión guardada que todavía se está validando: ni landing ni app. Antes se
  // mostraba la landing mientras tanto y al recargar veías la portada de venta
  // por medio segundo antes de volver a tu pantalla.
  if(screen==="cargando") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:"var(--bg-base)",color:"var(--text-3)",fontSize:"13px",gap:"10px"}}>
      <AuroraBg/>
      <span style={{position:"relative",fontFamily:"'Bebas Neue',sans-serif",fontSize:"26px",
        letterSpacing:"0.08em",color:"#1FA04A",filter:"drop-shadow(0 0 14px #1FA04A88)"}}>⚡ SPORTOS</span>
    </div>
  );

  // Landing pública
  if(screen==="landing") return (
    <LandingPage
      onLogin={()=>setScreen("login")}
      onDemo={()=>setScreen("onboarding")}
      onRegister={()=>setScreen("club-onboarding")}
      onJoinRequest={()=>setScreen("join-request")}
    />
  );

  // Onboarding nuevo club
  if(screen==="club-onboarding") return (
    <ClubOnboarding
      // Mandaba siempre al login. A quien ya tiene sesion y club eso se le ve
      // como que el boton no hace nada: sale del onboarding y la pantalla de
      // login lo devuelve a la app de inmediato. Ahora vuelve a donde estaba.
      // Con sesión abierta se vuelve a la app: si todavía no hay club, ahí
      // está SinClubScreen, que ofrece crear uno, unirse con código o cerrar
      // sesión. Mandarlo al login sería devolverlo al mismo onboarding.
      onBack={()=>{ setPendingUser(null); setScreen(currentUser ? "app" : "login"); }}
      existingUser={pendingUser}
      onComplete={(usuario)=>{
        if(!usuario) { setPendingUser(null); setScreen("login"); return; }
        setPendingUser(null);
        setCurrentUser({ nombre:usuario.nombre, email:usuario.email, rol:usuario.rol, club:usuario.club, club_id:usuario.club_id, cats:usuario.cats||[], plan:"free", isReal:true });
        setRole(usuario.rol);
        setSport(usuario.sport||"rugby");
        setScreen("app");
      }}
    />
  );

  if(screen==="login") return (
    <LoginScreen
      onBack={()=>setScreen("landing")}
      onLogin={(user)=>{
        const rolFinal = user.email==="admin@sportostest.com" ? "superadmin" : user.rol;
        const planFinal = user.email==="admin@sportostest.com" ? "elite" : (user.plan||"free");
        // el id va incluido: sin él, la ficha del jugador logueado y las
        // escrituras que guardan autor se quedaban sin a quién apuntar.
        setCurrentUser({id:user.id, nombre:user.nombre, email:user.email, rol:rolFinal, club:user.club, club_id:user.club_id||null, cats:user.cats, plan:planFinal, avatar_url:user.avatar_url||null, isReal:true});
        setRole(rolFinal);
        setSport(user.sport||"rugby");
        // Sin club: a configurarlo, no a la app — ahí vería la vitrina de demo
        // como si fueran sus datos. Cubre al admin cuyo club nunca se creó y a
        // quien viene de confirmar el correo (su perfil todavía dice "jugador",
        // el club que eligió está en club_pendiente).
        if (!user.club_id && (rolFinal==="admin" || user.club_pendiente)) {
          setPendingUser({ id:user.id, nombre:user.nombre, email:user.email, club_pendiente:user.club_pendiente||null });
          setScreen("club-onboarding");
        } else {
          setScreen("app");
        }
      }}
      onDemo={()=>setScreen("onboarding")}
      onRegister={()=>setScreen("club-onboarding")}
    />
  );

  // Sin sesión activa y pantalla app → redirigir a login
  if(screen==="app" && !currentUser) { setScreen("login"); return null; }

  // Sesión real sin club → nunca la vitrina de demo. Sin club_id, usePlayers/
  // useClub/usePayments caen a los datos de mentira (TOROS RC y su plantel
  // inventado) y el usuario cree que son suyos; además todo lo que escribe
  // falla, porque el club_id que manda a Supabase es null.
  // El superadmin es la excepción legítima: administra la plataforma, no un club.
  if(screen==="app" && currentUser && !clubId && role!=="superadmin") return (
    <SinClubScreen
      usuario={currentUser}
      esAdmin={role==="admin"}
      onCrearClub={()=>{
        setPendingUser({ id:currentUser.id, nombre:currentUser.nombre, email:currentUser.email });
        setScreen("club-onboarding");
      }}
      onUnirme={()=>setScreen("join-request")}
      onSalir={async()=>{
        await supabase.auth.signOut();
        setCurrentUser(null);
        setScreen("login");
      }}
    />
  );

  // Tiene club_id pero la fila no se pudo leer (RLS, red, club borrado). Antes
  // esto caía en CLUBS[sport] y el usuario veía TOROS RC creyendo que era su
  // club: la misma mentira que SinClubScreen vino a sacar, por otra puerta.
  if (screen==="app" && clubId && clubError) return (
    <div style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <AuroraBg/>
      <div style={{ position:"relative", maxWidth:"420px", textAlign:"center", background:"var(--bg-elev-1)", border:"1px solid var(--border-soft)", borderRadius:"16px", padding:"32px 24px" }}>
        <div style={{ fontSize:"40px", marginBottom:"12px" }}>⚠️</div>
        <div style={{ fontWeight:700, fontSize:"18px", marginBottom:"8px" }}>No pudimos cargar tu club</div>
        <div style={{ fontSize:"14px", color:"var(--text-3)", marginBottom:"20px", lineHeight:1.5 }}>
          Tu cuenta sí tiene un club asociado, pero no conseguimos leerlo. No te
          mostramos datos de ejemplo para no confundirte con información que no
          es tuya.
        </div>
        <div style={{ fontSize:"12px", color:"var(--text-4)", marginBottom:"20px", fontFamily:"monospace", wordBreak:"break-word" }}>
          {clubError.message}
        </div>
        <button onClick={reloadClub}
          style={{ ...ss.btn, width:"100%", padding:"14px", fontWeight:700, fontSize:"14px",
            background:"linear-gradient(135deg,#3B82F6,#2563EB)", color:"#fff",
            boxShadow:"0 6px 20px rgba(59,130,246,0.4)", marginBottom:"14px" }}>
          Reintentar
        </button>
        <button
          onClick={async()=>{ await supabase.auth.signOut(); setCurrentUser(null); setScreen("login"); }}
          style={{ background:"none", border:"none", color:"var(--text-4)", fontSize:"12px",
            cursor:"pointer", textDecoration:"underline" }}
        >Cerrar sesión</button>
      </div>
    </div>
  );

  const rolActual = ROLES.find(r=>r.id===role);

  return (
    <div style={ss.wrap} className="sportos-wrap" data-sport={sport}>
      <AuroraBg/>
      <AnimatePresence>
        {toast&&<Toast msg={toast.msg} type={toast.type} onUndo={toast.onUndo||null} onClose={()=>setToast(null)}/>}
      </AnimatePresence>
      <AnimatePresence>
        {searchOpen&&<GlobalSearch players={players} posts={[]} sportColor={sportColor} role={role} modules={sportModules} onNavigate={(id)=>navigateTo(id)} onClose={()=>setSearchOpen(false)}/>}
      </AnimatePresence>
      {screen==="app"&&<OnboardingTip
        sportColor={sportColor}
        role={role}
        userKey={currentUser?.email || "demo"}
        onboardingDone={currentUser?.onboarding_done || false}
        userId={currentUser?.id || null}
        onNavigate={(moduleId)=>navigateTo(moduleId)}
      />}
      {whatsappModal&&<WhatsAppModal onClose={()=>setWhatsappModal(null)} team={whatsappModal.team} rival={whatsappModal.rival} date={whatsappModal.date} hora={whatsappModal.hora} lugar={whatsappModal.lugar}
        starters={whatsappModal.starters} bench={whatsappModal.bench}/>}

      {/* ── Banner usuario ── */}
      {(
        <div style={{background:"linear-gradient(90deg,rgba(34,197,94,0.1),rgba(59,130,246,0.08))",borderBottom:"1px solid rgba(34,197,94,0.2)",padding:"5px 16px",display:"flex",alignItems:"center",gap:"8px",fontSize:"11px",flexWrap:"wrap"}}>
          <span style={{width:"7px",height:"7px",borderRadius:"50%",background:"#22C55E",boxShadow:"0 0 8px #22C55E",display:"inline-block",flexShrink:0}}/>
          <span style={{color:"#22C55E",fontWeight:700}}>{currentUser?.nombre}</span>
          <span style={{color:"var(--text-3)"}}>·</span>
          <span style={{color:"var(--text-2)"}}>{ROL_ICONS[role]} {rolActual?.label}</span>
          {/* Selector de rol — solo disponible para superadmin */}
          {currentUser?.rol === "superadmin" && (
            <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
              {ROLES.map(r=>(
                <motion.button key={r.id} whileTap={{scale:0.95}}
                  onClick={()=>{ setRole(r.id); setModule("home"); }}
                  style={{padding:"2px 8px",borderRadius:"99px",border:`1px solid ${role===r.id?"#22C55E":"rgba(255,255,255,0.15)"}`,background:role===r.id?"#22C55E22":"transparent",color:role===r.id?"#22C55E":"rgba(255,255,255,0.5)",fontSize:"10px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                  {r.icon} {r.label}
                </motion.button>
              ))}
            </div>
          )}
          <div style={{flex:1}}/>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>{ setCurrentUser(null); setRole("entrenador"); setScreen("login"); }}
            style={{...ss.btn,background:"transparent",color:"var(--text-3)",border:"1px solid var(--border-soft)",fontSize:"10px",padding:"3px 10px"}}>
            Cerrar sesión
          </motion.button>
        </div>
      )}

      {/* ── Topbar ── */}
      <div style={{...ss.topbar, borderBottom:`1px solid ${sportColor}44`, boxShadow:`0 1px 0 ${sportColor}22`}} className="sportos-topbar">
        {/* Botón volver */}
        <motion.button
          whileHover={{x:-3,scale:1.05}} whileTap={{scale:0.95}}
          onClick={goBack}
          title={moduleHistory.length>0?"Módulo anterior":"Ir al inicio"}
          style={{background:"var(--bg-elev-2)",border:"1px solid var(--border-mid)",color:"var(--text-2)",borderRadius:"var(--r-sm)",padding:"5px 11px",cursor:"pointer",fontSize:"15px",lineHeight:1,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",fontWeight:700}}>
          ←
        </motion.button>
        {/* El logo es lo primero que uno aprieta para volver al principio. */}
        <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.4}}
          whileHover={{scale:1.04}} whileTap={{scale:0.97}}
          onClick={()=>navigateTo("home")} title="Ir al inicio"
          style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"22px",color:sportColor,marginRight:"8px",whiteSpace:"nowrap",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",filter:`drop-shadow(0 0 14px ${sportColor}88)`}}>
          ⚡ SportOS
        </motion.div>
        {/* Selector de deporte y categoría: oculto para jugador real */}
        {/* Con un solo deporte activo el selector no ofrece nada que elegir. */}
        {(isDemo || role !== "jugador") && <>
        {deportesActivos.length > 1 && 
          <div className="hide-mobile" style={{display:"flex",gap:"2px",background:"var(--bg-elev-2)",borderRadius:"var(--r-md)",padding:"3px",overflowX:"auto"}}>
            {Object.entries(SPORTS_CONFIG).map(([k,v])=>{
              const isActive2 = role==="admin"?activeClubs[k]:k===sport;
              if(role!=="superadmin"&&!isActive2&&k!==sport) return null;
              return (
                <motion.button key={k} whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setSport(k)} style={{padding:"6px 10px",borderRadius:"var(--r-sm)",border:"none",cursor:"pointer",background:k===sport?`linear-gradient(135deg,${v.color}33,${v.color}11)`:"transparent",color:k===sport?v.color:"var(--text-2)",fontSize:"11px",fontWeight:k===sport?700:500,transition:"all 0.2s",display:"flex",alignItems:"center",gap:"5px",whiteSpace:"nowrap",boxShadow:k===sport?`0 0 12px ${v.color}44`:"none"}}>
                  <span style={{fontSize:"13px"}}>{v.icon}</span> {v.name}
                </motion.button>
              );
            })}
          </div>}
          <select className="hide-mobile" value={category} onChange={e=>setCategory(Number(e.target.value))} style={{...ss.input,width:"100px",fontSize:"12px",padding:"6px 10px",cursor:"pointer"}}>
            {/* Solo las categorías que el plantel realmente usa: ofrecer las
                once cuando el club juega en dos es ruido. Y agrupadas cuando el
                deporte lo define: los tres equipos de adulta no son categorías
                de edad distintas, son tres planteles del mismo +18. */}
            {(() => {
              const visible = (c) => categoriasEnUso.has(c) || categoriasEnUso.size===0;
              // El desplegable nativo pinta las opciones con los colores del sistema,
              // no con los del tema: sobre el fondo claro que dibuja el navegador,
              // el texto salía casi invisible. Se fijan a mano.
              const opcion  = (c) => <option key={c} value={sp.categories.indexOf(c)} style={OPCION}>{c}</option>;
              if (!sp.categoryGroups) return sp.categories.filter(visible).map(opcion);
              return sp.categoryGroups.map(g => {
                const cats = g.cats.filter(visible);
                return cats.length ? <optgroup key={g.label} label={g.label} style={GRUPO}>{cats.map(opcion)}</optgroup> : null;
              });
            })()}
          </select>
        </>}
        <div style={{flex:1}}/>
        {/* Búsqueda global */}
        <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setSearchOpen(true)}
          style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-3)",border:"1px solid var(--border-soft)",padding:"6px 12px",gap:"8px",fontSize:"12px"}}>
          🔍 <span className="hide-mobile">Buscar</span>
          <span className="hide-mobile" style={{fontSize:"10px",padding:"1px 6px",borderRadius:"4px",background:"var(--bg-elev-3)",color:"var(--text-4)"}}>⌘K</span>
        </motion.button>
        <div className="hide-mobile" style={{fontSize:"11px",color:"var(--text-2)",display:"flex",alignItems:"center",gap:"4px",padding:"5px 10px",background:"var(--bg-elev-2)",borderRadius:"99px",whiteSpace:"nowrap"}}>🇨🇱 CLP</div>
        {/* Tenía cursor:pointer y animación de hover pero ningún onClick: se
            veía como botón y no hacía nada. Lo natural es Mi Perfil. */}
        <motion.div whileHover={{scale:1.1,rotate:5}} whileTap={{scale:0.95}}
          onClick={()=>{ if(!isDemo) navigateTo("miperfil"); }}
          title={isDemo ? "" : "Mi Perfil"}
          style={{width:"34px",height:"34px",borderRadius:"50%",background:`linear-gradient(135deg,${sportColor}44,${sportColor}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,color:sportColor,border:`2px solid ${sportColor}55`,flexShrink:0,boxShadow:`0 0 12px ${sportColor}44`,cursor:isDemo?"default":"pointer",overflow:"hidden"}}>
          {!isDemo && currentUser?.avatar_url
            ? <img src={currentUser.avatar_url} alt="foto" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : isDemo ? "AC" : currentUser.nombre.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
        </motion.div>
      </div>

      {/* ── Body ── */}
      <div className="sportos-body" style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* Sidebar */}
        <motion.div {...fadeUp} className="sportos-sidebar" style={ss.sidebar}>
          <div className="sidebar-profile sport-stripe" style={{padding:"18px 14px",borderBottom:`1px solid ${sportColor}33`,textAlign:"center",background:`linear-gradient(180deg,${sportColor}14 0%,transparent 100%)`}}>
            {/* El escudo del club si lo tiene; si no, el icono del deporte. */}
            <motion.div whileHover={{scale:1.05}} style={{width:"54px",height:"54px",borderRadius:"var(--r-md)",background:`linear-gradient(135deg,${sportColor}55,${sportColor}22)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",border:`2px solid ${sportColor}88`,margin:"0 auto 10px",boxShadow:`0 0 24px ${sportColor}66, inset 0 1px 0 ${sportColor}44`,overflow:"hidden"}}>
              {clubRow?.logo_url
                ? <img src={clubRow.logo_url} alt={clubRow.name} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                : sp.icon}
            </motion.div>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"17px",letterSpacing:"0.07em",color:"var(--text-1)"}}>{club.name}</div>
            <div style={{...ss.muted,fontSize:"10px",marginTop:"3px",letterSpacing:"0.08em",textTransform:"uppercase"}}>{countryData.flag} {countryData.name}</div>
          </div>

          {/* Perfil del usuario */}
          <div className="sidebar-profile" style={{padding:"14px 12px",borderBottom:"1px solid var(--border-soft)"}}>
            <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
              <div style={{width:"36px",height:"36px",borderRadius:"50%",background:`linear-gradient(135deg,${sportColor}33,${sportColor}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,color:sportColor,border:`1.5px solid ${sportColor}44`,flexShrink:0,overflow:"hidden"}}>
                {currentUser?.avatar_url
                  ? <img src={currentUser.avatar_url} alt="foto" style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  : currentUser?.nombre?.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()||"?"}
              </div>
              <div style={{minWidth:0}}>
                <div style={{fontWeight:700,fontSize:"13px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{currentUser?.nombre}</div>
                <div style={{display:"inline-flex",alignItems:"center",gap:"4px",marginTop:"3px",padding:"2px 8px",borderRadius:"99px",background:`${sportColor}18`,border:`1px solid ${sportColor}33`}}>
                  <span style={{fontSize:"11px"}}>{ROL_ICONS[role]}</span>
                  <span style={{fontSize:"10px",fontWeight:700,color:sportColor}}>{rolActual?.label}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selector de rol — SOLO superadmin. Antes se mostraba a
              cualquier usuario logueado (currentUser&&...), dejando que
              cualquier admin normal se "cambiara" a Super Admin con un
              click (solo visual/cliente, pero generaba confusión real:
              esto es justamente lo que reportó jmsanchez). */}
          {currentUser?.rol==="superadmin"&&(
            <div className="sidebar-roles" style={{padding:"10px 12px",borderBottom:"1px solid var(--border-soft)"}}>
              <div style={{...ss.label,marginBottom:"6px",paddingLeft:"2px"}}>Vista de rol</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:"4px"}}>
                {ROLES.map(r=>(
                  <motion.button key={r.id} whileTap={{scale:0.95}}
                    onClick={()=>{ setRole(r.id); setModule("home"); }}
                    style={{padding:"4px 8px",borderRadius:"99px",border:`1px solid ${role===r.id?"var(--accent)":"var(--border-soft)"}`,background:role===r.id?"var(--accent)":"transparent",color:role===r.id?"#fff":"var(--text-3)",fontSize:"10px",fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                    {r.icon} {r.label}
                  </motion.button>
                ))}
              </div>
            </div>
          )}

          <div className="sidebar-modules" style={{padding:"10px 8px 4px",flex:1}}>
            <div className="hide-mobile" style={{...ss.label,paddingLeft:"10px",marginBottom:"8px"}}>Módulos</div>
            {sportModules.map(m=>{
              const locked = !canAccess(userPlan, m.id);
              const active = module===m.id;
              return (
                <motion.button key={m.id} whileHover={{x:locked?0:4}} whileTap={{scale:0.97}}
                  className={active?"sidebar-module-btn active":"sidebar-module-btn"}
                  onClick={()=>{ if(m.id!==module) navigateTo(m.id); }}
                  style={{
                    display:"flex",alignItems:"center",gap:"9px",
                    padding:"9px 10px 9px 12px",
                    borderRadius:"var(--r-sm)",border:"none",
                    borderLeft: active ? `3px solid ${sportColor}` : "3px solid transparent",
                    cursor:"pointer",
                    background: active
                      ? `linear-gradient(90deg,${sportColor}28,${sportColor}08)`
                      : "transparent",
                    color: active ? sportColor : locked ? "var(--text-4)" : "var(--text-2)",
                    width:"100%",textAlign:"left",
                    fontSize:"12px",fontWeight: active ? 700 : 500,
                    marginBottom:"2px",transition:"all 0.18s",
                    boxShadow: active ? `inset 0 0 20px ${sportColor}18` : "none",
                    opacity: locked ? 0.55 : 1,
                  }}>
                  <span style={{fontSize:"15px",width:"18px",flexShrink:0,textAlign:"center",filter:active?`drop-shadow(0 0 6px ${sportColor})`:"none"}}>{m.icon}</span>
                  <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",flex:1,letterSpacing:"0.01em"}}>{m.label}</span>
                  {(()=>{
                    // Lo que está esperando a una persona se avisa en el menú:
                    // si hay que entrar al módulo para enterarse, no se entera.
                    const pendiente = m.id==="clubes"    ? clubRequestsUnseen
                                    : m.id==="finanzas"  ? cuotasPorConfirmar
                                    : m.id==="jugadores" ? solicitudesPendientes
                                    : 0;
                    if (!pendiente) return null;
                    const urgente = m.id!=="clubes";
                    return <span style={{fontSize:"10px",flexShrink:0,padding:"1px 7px",borderRadius:"99px",background:urgente?"#F59E0B":sportColor,color:urgente?"#1a1a1a":"#fff",fontWeight:800}}>{pendiente}</span>;
                  })()}
                  {locked && (()=>{ const req=requiredPlan(m.id); const p=PLANS[req]; return <span style={{fontSize:"9px",flexShrink:0,background:`${p.color}22`,color:p.color,border:`1px solid ${p.color}44`,borderRadius:"99px",padding:"2px 6px",fontWeight:700,whiteSpace:"nowrap"}}>{p.icon} {p.label}</span>; })()}
                </motion.button>
              );
            })}
          </div>

          <div className="sidebar-plan" style={{padding:"12px",borderTop:"1px solid var(--border-soft)"}}>
            {(()=>{
              const plan = PLANS[userPlan] || PLANS.free;
              return (
                <div style={{...ss.card,padding:"10px",border:`1px solid ${plan.color}33`,background:`${plan.color}08`}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}>
                    <span style={{fontSize:"10px",color:"var(--text-2)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600}}>Plan</span>
                    <span style={{background:`${plan.color}22`,color:plan.color,border:`1px solid ${plan.color}55`,borderRadius:"99px",padding:"3px 7px",fontSize:"10px",fontWeight:600}}>{plan.icon} {plan.label}</span>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                    <span style={{width:"8px",height:"8px",borderRadius:"50%",background:"#1FA04A",boxShadow:"0 0 8px #1FA04A",animation:"pulse-soft 2s infinite"}}/>
                    <span style={{fontSize:"10px",color:"#1FA04A",fontWeight:600}}>Sistema activo</span>
                  </div>
                </div>
              );
            })()}
            <motion.button whileHover={{scale:1.02,y:-1}} whileTap={{scale:0.97}}
              onClick={async()=>{
                await supabase.auth.signOut();
                setCurrentUser(null);
                setRole("entrenador");
                setScreen("landing");
              }}
              style={{width:"100%",marginTop:"10px",padding:"9px",borderRadius:"var(--r-sm)",border:"1px solid rgba(239,68,68,0.25)",background:"rgba(239,68,68,0.06)",color:"#EF4444",fontSize:"12px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",fontFamily:"inherit",transition:"all 0.2s"}}>
              🚪 Cerrar sesión
            </motion.button>
          </div>
        </motion.div>

        {/* Modal de upgrade freemium */}
        <AnimatePresence>
          {upgradeFor && (
            <UpgradeModal
              requiredPlan={requiredPlan(upgradeFor)}
              sportColor={sportColor}
              onClose={()=>setUpgradeFor(null)}
            />
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="sportos-main" style={ss.main} key={role+module}>
          <AnimatePresence mode="wait">
            <motion.div key={role+module} {...fadeUp} transition={{duration:0.4}}>
              {module==="home"&&<HomeView role={role} onEditPlayer={(p)=>{ setJugadorAEditar(p); navigateTo("jugadores"); }} players={playersVisibles} sportColor={sportColor} club={club} sp={sp} countryData={countryData} payments={payments} partidos={partidosVisibles} onNavigate={navigateTo} currentUser={currentUser} convocado={convocado} clubId={clubId} miJugador={miJugador}/>}
              {module!=="home"&&module!=="miperfil"&&role==="superadmin"&&<SuperAdminView module={module} showToast={showToast}
                rolePreviewProps={{players, sp, sportColor, club, countryData, payments, partidos, sport, userCats:[], isDemo:true, publishedPlan, setPublishedPlan, newExForm, setNewExForm, newEx, setNewEx, gymPlanExercises, setGymPlanExercises, rankTab, setRankTab, expandedDay, setExpandedDay}}
              />}
              {module!=="home"&&module!=="miperfil"&&role==="admin"&&!MODULOS_COMPARTIDOS.includes(module)&&<AdminView module={module} sport={sport} sp={sp} club={club} activeClubs={activeClubs} setActiveClubs={cambiarDeportes} countryData={countryData} players={playersVisibles} addPlayer={addPlayer} importOrUpdatePlayers={importOrUpdatePlayers} updatePlayer={updatePlayer} removePlayer={removePlayer} showToast={showToast} sportColor={sportColor} payments={payments} setPayments={setPayments} confirmPayment={confirmPayment} rejectPayment={rejectPayment} clubId={clubId} currentUser={currentUser} userPlan={userPlan} currentCategory={currentCategory} jugadorAEditar={jugadorAEditar} onJugadorEditado={()=>setJugadorAEditar(null)} irA={navigateTo} todosLosPlayers={players} registrarPagoManual={clubId?registrarPagoManual:null} borrarPago={clubId?borrarPago:null}/>}
              {module!=="home"&&module!=="miperfil"&&(role==="entrenador"||(role==="admin"&&MODULOS_COMPARTIDOS.includes(module)))&&<EntrenadorView module={module} sport={sport} sp={sp} club={club} players={playersVisibles} showToast={showToast} sportColor={sportColor} currentCategory={currentCategory} hiaModal={hiaModal} setHiaModal={setHiaModal} userCats={userCats} isDemo={isDemo} partidos={partidosVisibles} setPartidos={setPartidos} clubId={clubId} currentUserId={currentUser?.id||null}/>}
              {module!=="home"&&module!=="miperfil"&&role==="preparador"&&<PreparadorView module={module} sp={sp} showToast={showToast} sportColor={sportColor} publishedPlan={publishedPlan} setPublishedPlan={setPublishedPlan} newExForm={newExForm} setNewExForm={setNewExForm} newEx={newEx} setNewEx={setNewEx} gymPlanExercises={gymPlanExercises} setGymPlanExercises={setGymPlanExercises} rankTab={rankTab} setRankTab={setRankTab} expandedDay={expandedDay} setExpandedDay={setExpandedDay} userCats={userCats} isDemo={isDemo} players={playersVisibles} clubId={clubId} currentUser={currentUser}/>}
              {module==="miperfil"&&<PerfilView currentUser={currentUser} sport={sport} sportColor={sportColor} onSaved={(data)=>{if(currentUser)setCurrentUser(u=>({...u,nombre:data.nombre,avatar_url:data.avatar_url||u.avatar_url}));showToast("Perfil actualizado ✅");}}/>}
              {/* Sin ficha en el plantel, JugadorView revienta en su primera
                  línea (player.number) y React desmonta la app entera: pantalla
                  negra, sin mensaje. Le pasaba a cualquiera que entrara a un
                  club donde todavía no lo habían agregado al plantel — por
                  ejemplo, hasta hace poco, a quien se unía por invitación.
                  La guardia va acá y no dentro de la vista porque ahí quedaría
                  antes de sus hooks, y saltarse un hook rompe React de otra
                  forma cuando la ficha aparece. */}
              {module!=="home"&&module!=="miperfil"&&role==="jugador"&&!miJugador&&(
                <div style={{padding:"48px 16px",textAlign:"center",maxWidth:"420px",margin:"0 auto"}}>
                  <div style={{fontSize:"40px",marginBottom:"12px"}}>🎽</div>
                  <div style={{fontWeight:700,fontSize:"16px",marginBottom:"8px"}}>Todavía no tienes ficha en el plantel</div>
                  <div style={{fontSize:"13px",color:"var(--text-3)",lineHeight:1.6}}>
                    Ya eres parte del club, pero el administrador aún no te agregó
                    al plantel. Cuando lo haga vas a ver acá tu cuota, tu gym y
                    tus convocatorias.
                  </div>
                </div>
              )}
              {module!=="home"&&module!=="miperfil"&&role==="jugador"&&fichaAjena&&(
                <div style={{...ss.card,marginBottom:"14px",padding:"10px 14px",display:"flex",gap:"10px",alignItems:"center",
                  background:"rgba(201,132,8,0.08)",border:"1px solid rgba(201,132,8,0.3)",fontSize:"12px",color:"var(--text-2)"}}>
                  <span style={{fontSize:"15px"}}>👁️</span>
                  <span>
                    Estás viendo la ficha de <strong>{miJugador.name}</strong>, no la tuya: tu cuenta
                    todavía no está enlazada a un jugador del plantel. Sirve para mirar cómo lo ve
                    un jugador, pero estos datos no son tuyos.
                  </span>
                </div>
              )}
              {module!=="home"&&module!=="miperfil"&&role==="jugador"&&miJugador&&<JugadorView module={module} sport={sport} sp={sp} club={club} player={miJugador} players={playersVisibles} sportColor={sportColor} countryData={countryData} convocado={convocado} setConvocado={setConvocado} setWhatsappModal={setWhatsappModal} showToast={showToast} rankTab={rankTab} setRankTab={setRankTab} payments={payments} setPayments={setPayments} addPayment={clubId?addPayment:null} declarePayment={clubId?declarePayment:null} userCats={userCats} isDemo={isDemo} partidos={partidosVisibles} clubId={clubId} currentCategory={currentCategory}/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
