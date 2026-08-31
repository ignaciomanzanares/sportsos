import { useState, useEffect } from "react";
import { m as motion, AnimatePresence } from "framer-motion";

// ── Design tokens (scoped to this Landing — no app theme dependency) ────────
const T = {
  bg:        "#08080A",
  bgCard:    "#0D0D0F",
  bgSection: "#0B0B0D",
  accent:    "#C9F527",   // chartreuse eléctrico — reflectores sobre pasto
  danger:    "#FF3230",
  gold:      "#D4A820",
  text:      "#F0EDE5",   // blanco cálido
  text2:     "#7A7770",
  text3:     "#454340",
  border:    "rgba(240,237,229,0.07)",
  borderAcc: "rgba(201,245,39,0.2)",
};

const FF = {
  display: "'Bebas Neue', cursive",
  body:    "'Archivo', sans-serif",
  mono:    "'Space Mono', monospace",
};

// ── Data ─────────────────────────────────────────────────────────────────────
const SPORTS = [
  { icon:"🏉", name:"Rugby",      color:"#1FA04A" },
  { icon:"⚽", name:"Fútbol",     color:"#0896B0" },
  { icon:"🏀", name:"Basketball", color:"#C0392B" },
  { icon:"🤾", name:"Handball",   color:"#C98408" },
  { icon:"🏑", name:"Hockey",     color:"#8040CC" },
];

const PAIN_VS = [
  { antes:"Lista de asistencia en papel o WhatsApp",        despues:"Marcas en 1 toque desde el celular, se guarda solo" },
  { antes:"Cobros de cuota por transferencia y sin control", despues:"Cobro masivo con 1 click y reporte en tiempo real" },
  { antes:"Jugadores en una planilla Excel desactualizada",  despues:"Plantel completo con estado médico, cuota y posición" },
  { antes:"Nómina del partido por WhatsApp el día antes",    despues:"Nómina publicada en la app, el jugador confirma presencia" },
  { antes:"Preparador físico manda el plan por foto de hoja", despues:"Microciclo publicado digital, los jugadores lo ven en su celular" },
  { antes:"Sin registro de lesiones ni wellness del plantel", despues:"Alerta automática post-partido con cuestionario Hooper Index" },
];

const STEPS = [
  { num:"01", icon:"🏢", title:"Crea tu club",      desc:"En 3 minutos configuras el club, eliges el deporte y listo. Sin tarjeta de crédito." },
  { num:"02", icon:"🔗", title:"Invita a tu equipo", desc:"Genera un link por rol — entrenador, preparador, jugador. Cada uno ve solo lo que le corresponde." },
  { num:"03", icon:"⚡", title:"Todo en un lugar",   desc:"Asistencia, resultados, finanzas, wellness y comunicación. Sin Excel, sin WhatsApp caótico." },
];

const ROLES_FEATURES = {
  admin: {
    label:"Admin del Club", icon:"🏢", color:"#3B82F6",
    desc:"Tienes el control total del club sin perder tiempo en administración.",
    features:[
      { icon:"👥", title:"Plantel completo",       desc:"Todos los jugadores con estado médico, cuota y categoría." },
      { icon:"💰", title:"Finanzas en tiempo real", desc:"Ve quién pagó, quién debe y cobra masivamente." },
      { icon:"🔗", title:"Invitaciones por link",   desc:"Invita a entrenadores y jugadores con un link. Cada uno entra con su rol." },
      { icon:"📊", title:"Reportes automáticos",    desc:"Exporta el estado financiero del club en un click." },
    ],
  },
  entrenador: {
    label:"Entrenador", icon:"📋", color:"#C98408",
    desc:"Menos tiempo en papeleo, más tiempo en la cancha.",
    features:[
      { icon:"📋", title:"Nómina con drag & drop", desc:"Arma el equipo titular y banco arrastrando jugadores." },
      { icon:"✅", title:"Asistencia digital",     desc:"Cada jugador marca su presencia. Tú ves el resumen al instante." },
      { icon:"🏆", title:"Match Center",           desc:"Carga resultado, tarjetas y estadísticas. Se notifica solo." },
      { icon:"💬", title:"El Muro",                desc:"Publica avisos, resultados e insignias para el equipo." },
    ],
  },
  preparador: {
    label:"Preparador Físico", icon:"💪", color:"#C0392B",
    desc:"Monitorea la carga y el estado del plantel en un solo lugar.",
    features:[
      { icon:"📅", title:"Microciclo semanal",  desc:"Publica el plan de entrenamiento. Los jugadores lo ven en su celular." },
      { icon:"💪", title:"Estado del plantel",  desc:"Wellness post-partido con cuestionario Hooper Index automático." },
      { icon:"🏋️", title:"Ranking de fuerza",  desc:"Compara el rendimiento físico del plantel en tiempo real." },
      { icon:"🚑", title:"Lesiones y golpes",   desc:"Registra el mapa de golpes post-partido y gestiona suspensiones." },
    ],
  },
  jugador: {
    label:"Jugador", icon:"👤", color:"#1FA04A",
    desc:"El jugador sabe exactamente qué tiene que hacer y cuándo.",
    features:[
      { icon:"🎽", title:"¿Estoy convocado?",  desc:"Ve su estado de convocatoria al abrir la app. Sin llamadas." },
      { icon:"💳", title:"Mi cuota",           desc:"Paga directamente desde la app. Sin transferencias manuales." },
      { icon:"🏋️", title:"Mi Gym",            desc:"Registra sus series, pesos y ve su progreso semana a semana." },
      { icon:"📰", title:"Noticias del club",  desc:"Resultados, avisos del entrenador y logros del equipo." },
    ],
  },
};


// Los planes existen como estructura en el código, pero hoy no cobran nada:
// FEATURE_PLAN tiene todas las funciones en "free" y no hay ninguna pasarela
// de suscripción conectada. Así que las listas dicen qué trae cada uno cuando
// se activen, y arriba de la sección se avisa que hoy está todo abierto.
//
// Se fueron de acá: el "Probar 14 días gratis" (no hay prueba, no hay cobro),
// los límites de "hasta 25 jugadores" y "1 categoría" (no los aplica nadie),
// y "Soporte prioritario" y "Onboarding dedicado", que no existen.
const PLANS = [
  { name:"Starter", price:"$0",  period:"/ mes",     color:"#6B7896", badge:null,
    cta:"Empezar gratis",  features:["Plantel y asistencia","El Muro","Calendario del torneo"] },
  { name:"Pro",     price:"$29", period:"USD / mes", color:T.accent,  badge:"MÁS POPULAR",
    cta:"Empezar gratis",  features:["Match Center + nóminas","Estadísticas del torneo","Panel de salud","Finanzas del club"] },
  { name:"Elite",   price:"$59", period:"USD / mes", color:"#C98408", badge:null,
    cta:"Empezar gratis",  features:["Todo lo de Pro","Varios deportes","Microciclo y ranking de fuerza","Wellness del plantel"] },
];

const FAQS = [
  { q:"¿Necesito saber de tecnología para usar SportOS?", a:"No. Si sabes usar WhatsApp, sabes usar SportOS. El setup inicial tarda menos de 5 minutos y te guiamos en cada paso." },
  { q:"¿Funciona en celular?",                            a:"Sí, está pensado primero para el celular, y se puede agregar a la pantalla de inicio como una app. Los jugadores ven la nómina, marcan asistencia y consultan los datos para transferir su cuota desde el teléfono. Sigue funcionando sin señal, que es lo normal en una cancha." },
  { q:"¿Qué pasa con los datos de mis jugadores?",        a:"Son del club. Viajan cifrados y cada club solo ve los suyos. Los datos personales — RUT, teléfono, ficha médica — los ve el propio jugador y el cuerpo técnico, no el resto del plantel. Nunca los compartimos ni los vendemos." },
  { q:"¿Cuánto cuesta hoy?",                              a:"Nada. Todas las funciones están abiertas en todos los planes mientras la plataforma crece. Cuando eso cambie se va a avisar antes, y nunca se va a cobrar sin que lo autorices." },
  { q:"¿Funciona para cualquier deporte?",                a:"Está construido para rugby, que es donde se usa todos los días. Fútbol, handball, básquetbol y hockey ya tienen sus posiciones y estadísticas cargadas, pero todavía no los usa ningún club: si sos el primero, esperá que falte algo." },
  { q:"¿Qué pasa si mi club tiene varias categorías?",    a:"Se manejan todas — M6 a M18, Adulta — cada una con su plantel, su calendario y sus nóminas. El torneo oficial solo publica estadísticas de las divisiones adultas; en las menores queda el calendario y lo que cargue el club." },
];

// ── Micro-componentes ─────────────────────────────────────────────────────────

function Wrap({ children, style = {} }) {
  return (
    <section style={{
      position:"relative", zIndex:1,
      padding:"clamp(60px,8vw,100px) clamp(20px,5vw,80px)",
      ...style,
    }}>
      {children}
    </section>
  );
}

function Eyebrow({ children }) {
  return (
    <motion.div
      initial={{ opacity:0, y:8 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
      style={{ display:"inline-flex", alignItems:"center", gap:"10px", marginBottom:"18px" }}
    >
      <div style={{ width:"24px", height:"2px", background:T.accent }} />
      <span style={{ fontFamily:FF.mono, fontSize:"10px", fontWeight:700, color:T.accent,
        textTransform:"uppercase", letterSpacing:"0.15em" }}>
        {children}
      </span>
    </motion.div>
  );
}

function BigH({ children, style = {} }) {
  return (
    <motion.h2
      initial={{ opacity:0, y:14 }} whileInView={{ opacity:1, y:0 }} viewport={{ once:true }}
      style={{ fontFamily:FF.display, fontSize:"clamp(44px,6vw,72px)", fontWeight:400,
        lineHeight:0.98, letterSpacing:"0.01em", color:T.text, margin:"0 0 20px", ...style }}
    >
      {children}
    </motion.h2>
  );
}

function HR() {
  return <div style={{ height:"1px", background:T.border }} />;
}

// ── Componente principal ──────────────────────────────────────────────────────

export default function LandingPage({ onLogin, onRegister, onJoinRequest }) {
  const [activeSport, setActiveSport] = useState(0);
  const [activeRole,  setActiveRole]  = useState("entrenador");
  const [openFaq,     setOpenFaq]     = useState(null);
  const [email,       setEmail]       = useState("");

  const sport    = SPORTS[activeSport];
  const roleData = ROLES_FEATURES[activeRole];

  // Inyectar tipografías
  useEffect(() => {
    const id = "sportosLandingFonts";
    if (document.getElementById(id)) return;
    const link   = document.createElement("link");
    link.id      = id;
    link.rel     = "stylesheet";
    link.href    = "https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Archivo:wght@400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap";
    document.head.appendChild(link);
    return () => { const el = document.getElementById(id); if (el) el.remove(); };
  }, []);

  const handleCTA = () => {
    if (email.trim()) setTimeout(() => onRegister(), 200);
    else onRegister();
  };

  const btn = {
    border:"none", borderRadius:"2px", cursor:"pointer",
    fontFamily:FF.body, fontWeight:700, fontSize:"14px",
    padding:"12px 24px", display:"inline-flex", alignItems:"center",
    gap:"6px", transition:"all 0.15s ease",
  };

  const inp = {
    background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:"2px",
    color:T.text, fontFamily:FF.body, fontSize:"14px",
    padding:"12px 16px", outline:"none",
  };

  const card = {
    background:T.bgCard, border:`1px solid ${T.border}`,
    borderRadius:"2px", padding:"24px",
  };

  return (
    <div
      className="sportosLanding"
      style={{
        position:"relative", minHeight:"100vh", height:"100vh",
        background:T.bg, color:T.text, fontFamily:FF.body,
        overflowX:"hidden", overflowY:"auto",
      }}
    >
      {/* Estilos globales para esta página */}
      <style>{`
        .sportosLanding * { -webkit-font-smoothing: antialiased; }
        .sportosLanding input::placeholder { color: #454340; }
        .sportosCtaInv input::placeholder  { color: rgba(8,8,10,0.38); }
      `}</style>

      {/* Textura de grano */}
      <div style={{
        position:"fixed", inset:0, pointerEvents:"none", zIndex:200,
        backgroundImage:`url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
        backgroundSize:"256px 256px", opacity:0.03,
      }} />

      {/* ── NAV ─────────────────────────────────────────────────────────── */}
      <nav style={{
        position:"sticky", top:0, zIndex:50,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"0 clamp(20px,5vw,80px)", height:"56px",
        background:"rgba(8,8,10,0.92)", backdropFilter:"blur(20px)",
        borderBottom:`1px solid ${T.border}`,
      }}>
        <div style={{ fontFamily:FF.display, fontSize:"22px", letterSpacing:"0.05em", lineHeight:1 }}>
          <span style={{ color:T.accent }}>SPORT</span>
          <span style={{ color:T.text }}>OS</span>
        </div>
        <div style={{ display:"flex", gap:"8px", alignItems:"center" }}>
          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={onLogin}
            style={{ ...btn, background:"transparent", color:T.text2,
              border:`1px solid ${T.border}`, fontSize:"13px", padding:"8px 16px" }}>
            Ingresar
          </motion.button>
          {onJoinRequest && (
            <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.97 }} onClick={onJoinRequest}
              style={{ ...btn, background:"transparent", color:T.accent,
                border:`1px solid ${T.borderAcc}`, fontSize:"13px", padding:"8px 16px" }}>
              Tengo un código
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale:1.03, y:-1, boxShadow:`0 8px 24px rgba(201,245,39,0.35)` }}
            whileTap={{ scale:0.97 }} onClick={onRegister}
            style={{ ...btn, background:T.accent, color:T.bg, fontSize:"13px",
              padding:"8px 20px", boxShadow:`0 0 18px rgba(201,245,39,0.25)` }}>
            Crear club →
          </motion.button>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section style={{
        position:"relative", zIndex:1, minHeight:"calc(100vh - 56px)",
        display:"flex", flexDirection:"column", justifyContent:"center",
        padding:"80px clamp(20px,5vw,80px)",
        backgroundImage:`
          repeating-linear-gradient(0deg, transparent, transparent 79px, rgba(240,237,229,0.022) 80px),
          repeating-linear-gradient(90deg, transparent, transparent 79px, rgba(240,237,229,0.012) 80px)
        `,
      }}>
        {/* Marca de agua grande */}
        <div style={{
          position:"absolute", right:"-3%", top:"50%", transform:"translateY(-50%)",
          fontFamily:FF.display, fontSize:"clamp(140px,19vw,270px)", lineHeight:0.88,
          color:"rgba(201,245,39,0.04)", pointerEvents:"none", userSelect:"none",
          letterSpacing:"0.02em", whiteSpace:"nowrap",
        }}>
          SPORT<br />OS
        </div>

        {/* Selector de deporte */}
        <div style={{ display:"flex", gap:"6px", marginBottom:"32px", flexWrap:"wrap" }}>
          {SPORTS.map((s, i) => (
            <motion.button key={i} whileHover={{ scale:1.05 }} whileTap={{ scale:0.95 }}
              onClick={() => setActiveSport(i)}
              style={{
                padding:"5px 12px", borderRadius:"2px", cursor:"pointer",
                fontFamily:FF.body, fontSize:"12px", fontWeight:600,
                border:`1px solid ${i === activeSport ? s.color+"66" : T.border}`,
                background:i === activeSport ? `${s.color}18` : "transparent",
                color:i === activeSport ? s.color : T.text3,
                transition:"all 0.18s",
              }}>
              {s.icon} {s.name}
            </motion.button>
          ))}
        </div>

        {/* Etiqueta de dolor */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.05 }}
          style={{ display:"inline-flex", alignItems:"center", gap:"8px", marginBottom:"20px" }}>
          <div style={{ width:"2px", height:"16px", background:T.danger }} />
          <span style={{ fontFamily:FF.mono, fontSize:"11px", color:T.danger,
            fontWeight:700, textTransform:"uppercase", letterSpacing:"0.1em" }}>
            ¿Todavía gestionas tu club con Excel y WhatsApp?
          </span>
        </motion.div>

        {/* Titular principal */}
        <AnimatePresence mode="wait">
          <motion.h1 key={activeSport}
            initial={{ opacity:0, y:22 }} animate={{ opacity:1, y:0 }}
            exit={{ opacity:0, y:-22 }} transition={{ duration:0.35 }}
            style={{
              fontFamily:FF.display, fontSize:"clamp(52px,8.5vw,112px)",
              fontWeight:400, lineHeight:0.92, letterSpacing:"0.01em",
              margin:"0 0 24px", maxWidth:"860px",
            }}>
            <span style={{ color:T.text }}>TU CLUB DE </span>
            <span style={{ color:sport.color }}>{sport.name.toUpperCase()}</span>
            <br />
            <span style={{ color:T.text }}>MERECE </span>
            <span style={{
              WebkitTextStroke:`2px ${T.accent}`,
              color:"transparent",
            }}>
              ALGO MEJOR
            </span>
          </motion.h1>
        </AnimatePresence>

        {/* Subtítulo */}
        <motion.p initial={{ opacity:0 }} animate={{ opacity:1 }} transition={{ delay:0.2 }}
          style={{ fontSize:"clamp(15px,1.8vw,18px)", color:T.text2, maxWidth:"560px",
            lineHeight:1.65, margin:"0 0 40px", fontWeight:400 }}>
          SportOS reemplaza las planillas, los grupos de WhatsApp y el caos administrativo.
          Plantel, asistencia, finanzas, wellness y comunicación — todo en un solo lugar.
        </motion.p>

        {/* CTA */}
        <motion.div initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }} transition={{ delay:0.3 }}
          style={{ display:"flex", gap:"8px", flexWrap:"wrap", alignItems:"center", marginBottom:"14px" }}>
          <input value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleCTA()}
            placeholder="tu@email.com" style={{ ...inp, width:"220px" }} />
          <motion.button
            whileHover={{ scale:1.03, y:-2, boxShadow:`0 14px 36px rgba(201,245,39,0.38)` }}
            whileTap={{ scale:0.97 }} onClick={handleCTA}
            style={{ ...btn, background:T.accent, color:T.bg, fontSize:"15px",
              padding:"12px 32px", boxShadow:`0 6px 22px rgba(201,245,39,0.28)` }}>
            Empezar gratis →
          </motion.button>
        </motion.div>
        <div style={{ fontFamily:FF.mono, fontSize:"11px", color:T.text3, letterSpacing:"0.05em" }}>
          Gratis · Sin tarjeta de crédito · Cancela cuando quieras
        </div>

        {/* Stats */}
        <div style={{
          display:"flex", gap:"clamp(24px,5vw,56px)", marginTop:"68px",
          paddingTop:"28px", borderTop:`1px solid ${T.border}`, flexWrap:"wrap",
        }}>
          {/* Acá decía "65+ clubes activos" y "3 países LATAM". No es cierto:
              hay un club, en Chile. También "4h ahorradas/sem", que no se
              midió nunca. Quedan las cifras que se pueden comprobar mirando la
              app, que además son las que de verdad dicen algo. */}
          {[["5","deportes"],["6","temporadas de historial"],["23","por nómina"],["5","roles"]].map(([n, l], i) => (
            <motion.div key={i} initial={{ opacity:0, y:10 }} animate={{ opacity:1, y:0 }}
              transition={{ delay:0.4 + i * 0.08 }}>
              <div style={{ fontFamily:FF.display, fontSize:"clamp(32px,5vw,48px)",
                color:T.accent, lineHeight:1 }}>{n}</div>
              <div style={{ fontFamily:FF.mono, fontSize:"10px", color:T.text3,
                marginTop:"4px", textTransform:"uppercase", letterSpacing:"0.12em" }}>{l}</div>
            </motion.div>
          ))}
        </div>
      </section>

      <HR />

      {/* ── ANTES / DESPUÉS ──────────────────────────────────────────────── */}
      <Wrap style={{ background:T.bgSection }}>
        <div style={{ maxWidth:"960px", margin:"0 auto" }}>
          <Eyebrow>El problema que resolvemos</Eyebrow>
          <BigH>DEJA EL CAOS ATRÁS</BigH>
          <p style={{ color:T.text2, fontSize:"15px", maxWidth:"540px",
            lineHeight:1.65, margin:"0 0 48px" }}>
            Esto es lo que viven hoy la mayoría de clubes en LATAM — y cómo SportOS lo cambia.
          </p>

          {/* Cabecera tabla */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 40px 1fr", marginBottom:"12px" }}>
            <div style={{ paddingBottom:"10px", borderBottom:`2px solid ${T.danger}` }}>
              <span style={{ fontFamily:FF.mono, fontSize:"10px", fontWeight:700,
                color:T.danger, textTransform:"uppercase", letterSpacing:"0.12em" }}>✕ Antes</span>
            </div>
            <div />
            <div style={{ paddingBottom:"10px", borderBottom:"2px solid #1FA04A" }}>
              <span style={{ fontFamily:FF.mono, fontSize:"10px", fontWeight:700,
                color:"#1FA04A", textTransform:"uppercase", letterSpacing:"0.12em" }}>✓ Con SportOS</span>
            </div>
          </div>

          {PAIN_VS.map((row, i) => (
            <motion.div key={i}
              initial={{ opacity:0, x:-16 }} whileInView={{ opacity:1, x:0 }}
              viewport={{ once:true }} transition={{ delay:i * 0.06 }}
              style={{ display:"grid", gridTemplateColumns:"1fr 40px 1fr",
                alignItems:"stretch", borderBottom:`1px solid ${T.border}` }}>
              <div style={{ padding:"16px 16px 16px 0", fontSize:"13px", color:T.text2,
                lineHeight:1.55, borderRight:`1px solid ${T.border}` }}>
                {row.antes}
              </div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"center",
                fontFamily:FF.mono, fontSize:"14px", fontWeight:700, color:T.accent }}>
                →
              </div>
              <div style={{ padding:"16px 0 16px 16px", fontSize:"13px", color:T.text,
                lineHeight:1.55, fontWeight:500 }}>
                {row.despues}
              </div>
            </motion.div>
          ))}
        </div>
      </Wrap>

      <HR />

      {/* ── CÓMO FUNCIONA ────────────────────────────────────────────────── */}
      <Wrap>
        <div style={{ maxWidth:"960px", margin:"0 auto" }}>
          <Eyebrow>Cómo funciona</Eyebrow>
          <BigH>EN 3 PASOS, MENOS DE 5 MINUTOS</BigH>
          {/* Grid con separadores */}
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",
            gap:"1px", background:T.border, border:`1px solid ${T.border}`,
          }}>
            {STEPS.map((step, i) => (
              <motion.div key={i}
                initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay:i * 0.1 }}
                style={{ ...card, borderRadius:0, border:"none",
                  position:"relative", overflow:"hidden", padding:"36px 28px" }}>
                {/* Número de fondo */}
                <div style={{
                  position:"absolute", bottom:"-20px", right:"10px",
                  fontFamily:FF.display, fontSize:"120px", lineHeight:1,
                  color:"rgba(201,245,39,0.04)", userSelect:"none",
                }}>
                  {step.num}
                </div>
                <div style={{ width:"28px", height:"3px", background:T.accent, marginBottom:"28px" }} />
                <div style={{ fontFamily:FF.display, fontSize:"18px", color:T.accent,
                  letterSpacing:"0.1em", marginBottom:"10px" }}>{step.num}</div>
                <div style={{ fontSize:"30px", marginBottom:"12px" }}>{step.icon}</div>
                <div style={{ fontFamily:FF.body, fontWeight:700, fontSize:"16px",
                  marginBottom:"8px", color:T.text }}>{step.title}</div>
                <div style={{ fontSize:"13px", color:T.text2, lineHeight:1.65 }}>{step.desc}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </Wrap>

      <HR />

      {/* ── FEATURES POR ROL ─────────────────────────────────────────────── */}
      <Wrap style={{ background:T.bgSection }}>
        <div style={{ maxWidth:"960px", margin:"0 auto" }}>
          <Eyebrow>Diseñado para cada rol</Eyebrow>
          <BigH>CADA USUARIO VE LO QUE NECESITA</BigH>
          <p style={{ color:T.text2, fontSize:"15px", maxWidth:"540px",
            lineHeight:1.65, margin:"0 0 32px" }}>
            Entrenadores, preparadores, admins y jugadores tienen su propia vista.
            Sin información de más ni de menos.
          </p>

          {/* Tabs de rol */}
          <div style={{
            display:"flex", gap:"0", marginBottom:"28px", flexWrap:"wrap",
            border:`1px solid ${T.border}`, borderRadius:"2px", overflow:"hidden",
          }}>
            {Object.entries(ROLES_FEATURES).map(([key, r]) => (
              <motion.button key={key} whileTap={{ scale:0.98 }}
                onClick={() => setActiveRole(key)}
                style={{
                  padding:"10px 20px", border:"none",
                  borderRight:`1px solid ${T.border}`, cursor:"pointer",
                  fontFamily:FF.body, fontSize:"13px",
                  fontWeight:activeRole === key ? 700 : 500,
                  background:activeRole === key ? `${r.color}18` : "transparent",
                  color:activeRole === key ? r.color : T.text2,
                  borderBottom:activeRole === key ? `2px solid ${r.color}` : "2px solid transparent",
                  transition:"all 0.18s", flex:"1 1 auto", minWidth:"100px",
                }}>
                {r.icon} {r.label}
              </motion.button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.div key={activeRole}
              initial={{ opacity:0, y:8 }} animate={{ opacity:1, y:0 }}
              exit={{ opacity:0, y:-8 }} transition={{ duration:0.25 }}>
              <p style={{ fontSize:"14px", color:T.text2, marginBottom:"20px", lineHeight:1.6 }}>
                {roleData.desc}
              </p>
              <div style={{
                display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",
                gap:"12px",
              }}>
                {roleData.features.map((f, i) => (
                  <motion.div key={i}
                    initial={{ opacity:0, x:-8 }} animate={{ opacity:1, x:0 }}
                    transition={{ delay:i * 0.06 }}
                    style={{
                      ...card,
                      borderLeft:`3px solid ${roleData.color}`,
                      display:"flex", flexDirection:"column", gap:"10px",
                      background:`linear-gradient(135deg, ${roleData.color}07, transparent)`,
                    }}>
                    <div style={{ fontSize:"22px" }}>{f.icon}</div>
                    <div style={{ fontWeight:700, fontSize:"14px", color:T.text }}>{f.title}</div>
                    <div style={{ fontSize:"12px", color:T.text2, lineHeight:1.55 }}>{f.desc}</div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </Wrap>

      {/* Acá había tres testimonios de clientes bajo el título "CLUBES
          REALES. RESULTADOS REALES": Carlos Vega, María Torres y Diego
          Fuentes, cinco estrellas cada uno. No existen. La plataforma tiene
          un club, y publicar elogios inventados como si fueran de clientes
          es lo único de esta página que no se puede arreglar después. */}

      {/* ── PLANES ───────────────────────────────────────────────────────── */}
      <Wrap style={{ background:T.bgSection }}>
        <div style={{ maxWidth:"960px", margin:"0 auto" }}>
          <Eyebrow>Planes</Eyebrow>
          <BigH>SIMPLE Y TRANSPARENTE</BigH>
          <p style={{ color:T.text2, fontSize:"15px", maxWidth:"460px",
            lineHeight:1.65, margin:"0 0 20px" }}>
            Sin costos ocultos. Sin contratos anuales forzados. Cancela cuando quieras.
          </p>
          {/* Lo dice acá y no en letra chica: mostrar tres precios sin aclarar
              que hoy no se cobra nada es dejar que el que lee saque la
              conclusión equivocada. La app ya lo avisa por dentro; la página
              que lo promete tiene que decir lo mismo. */}
          <p style={{ color:T.accent, fontFamily:FF.mono, fontSize:"12px",
            maxWidth:"520px", lineHeight:1.7, margin:"0 0 44px" }}>
            HOY TODO ESTÁ ABIERTO EN TODOS LOS PLANES, GRATIS. ESTOS PRECIOS SON
            A DÓNDE VA LA PLATAFORMA, NO LO QUE SE COBRA AHORA.
          </p>
          <div style={{
            display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",
            gap:"16px",
          }}>
            {PLANS.map((plan, i) => (
              <motion.div key={i}
                initial={{ opacity:0, y:20 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay:i * 0.1 }}
                style={{
                  ...card, position:"relative", overflow:"hidden",
                  borderTop:`3px solid ${plan.color}`,
                  background:plan.badge
                    ? `linear-gradient(160deg, ${plan.color}09, transparent)`
                    : T.bgCard,
                }}>
                {plan.badge && (
                  <div style={{
                    position:"absolute", top:"14px", right:"14px",
                    fontFamily:FF.mono, fontSize:"9px", fontWeight:700,
                    padding:"4px 10px", background:plan.color,
                    color:plan.badge && plan.color === T.accent ? T.bg : "#fff",
                    letterSpacing:"0.1em",
                  }}>
                    {plan.badge}
                  </div>
                )}
                <div style={{ fontFamily:FF.mono, fontSize:"10px", fontWeight:700,
                  color:plan.color, marginBottom:"12px", textTransform:"uppercase",
                  letterSpacing:"0.1em" }}>{plan.name}</div>
                <div style={{ display:"flex", alignItems:"baseline", gap:"4px", marginBottom:"4px" }}>
                  <span style={{ fontFamily:FF.display, fontSize:"48px", lineHeight:1,
                    color:T.text }}>{plan.price}</span>
                  <span style={{ fontFamily:FF.mono, fontSize:"10px", color:T.text3 }}>{plan.period}</span>
                </div>
                <div style={{ height:"1px", background:T.border, margin:"20px 0" }} />
                <div style={{ display:"flex", flexDirection:"column", gap:"10px", marginBottom:"24px" }}>
                  {plan.features.map((f, j) => (
                    <div key={j} style={{ display:"flex", gap:"8px", alignItems:"flex-start", fontSize:"13px" }}>
                      <span style={{ color:plan.color, fontWeight:700, flexShrink:0, marginTop:"1px" }}>✓</span>
                      <span style={{ color:T.text2 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <motion.button
                  whileHover={{ scale:1.02, y:-1 }} whileTap={{ scale:0.97 }}
                  onClick={onRegister}
                  style={{
                    ...btn, width:"100%", justifyContent:"center",
                    background:plan.badge ? plan.color : "transparent",
                    color:plan.badge
                      ? (plan.color === T.accent ? T.bg : "#fff")
                      : plan.color,
                    border:`1px solid ${plan.color}55`,
                    boxShadow:plan.badge ? `0 4px 18px ${plan.color}44` : "none",
                    fontSize:"13px",
                  }}>
                  {plan.cta}
                </motion.button>
              </motion.div>
            ))}
          </div>
        </div>
      </Wrap>

      <HR />

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <Wrap>
        <div style={{ maxWidth:"720px", margin:"0 auto" }}>
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <BigH>TODO LO QUE NECESITAS SABER</BigH>
          <div style={{ display:"flex", flexDirection:"column" }}>
            {FAQS.map((faq, i) => (
              <motion.div key={i}
                initial={{ opacity:0, y:6 }} whileInView={{ opacity:1, y:0 }}
                viewport={{ once:true }} transition={{ delay:i * 0.05 }}
                style={{ borderBottom:`1px solid ${T.border}` }}>
                <button onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  style={{ width:"100%", display:"flex", justifyContent:"space-between",
                    alignItems:"center", padding:"20px 0", background:"transparent",
                    border:"none", cursor:"pointer", textAlign:"left", gap:"16px" }}>
                  <span style={{ fontSize:"14px", fontWeight:600, color:T.text, lineHeight:1.45 }}>
                    {faq.q}
                  </span>
                  <motion.div
                    animate={{ rotate:openFaq === i ? 45 : 0 }}
                    transition={{ duration:0.2 }}
                    style={{
                      width:"24px", height:"24px", flexShrink:0,
                      border:`1px solid ${openFaq === i ? T.accent : T.border}`,
                      borderRadius:"2px",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      color:openFaq === i ? T.accent : T.text3,
                      fontSize:"18px", fontWeight:300,
                    }}>
                    +
                  </motion.div>
                </button>
                <AnimatePresence>
                  {openFaq === i && (
                    <motion.div
                      initial={{ height:0, opacity:0 }} animate={{ height:"auto", opacity:1 }}
                      exit={{ height:0, opacity:0 }} transition={{ duration:0.22 }}
                      style={{ overflow:"hidden" }}>
                      <p style={{ padding:"0 0 20px", fontSize:"13px",
                        color:T.text2, lineHeight:1.7, margin:0 }}>
                        {faq.a}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </div>
        </div>
      </Wrap>

      {/* ── CTA FINAL — sección invertida (fondo chartreuse) ─────────────── */}
      <section
        className="sportosCtaInv"
        style={{
          position:"relative", zIndex:1, overflow:"hidden",
          background:T.accent,
          padding:"clamp(60px,8vw,100px) clamp(20px,5vw,80px)",
        }}>
        {/* Marca de agua */}
        <div style={{
          position:"absolute", right:"-4%", top:"50%", transform:"translateY(-50%)",
          fontFamily:FF.display, fontSize:"clamp(120px,18vw,240px)", lineHeight:0.85,
          color:"rgba(8,8,10,0.06)", pointerEvents:"none", userSelect:"none",
          letterSpacing:"0.02em",
        }}>
          SPORT<br />OS
        </div>

        <div style={{ maxWidth:"640px", position:"relative" }}>
          <div style={{ fontFamily:FF.mono, fontSize:"11px", fontWeight:700,
            color:"rgba(8,8,10,0.45)", textTransform:"uppercase", letterSpacing:"0.15em",
            marginBottom:"18px", display:"flex", alignItems:"center", gap:"10px" }}>
            <div style={{ width:"24px", height:"2px", background:"rgba(8,8,10,0.3)" }} />
            Únete hoy
          </div>

          <h2 style={{
            fontFamily:FF.display, fontSize:"clamp(44px,7vw,88px)", fontWeight:400,
            color:T.bg, lineHeight:0.93, margin:"0 0 20px", letterSpacing:"0.01em",
          }}>
            TU CLUB MERECE<br />UNA HERRAMIENTA<br />A SU ALTURA
          </h2>

          <p style={{ fontSize:"16px", color:"rgba(8,8,10,0.58)",
            marginBottom:"36px", lineHeight:1.6, maxWidth:"460px" }}>
            Dejá el Excel y el grupo de WhatsApp. Creá tu club gratis hoy.
          </p>

          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"14px" }}>
            <input value={email} onChange={e => setEmail(e.target.value)}
              placeholder="tu@email.com"
              style={{
                ...inp,
                background:"rgba(8,8,10,0.1)", border:"1px solid rgba(8,8,10,0.18)",
                color:T.bg, width:"220px",
              }} />
            <motion.button
              whileHover={{ scale:1.03, y:-2 }} whileTap={{ scale:0.97 }}
              onClick={handleCTA}
              style={{ ...btn, background:T.bg, color:T.accent, fontSize:"15px",
                padding:"12px 32px" }}>
              Empezar gratis →
            </motion.button>
          </div>
          <div style={{ fontFamily:FF.mono, fontSize:"11px", color:"rgba(8,8,10,0.45)",
            letterSpacing:"0.05em" }}>
            Gratis · Sin tarjeta · 5 minutos para configurar
          </div>
        </div>
      </section>

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <footer style={{
        borderTop:`1px solid ${T.border}`, background:T.bg,
        padding:"22px clamp(20px,5vw,80px)",
        display:"flex", justifyContent:"space-between", alignItems:"center",
        fontSize:"12px", color:T.text3, flexWrap:"wrap", gap:"12px",
        position:"relative", zIndex:1,
      }}>
        <div style={{ fontFamily:FF.display, fontSize:"18px", letterSpacing:"0.05em" }}>
          <span style={{ color:T.accent }}>SPORT</span>
          <span style={{ color:T.text3 }}>OS</span>
        </div>
        <div style={{ fontFamily:FF.mono, fontSize:"10px", letterSpacing:"0.08em" }}>
          RUGBY · FÚTBOL · HANDBALL · BASKETBALL · HOCKEY
        </div>
        <div>© 2026 SportOS.</div>
      </footer>
    </div>
  );
}
