import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

import { SPORTS_CONFIG, COUNTRIES, CLUBS } from "./data/sports";
import { COMMISSION_DATA, CLUB_LIST, COUNTRY_COUNTS, MOCK_PAYMENTS, MOCK_PARTIDOS } from "./data/mockData";
import { usePlayers } from "./lib/usePlayers";
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

const ROLES = [
  {id:"superadmin",label:"Super Admin",icon:"⚡"},
  {id:"admin",label:"Admin Club",icon:"🏢"},
  {id:"entrenador",label:"Entrenador",icon:"📋"},
  {id:"preparador",label:"Preparador",icon:"💪"},
  {id:"jugador",label:"Jugador",icon:"👤"},
];

const MODULE_MAP = {
  superadmin:[{id:"home",label:"Inicio",icon:"🏠"},{id:"dashboard",label:"Dashboard Global",icon:"📊"},{id:"clubes",label:"Clubes",icon:"🏢"},{id:"membresias",label:"Membresías",icon:"💳"},{id:"comisiones",label:"Comisiones",icon:"💰"},{id:"comparativa",label:"vs SportEasy",icon:"📈"},{id:"vistaroles",label:"Vista Roles",icon:"👁️"}],
  admin:[{id:"home",label:"Inicio",icon:"🏠"},{id:"miclub",label:"Mi Club",icon:"🏢"},{id:"jugadores",label:"Jugadores",icon:"👥"},{id:"finanzas",label:"Finanzas",icon:"💰"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
  entrenador:[{id:"home",label:"Inicio",icon:"🏠"},{id:"muro",label:"El Muro",icon:"💬"},{id:"calendario",label:"Calendario",icon:"📅"},{id:"matchcenter",label:"Match Center",icon:"🏆"},{id:"nomina",label:"Nómina",icon:"📋"},{id:"estadisticas",label:"Estadísticas",icon:"📊"},{id:"asistencia",label:"Asistencia",icon:"✅"},{id:"salud",label:"Salud",icon:"🩺"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
  preparador:[{id:"home",label:"Inicio",icon:"🏠"},{id:"microciclo",label:"Microciclo",icon:"📅"},{id:"estadoplantel",label:"Estado Plantel",icon:"💪"},{id:"rankingfuerza",label:"Ranking Fuerza",icon:"🏋️"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
  jugador:[{id:"home",label:"Inicio",icon:"🏠"},{id:"midashboard",label:"Mi Dashboard",icon:"📊"},{id:"noticias",label:"Noticias",icon:"📰"},{id:"micuota",label:"Mi Cuota",icon:"💳"},{id:"migym",label:"Mi Gym",icon:"🏋️"},{id:"nominasclub",label:"Nóminas Club",icon:"📋"},{id:"miconvocatoria",label:"Mi Convocatoria",icon:"🎽"},{id:"miperfil",label:"Mi Perfil",icon:"👤"}],
};

const ROL_ICONS = {superadmin:"⚡",admin:"🏢",entrenador:"📋",preparador:"💪",jugador:"👤"};

export default function SportOS() {
  const [screen,setScreen]               = useState("landing");
  const [sport,setSport]                 = useState("rugby");
  const [country,setCountry]             = useState("CL");
  const [role,setRole]                   = useState("entrenador");
  const [module,setModule]               = useState("muro");
  const [category,setCategory]           = useState(0);
  const [toast,setToast]                 = useState(null);
  const [activeClubs,setActiveClubs]     = useState({rugby:true,futbol:true,basketball:true,handball:false,hockey:false});
  const [clubList,setClubList]           = useState(CLUB_LIST);
  const [postLikes,setPostLikes]         = useState({1:12,2:3,3:1,4:7});
  const [whatsappModal,setWhatsappModal] = useState(false);
  const [convocado,setConvocado]         = useState(null);
  const [rankTab,setRankTab]             = useState("volumen");
  const [gymLog,setGymLog]               = useState({});
  const [completedSession,setCompletedSession] = useState(false);
  const [newRecord,setNewRecord]         = useState(false);
  const [expandedEx,setExpandedEx]       = useState(null);
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
  const [upgradeFor,setUpgradeFor]       = useState(null); // id de feature bloqueada

  // Jugadores/club/pagos/partidos: datos reales de Supabase si hay club_id, vitrina demo si no
  const clubId = currentUser?.club_id ?? null;
  const { players, addPlayer, importOrUpdatePlayers, updatePlayer, removePlayer } = usePlayers(clubId);
  const { club: clubRow } = useClub(clubId);
  const { payments: realPayments, addPayment, setPayments: setRealPayments } = usePayments(clubId);
  const { partidos: realPartidos, setPartidos: setRealPartidos } = useMatches(clubId);
  const isDemo = currentUser === null;
  const userCats = isDemo ? [] : (currentUser.cats || []);

  // Badge de "Clubes" en el sidebar: cuántas solicitudes de club nuevas hay sin revisar
  const [clubRequestsUnseen, setClubRequestsUnseen] = useState(0);
  useEffect(() => {
    if (role !== "superadmin") return;
    supabase.from("club_requests").select("id", { count: "exact", head: true }).eq("visto", false)
      .then(({ count }) => setClubRequestsUnseen(count || 0));
  }, [role, module]);

  const payments = clubId ? realPayments : demoPayments;
  const setPayments = clubId ? setRealPayments : setDemoPayments;
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

  const goBack = () => {
    if (moduleHistory.length === 0) { setScreen("landing"); return; }
    const prev = moduleHistory[moduleHistory.length - 1];
    setModuleHistory(h => h.slice(0, -1));
    setModule(prev);
  };

  const sp           = SPORTS_CONFIG[sport];
  // Club real (nombre/colores de Supabase) con próximo/último partido derivados
  // de los partidos reales. Sin club_id (demo/preview) usa la vitrina CLUBS[sport].
  const jugados    = partidos.filter(p=>p.estado==="jugado").sort((a,b)=>b.fecha.localeCompare(a.fecha));
  const programados = partidos.filter(p=>p.estado==="programado").sort((a,b)=>a.fecha.localeCompare(b.fecha));
  const ultimo     = jugados[0];
  const proximo    = programados[0];
  const club = clubRow ? {
    name: clubRow.name,
    country: clubRow.country,
    cuota: 45000,
    prev: ultimo ? { res: ultimo.resultado==="victoria"?"Victoria":ultimo.resultado==="derrota"?"Derrota":"Empate", score: `${ultimo.golesLocal}-${ultimo.golesVisita}`, rival: ultimo.rival } : { res:null, score:null, rival:null },
    next: proximo ? { rival: proximo.rival, dia: new Date(proximo.fecha+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long"}) } : { rival:null, dia:null },
  } : CLUBS[sport];
  const countryData  = COUNTRIES[country];
  // Jugador logueado: su propia ficha (por profile_id), no simplemente el primero del plantel.
  const miJugador = (!isDemo && currentUser) ? (players.find(p=>p.profile_id===currentUser.id) || players[0]) : players[0];
  const sportColor   = sp.color;
  const currentCategory = sp.categories[category]||sp.categories[0];
  const sportModules = MODULE_MAP[role]||[];

  // Toast con soporte undo
  const showToast = (msg, type="success", onUndo=null) => setToast({msg, type, onUndo});

  // Atajo de teclado para búsqueda global
  useEffect(()=>{
    const handler = (e) => {
      if ((e.metaKey||e.ctrlKey) && e.key==="k") { e.preventDefault(); setSearchOpen(p=>!p); }
      if (e.key==="Escape") setSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return ()=>window.removeEventListener("keydown", handler);
  },[]);

  useEffect(()=>{setModule("home");setModuleHistory([]);},[role]);
  useEffect(()=>{setCategory(0);},[sport]);

  // Detecta sesión de Supabase al cargar (OAuth redirect o sesión guardada)
  useEffect(()=>{
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setScreen("newpassword");
        return;
      }
      if ((event === "SIGNED_IN" || event === "INITIAL_SESSION") && session?.user && !currentUser) {
        const u = session.user;
        // Buscar perfil en tabla profiles
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", u.id)
          .single();

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

        // Admin recién creado (ej. Google OAuth) sin club: mandar a configurar su club
        if (rolPerfil === "admin" && !esSuperAdmin && !profile?.club_id) {
          setPendingUser({ id: u.id, nombre: usuario.nombre, email: u.email });
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
      onBack={()=>{ setPendingUser(null); setScreen("login"); }}
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
        setCurrentUser({nombre:user.nombre, email:user.email, rol:rolFinal, club:user.club, club_id:user.club_id||null, cats:user.cats, plan:planFinal, avatar_url:user.avatar_url||null, isReal:true});
        setRole(rolFinal);
        setSport(user.sport||"rugby");
        setScreen("app");
      }}
      onDemo={()=>setScreen("onboarding")}
      onRegister={()=>setScreen("club-onboarding")}
    />
  );

  // Sin sesión activa y pantalla app → redirigir a login
  if(screen==="app" && !currentUser) { setScreen("login"); return null; }

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
      {whatsappModal&&<WhatsAppModal onClose={()=>setWhatsappModal(false)} team={club.name} rival={club.next.rival} date={club.next.dia}
        starters={SPORTS_CONFIG[sport].positions.slice(0,sp.teamSize).map((pos,i)=>({name:players[i]?players[i].name:"Jugador "+(i+1),pos}))}
        bench={[]}/>}

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
        <motion.div initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.4}}
          style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:"22px",color:sportColor,marginRight:"8px",whiteSpace:"nowrap",letterSpacing:"0.08em",display:"flex",alignItems:"center",gap:"6px",filter:`drop-shadow(0 0 14px ${sportColor}88)`}}>
          ⚡ SportOS
        </motion.div>
        {/* Selector de deporte y categoría: oculto para jugador real */}
        {(isDemo || role !== "jugador") && <>
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
          </div>
          <select className="hide-mobile" value={category} onChange={e=>setCategory(Number(e.target.value))} style={{...ss.input,width:"100px",fontSize:"12px",padding:"6px 10px",cursor:"pointer"}}>
            {sp.categories.map((c,i)=><option key={i} value={i}>{c}</option>)}
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
        <motion.div whileHover={{scale:1.1,rotate:5}} style={{width:"34px",height:"34px",borderRadius:"50%",background:`linear-gradient(135deg,${sportColor}44,${sportColor}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,color:sportColor,border:`2px solid ${sportColor}55`,flexShrink:0,boxShadow:`0 0 12px ${sportColor}44`,cursor:"pointer",overflow:"hidden"}}>
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
            <motion.div whileHover={{scale:1.05}} style={{width:"54px",height:"54px",borderRadius:"var(--r-md)",background:`linear-gradient(135deg,${sportColor}55,${sportColor}22)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",border:`2px solid ${sportColor}88`,margin:"0 auto 10px",boxShadow:`0 0 24px ${sportColor}66, inset 0 1px 0 ${sportColor}44`}}>{sp.icon}</motion.div>
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

          {/* Selector de rol para superadmin/admin elite */}
          {currentUser&&(
            <div style={{padding:"10px 12px",borderBottom:"1px solid var(--border-soft)"}}>
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
                  {m.id==="clubes" && clubRequestsUnseen>0 && (
                    <span style={{fontSize:"10px",flexShrink:0,padding:"1px 7px",borderRadius:"99px",background:sportColor,color:"#fff",fontWeight:800}}>{clubRequestsUnseen}</span>
                  )}
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
              {module==="home"&&<HomeView role={role} players={players} sportColor={sportColor} club={club} sp={sp} countryData={countryData} payments={payments} partidos={partidos} onNavigate={navigateTo} currentUser={currentUser} convocado={convocado} clubId={clubId}/>}
              {module!=="home"&&module!=="miperfil"&&role==="superadmin"&&<SuperAdminView module={module} commData={COMMISSION_DATA} clubList={clubList} setClubList={setClubList} showToast={showToast} COUNTRY_COUNTS={COUNTRY_COUNTS}
                rolePreviewProps={{players, sp, sportColor, club, countryData, payments, partidos, sport, userCats:[], isDemo:true, publishedPlan, setPublishedPlan, newExForm, setNewExForm, newEx, setNewEx, gymPlanExercises, setGymPlanExercises, rankTab, setRankTab, expandedDay, setExpandedDay}}
              />}
              {module!=="home"&&module!=="miperfil"&&role==="admin"&&<AdminView module={module} sport={sport} sp={sp} club={club} activeClubs={activeClubs} setActiveClubs={setActiveClubs} countryData={countryData} players={players} addPlayer={addPlayer} importOrUpdatePlayers={importOrUpdatePlayers} updatePlayer={updatePlayer} removePlayer={removePlayer} showToast={showToast} sportColor={sportColor} payments={payments} setPayments={setPayments} clubId={clubId} currentUser={currentUser} userPlan={userPlan}/>}
              {module!=="home"&&module!=="miperfil"&&role==="entrenador"&&<EntrenadorView module={module} sport={sport} sp={sp} club={club} players={players} postLikes={postLikes} setPostLikes={setPostLikes} showToast={showToast} sportColor={sportColor} currentCategory={currentCategory} hiaModal={hiaModal} setHiaModal={setHiaModal} userCats={userCats} isDemo={isDemo} partidos={partidos} setPartidos={setPartidos} clubId={clubId} currentUserId={currentUser?.id||null}/>}
              {module!=="home"&&module!=="miperfil"&&role==="preparador"&&<PreparadorView module={module} sp={sp} showToast={showToast} sportColor={sportColor} publishedPlan={publishedPlan} setPublishedPlan={setPublishedPlan} newExForm={newExForm} setNewExForm={setNewExForm} newEx={newEx} setNewEx={setNewEx} gymPlanExercises={gymPlanExercises} setGymPlanExercises={setGymPlanExercises} rankTab={rankTab} setRankTab={setRankTab} expandedDay={expandedDay} setExpandedDay={setExpandedDay} userCats={userCats} isDemo={isDemo} players={players}/>}
              {module==="miperfil"&&<PerfilView currentUser={currentUser} sport={sport} sportColor={sportColor} onSaved={(data)=>{if(currentUser)setCurrentUser(u=>({...u,nombre:data.nombre,avatar_url:data.avatar_url||u.avatar_url}));showToast("Perfil actualizado ✅");}}/>}
              {module!=="home"&&module!=="miperfil"&&role==="jugador"&&<JugadorView module={module} sport={sport} sp={sp} club={club} player={miJugador} players={players} sportColor={sportColor} countryData={countryData} convocado={convocado} setConvocado={setConvocado} setWhatsappModal={setWhatsappModal} showToast={showToast} gymLog={gymLog} setGymLog={setGymLog} completedSession={completedSession} setCompletedSession={setCompletedSession} newRecord={newRecord} setNewRecord={setNewRecord} expandedEx={expandedEx} setExpandedEx={setExpandedEx} rankTab={rankTab} setRankTab={setRankTab} payments={payments} setPayments={setPayments} addPayment={clubId?addPayment:null} userCats={userCats} isDemo={isDemo} partidos={partidos} clubId={clubId}/>}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
