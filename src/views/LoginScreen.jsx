import { useState, Fragment } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import AuroraBg from "../components/AuroraBg";
import { supabase } from "../lib/supabase";
import { redeemPendingInvitation } from "../lib/pendingInvitation";
import BackButton from "../components/BackButton";

const ROL_INFO = {
  superadmin: { label:"Super Admin",       icon:"⚡", color:"#8040CC" },
  admin:       { label:"Admin Club",        icon:"🏢", color:"#3B82F6" },
  entrenador:  { label:"Entrenador",        icon:"📋", color:"#C98408" },
  preparador:  { label:"Preparador Físico", icon:"💪", color:"#C0392B" },
  jugador:     { label:"Jugador",           icon:"👤", color:"#1FA04A" },
};

// ── Tabla de membresías ──────────────────────────────────────────────────
const PLANS = [
  {
    id:"free", label:"Free", price:0, icon:"🆓", color:"#6B5A5A",
    desc:"Para empezar sin riesgos",
    features:[
      { label:"El Muro del club",          ok:true },
      { label:"Asistencia",                ok:true },
      { label:"Plantel (hasta 15)",        ok:true },
      { label:"Calendario de partidos",    ok:true },
      { label:"Match Center",              ok:false },
      { label:"Wellness post-partido",     ok:false },
      { label:"Microciclo semanal",        ok:false },
      { label:"Ranking de fuerza",         ok:false },
      { label:"Finanzas y cuotas",         ok:false },
    ],
  },
  {
    id:"pro", label:"Pro", price:29, icon:"⚡", color:"#C0392B", popular:true,
    desc:"Para clubes en competencia activa",
    features:[
      { label:"Todo lo del plan Free",     ok:true },
      { label:"Plantel ilimitado",         ok:true },
      { label:"Match Center",              ok:true },
      { label:"Wellness post-partido",     ok:true },
      { label:"Microciclo semanal",        ok:true },
      { label:"Ranking de fuerza",         ok:true },
      { label:"Estadísticas avanzadas",    ok:true },
      { label:"Finanzas y cuotas",         ok:false },
      { label:"SportOS Cam (próximo)",     ok:false },
    ],
  },
  {
    id:"elite", label:"Elite", price:59, icon:"👑", color:"#C98408",
    desc:"Gestión completa del club",
    features:[
      { label:"Todo lo del plan Pro",      ok:true },
      { label:"Finanzas y cuotas",         ok:true },
      { label:"Importar partido (URL IA)", ok:true },
      { label:"SportOS Cam (próximo)",     ok:true },
      { label:"Soporte prioritario",       ok:true },
      { label:"Reportes exportables",      ok:true },
      { label:"Multi-deporte ilimitado",   ok:true },
    ],
  },
];

function PlanesSection({ onRegister }) {
  const [hoveredPlan, setHoveredPlan] = useState("pro");

  return (
    <motion.div {...fadeUp} style={{marginBottom:"32px"}}>
      <div style={{textAlign:"center",marginBottom:"24px"}}>
        <div style={{fontSize:"13px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:"6px"}}>Planes y precios</div>
        <div style={{fontSize:"22px",fontWeight:800,letterSpacing:"-0.02em"}}>Elige el plan para tu club</div>
        <div style={{fontSize:"12px",color:"var(--text-3)",marginTop:"6px"}}>Cancela cuando quieras · Sin contratos</div>
      </div>

      <div className="planes-grid" style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"12px"}}>
        {PLANS.map((plan, i) => (
          <motion.div key={plan.id}
            initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} transition={{delay:i*0.08}}
            onHoverStart={()=>setHoveredPlan(plan.id)}
            style={{position:"relative",borderRadius:"var(--r-xl)",border:`1.5px solid ${hoveredPlan===plan.id?plan.color+"66":plan.popular?"#C0392B33":"var(--border-soft)"}`,background:hoveredPlan===plan.id?`${plan.color}08`:"var(--bg-glass)",backdropFilter:"blur(16px)",WebkitBackdropFilter:"blur(16px)",padding:"20px 16px",transition:"all 0.25s",boxShadow:hoveredPlan===plan.id?`0 8px 32px ${plan.color}22`:"none",cursor:"default"}}>

            {/* Badge popular */}
            {plan.popular && (
              <div style={{position:"absolute",top:"-11px",left:"50%",transform:"translateX(-50%)",background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,color:"#fff",fontSize:"9px",fontWeight:800,padding:"3px 12px",borderRadius:"99px",whiteSpace:"nowrap",boxShadow:`0 4px 12px ${plan.color}55`,letterSpacing:"0.05em"}}>
                MÁS POPULAR
              </div>
            )}

            {/* Header del plan */}
            <div style={{textAlign:"center",marginBottom:"16px"}}>
              <div style={{fontSize:"24px",marginBottom:"6px"}}>{plan.icon}</div>
              <div style={{fontWeight:800,fontSize:"15px",marginBottom:"4px",color:hoveredPlan===plan.id?plan.color:"var(--text-1)"}}>{plan.label}</div>
              <div style={{fontSize:"10px",color:"var(--text-3)",marginBottom:"12px",lineHeight:1.4}}>{plan.desc}</div>
              <div style={{fontSize:"26px",fontWeight:900,color:plan.color,letterSpacing:"-0.02em"}}>
                {plan.price===0 ? "Gratis" : `$${plan.price}`}
              </div>
              {plan.price>0 && <div style={{fontSize:"10px",color:"var(--text-4)"}}>USD/mes</div>}
            </div>

            {/* Lista de features */}
            <div style={{display:"flex",flexDirection:"column",gap:"6px",marginBottom:"16px"}}>
              {plan.features.map((f,j)=>(
                <div key={j} style={{display:"flex",alignItems:"center",gap:"7px",fontSize:"11px",color:f.ok?"var(--text-2)":"var(--text-4)"}}>
                  <span style={{fontSize:"11px",flexShrink:0,color:f.ok?plan.color:"var(--text-4)"}}>{f.ok?"✓":"✗"}</span>
                  <span style={{textDecoration:f.ok?"none":"line-through",opacity:f.ok?1:0.5}}>{f.label}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <motion.button whileHover={{scale:1.04,y:-1}} whileTap={{scale:0.97}} onClick={onRegister}
              style={{...ss.btn,width:"100%",padding:"10px",fontSize:"11px",fontWeight:700,
                background:plan.popular?`linear-gradient(135deg,${plan.color},${plan.color}cc)`:"var(--bg-elev-3)",
                color:plan.popular?"#fff":plan.color,
                border:`1px solid ${plan.color}44`,
                boxShadow:plan.popular?`0 4px 14px ${plan.color}44`:"none"}}>
              {plan.price===0?"Empezar gratis":"Empezar con "+plan.label}
            </motion.button>
          </motion.div>
        ))}
      </div>

      <div style={{textAlign:"center",marginTop:"14px",fontSize:"10px",color:"var(--text-4)"}}>
        ✓ Todos los planes incluyen acceso multirol · jugadores, entrenadores y preparadores en un solo lugar
      </div>
    </motion.div>
  );
}

export default function LoginScreen({ onLogin, onDemo, onRegister, onBack }) {
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [step, setStep]         = useState("login");
  const [loggedUser, setLoggedUser] = useState(null);
  const [tab, setTab]           = useState("login"); // "login" | "planes"
  const [loginMode, setLoginMode] = useState("form"); // "form" | "reset"
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async () => {
    setError("");
    if (!email.trim())    { setError("Escribe tu email");       return; }
    if (!password.trim()) { setError("Escribe tu contraseña");  return; }
    setLoading(true);

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) throw authError;

      // La consulta del perfil puede fallar por un hipo transitorio de red/
      // sincronización (ej. "JWT issued at future") justo después de iniciar
      // sesión — si no reintentamos, se pierde el rol/club real y la app
      // trata a un admin real como si fuera una cuenta nueva sin club.
      let profile = null, profileError = null;
      for (let intento = 0; intento < 2; intento++) {
        const r = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
        profile = r.data; profileError = r.error;
        if (!profileError) break;
        await new Promise(res => setTimeout(res, 600));
      }
      if (profileError) throw new Error("perfil_no_disponible");

      // Invitación pendiente de canjear (el registro exigía confirmar el
      // correo, así que no había sesión en ese momento). Ahora sí la hay.
      if (!profile?.club_id && data.user.user_metadata?.invitacion_token) {
        const asignado = await redeemPendingInvitation(data.user);
        if (asignado) {
          const r = await supabase.from("profiles").select("*").eq("id", data.user.id).single();
          if (!r.error) profile = r.data;
        }
      }

      const rolPerfil = profile?.rol || "jugador";
      let planEfectivo = profile?.plan || "free";
      // Usuarios no-admin heredan el plan del admin de su club
      if (profile?.club_id && !["admin","superadmin"].includes(rolPerfil)) {
        const { data: adminClub } = await supabase
          .from("profiles")
          .select("plan")
          .eq("club_id", profile.club_id)
          .eq("rol", "admin")
          .single();
        if (adminClub?.plan) planEfectivo = adminClub.plan;
      }

      setLoading(false);
      const user = {
        id: data.user.id,
        nombre: profile?.nombre || data.user.email,
        email: data.user.email,
        rol: rolPerfil,
        club: profile?.clubs?.name || "Club",
        sport: profile?.clubs?.sport || "rugby",
        club_id: profile?.club_id || null,
        plan: planEfectivo,
        onboarding_done: profile?.onboarding_done || false,
        avatar_url: profile?.avatar_url || null,
        // Club que quedó pendiente de crear porque el registro exigía
        // confirmar el correo. Vive en el user_metadata del signUp.
        club_pendiente: data.user.user_metadata?.club_pendiente || null,
        cats: [],
        isReal: true,
      };
      setLoggedUser(user);
      setStep("success");
      setTimeout(() => onLogin(user), 1200);
    } catch (err) {
      setLoading(false);
      if (err.message === "perfil_no_disponible") {
        setError("No pudimos cargar tu cuenta (problema de conexión). Intenta de nuevo en unos segundos.");
      } else {
        setError("Email o contraseña incorrectos");
      }
    }
  };

  const handleKey = (e) => { if (e.key==="Enter" && loginMode==="form") handleLogin(); };

  const handleReset = async () => {
    if (!email.trim()) { setError("Escribe tu email"); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin,
    });
    setLoading(false);
    if (err) { setError("Error: " + err.message); return; }
    setResetSent(true);
  };

  // ── Pantalla de éxito ───────────────────────────────────────────────────
  if (step==="success" && loggedUser) {
    const info = ROL_INFO[loggedUser.rol] || ROL_INFO.jugador;
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
        <AuroraBg/>
        <motion.div {...scaleIn} style={{textAlign:"center",position:"relative",zIndex:1}}>
          <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:260,damping:20}}
            style={{width:"80px",height:"80px",borderRadius:"50%",background:`linear-gradient(135deg,${info.color}44,${info.color}11)`,border:`2px solid ${info.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"32px",margin:"0 auto 16px",boxShadow:`0 0 32px ${info.color}44`}}>
            {info.icon}
          </motion.div>
          <motion.div {...fadeUp} transition={{delay:0.2}}>
            <div style={{fontSize:"22px",fontWeight:800,marginBottom:"6px"}}>¡Bienvenido, {loggedUser.nombre.split(" ")[0]}!</div>
            <div style={{color:"var(--text-2)",fontSize:"13px"}}>{loggedUser.club} · {info.label}</div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // ── Pantalla principal ──────────────────────────────────────────────────
  return (
    <div style={{minHeight:"100vh",display:"flex",flexDirection:"column",position:"relative",overflowX:"hidden",overflowY:"auto",height:"100vh"}}>
      <AuroraBg/>

      {/* Topbar */}
      <div style={{position:"sticky",top:0,zIndex:10,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 24px",height:"60px",background:"rgba(10,8,8,0.7)",backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",borderBottom:"1px solid var(--border-soft)"}}>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          {onBack && <BackButton onClick={onBack} label="Inicio"/>}
          <div style={{fontSize:"18px",fontWeight:900,color:"#C0392B",letterSpacing:"-0.02em",filter:"drop-shadow(0 0 10px #C0392B66)"}}>⚡ SportOS</div>
        </div>
        <div style={{display:"flex",gap:"6px"}}>
          {[{id:"login",label:"Iniciar sesión"},{id:"planes",label:"Ver planes"}].map(t=>(
            <motion.button key={t.id} whileTap={{scale:0.96}} onClick={()=>setTab(t.id)}
              style={{...ss.btn,fontSize:"12px",padding:"7px 16px",background:tab===t.id?"rgba(192,57,43,0.15)":"transparent",color:tab===t.id?"#C0392B":"var(--text-3)",border:`1px solid ${tab===t.id?"rgba(192,57,43,0.4)":"var(--border-soft)"}`,fontWeight:tab===t.id?700:400}}>
              {t.label}
            </motion.button>
          ))}
          <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}} onClick={onRegister}
            style={{...ss.btn,fontSize:"12px",padding:"7px 18px",background:"linear-gradient(135deg,#C0392B,#C0392Bcc)",color:"#fff",fontWeight:700,boxShadow:"0 4px 14px rgba(192,57,43,0.4)"}}>
            Crear club gratis
          </motion.button>
        </div>
      </div>

      {/* Contenido con tabs */}
      <div style={{flex:1,overflowY:"auto",position:"relative",zIndex:1}}>
        <AnimatePresence mode="wait">

          {/* ── TAB: PLANES ── */}
          {tab==="planes" && (
            <motion.div key="planes" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.25}}
              style={{maxWidth:"900px",margin:"0 auto",padding:"40px 24px"}}>
              <PlanesSection onRegister={onRegister}/>

              {/* FAQ rápido */}
              <motion.div {...fadeUp} style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginTop:"8px"}}>
                {[
                  {q:"¿Puedo cambiar de plan?", a:"Sí, en cualquier momento. El cambio se aplica en el próximo ciclo de facturación."},
                  {q:"¿Cuántos usuarios por club?", a:"Ilimitados en todos los planes. Cada jugador, entrenador y preparador tiene su propio acceso."},
                  {q:"¿Funciona en el celular?", a:"Sí. SportOS está optimizado para móvil. Los jugadores llenan el wellness desde su teléfono."},
                  {q:"¿Puedo probar antes de pagar?", a:"El plan Free es permanente. Puedes usarlo sin límite de tiempo y subir cuando quieras."},
                ].map((item,i)=>(
                  <motion.div key={i} initial={{opacity:0,y:10}} animate={{opacity:1,y:0}} transition={{delay:0.3+i*0.06}}
                    style={{...ss.card,padding:"14px 16px"}}>
                    <div style={{fontWeight:700,fontSize:"12px",marginBottom:"4px",color:"var(--text-1)"}}>{item.q}</div>
                    <div style={{fontSize:"11px",color:"var(--text-3)",lineHeight:1.6}}>{item.a}</div>
                  </motion.div>
                ))}
              </motion.div>

              <div style={{textAlign:"center",marginTop:"28px"}}>
                <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>setTab("login")}
                  style={{...ss.btn,background:"transparent",color:"var(--text-3)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"9px 24px"}}>
                  ← Ya tengo cuenta — iniciar sesión
                </motion.button>
              </div>
            </motion.div>
          )}

          {/* ── TAB: LOGIN ── */}
          {tab==="login" && (
            <motion.div key="login" initial={{opacity:0,y:12}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-12}} transition={{duration:0.25}}
              className="login-columns"
              style={{display:"flex",gap:"48px",maxWidth:"1000px",margin:"0 auto",padding:"40px 24px",alignItems:"flex-start"}}>

              {/* Columna izquierda — mini comparativa */}
              <div style={{flex:"0 0 340px"}}>
                <motion.div {...fadeUp} style={{marginBottom:"20px"}}>
                  <div style={{fontSize:"11px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.1em",fontWeight:600,marginBottom:"8px"}}>Plataforma deportiva para LATAM</div>
                  <div style={{fontSize:"26px",fontWeight:900,letterSpacing:"-0.02em",lineHeight:1.2,marginBottom:"8px"}}>Gestiona tu club en un solo lugar</div>
                  <div style={{fontSize:"12px",color:"var(--text-3)",lineHeight:1.7}}>Rugby · Fútbol · Handball · Basketball · Hockey</div>
                </motion.div>

                {/* Mini tabla comparativa */}
                <motion.div {...fadeUp} transition={{delay:0.1}} style={{...ss.card,padding:"16px",marginBottom:"16px"}}>
                  <div style={{fontSize:"11px",color:"var(--text-3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"12px"}}>Resumen de planes</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"6px 10px",alignItems:"center"}}>
                    <div style={{fontSize:"9px",color:"var(--text-4)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.06em"}}>Feature</div>
                    {["Free","Pro","Elite"].map(p=><div key={p} style={{fontSize:"9px",color:"var(--text-3)",fontWeight:700,textAlign:"center",textTransform:"uppercase",letterSpacing:"0.06em"}}>{p}</div>)}
                    {[
                      ["El Muro + Asistencia", true,  true,  true],
                      ["Plantel ilimitado",    false, true,  true],
                      ["Match Center",         false, true,  true],
                      ["Wellness plantel",     false, true,  true],
                      ["Microciclo",           false, true,  true],
                      ["Ranking fuerza",       false, true,  true],
                      ["Finanzas y cuotas",    false, false, true],
                    ].map(([label,...vals],i)=>(
                      // La key va en el fragmento y no en el <div> de adentro:
                      // el elemento del array es el fragmento, y era eso lo que
                      // React reclamaba.
                      <Fragment key={label}>
                        <div style={{fontSize:"11px",color:"var(--text-2)",padding:"5px 0",borderTop:i>0?"1px solid var(--border-soft)":"none"}}>{label}</div>
                        {vals.map((v,j)=>(
                          <div key={j} style={{textAlign:"center",fontSize:"12px",borderTop:i>0?"1px solid var(--border-soft)":"none",padding:"5px 0"}}>
                            <span style={{color:v?["#1FA04A","#C0392B","#C98408"][j]:"var(--text-4)"}}>{v?"✓":"—"}</span>
                          </div>
                        ))}
                      </Fragment>
                    ))}
                    <div style={{gridColumn:"1/-1",marginTop:"10px",borderTop:"1px solid var(--border-soft)",paddingTop:"10px",display:"grid",gridTemplateColumns:"1fr auto auto auto",gap:"6px 10px"}}>
                      <div style={{fontSize:"10px",color:"var(--text-3)"}}>Precio/mes</div>
                      <div style={{textAlign:"center",fontWeight:800,fontSize:"11px",color:"#6B5A5A"}}>$0</div>
                      <div style={{textAlign:"center",fontWeight:800,fontSize:"11px",color:"#C0392B"}}>$29</div>
                      <div style={{textAlign:"center",fontWeight:800,fontSize:"11px",color:"#C98408"}}>$59</div>
                    </div>
                  </div>
                  <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={()=>setTab("planes")}
                    style={{...ss.btn,width:"100%",marginTop:"12px",background:"transparent",color:"#C0392B",border:"1px solid rgba(192,57,43,0.35)",fontSize:"11px",padding:"8px"}}>
                    Ver planes completos →
                  </motion.button>
                </motion.div>

                {/* Roles */}
                <motion.div {...fadeUp} transition={{delay:0.15}} style={{...ss.card,padding:"14px"}}>
                  <div style={{fontSize:"11px",color:"var(--text-3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.07em",marginBottom:"10px"}}>Acceso multirol</div>
                  <div style={{display:"flex",flexDirection:"column",gap:"7px"}}>
                    {Object.entries(ROL_INFO).filter(([id])=>id!=="superadmin").map(([id,info])=>(
                      <div key={id} style={{display:"flex",alignItems:"center",gap:"9px",padding:"7px 10px",borderRadius:"var(--r-sm)",background:`${info.color}08`,border:`1px solid ${info.color}18`}}>
                        <span style={{fontSize:"14px"}}>{info.icon}</span>
                        <span style={{fontSize:"11px",fontWeight:600,color:info.color}}>{info.label}</span>
                      </div>
                    ))}
                  </div>
                </motion.div>
              </div>

              {/* Columna derecha — formulario */}
              <div style={{flex:1,minWidth:0}}>
                <motion.div {...fadeUp} transition={{delay:0.05}} style={{...ss.card,padding:"28px 24px",marginBottom:"14px"}}>
                  <AnimatePresence mode="wait">

                  {loginMode==="form" && (
                    <motion.div key="form" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}}>
                  <div style={{fontWeight:800,fontSize:"18px",marginBottom:"4px",letterSpacing:"-0.01em"}}>Iniciar sesión</div>
                  <div style={{...ss.muted,fontSize:"11px",marginBottom:"22px"}}>Accede con tu cuenta de SportOS</div>

                  <div style={{marginBottom:"14px"}}>
                    <div style={ss.label}>Email</div>
                    <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
                      onKeyDown={handleKey} placeholder="tu@email.com" autoComplete="email"
                      style={{...ss.input,borderColor:error?"#C0392B":"var(--border-soft)"}}/>
                  </div>

                  <div style={{marginBottom:"6px"}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                      <div style={ss.label}>Contraseña</div>
                      <span onClick={()=>setShowPass(p=>!p)} style={{fontSize:"10px",color:"#C0392B",cursor:"pointer",fontWeight:600}}>
                        {showPass?"Ocultar":"Mostrar"}
                      </span>
                    </div>
                    <input type={showPass?"text":"password"} value={password}
                      onChange={e=>{setPassword(e.target.value);setError("");}}
                      onKeyDown={handleKey} placeholder="••••••••" autoComplete="current-password"
                      style={{...ss.input,borderColor:error?"#C0392B":"var(--border-soft)"}}/>
                  </div>

                  <div style={{textAlign:"right",marginBottom:"16px"}}>
                    <span onClick={()=>{setLoginMode("reset");setError("");setResetSent(false);}}
                      style={{fontSize:"11px",color:"#C0392B",cursor:"pointer",fontWeight:600}}>
                      ¿Olvidaste tu contraseña?
                    </span>
                  </div>

                  <AnimatePresence>
                    {error && (
                      <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                        style={{fontSize:"12px",color:"#C0392B",marginBottom:"14px",padding:"8px 12px",borderRadius:"var(--r-sm)",background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.25)"}}>
                        ⚠️ {error}
                      </motion.div>
                    )}
                  </AnimatePresence>


                  <motion.button whileHover={!loading?{scale:1.02,y:-2}:{}} whileTap={!loading?{scale:0.98}:{}}
                    onClick={handleLogin} disabled={loading}
                    style={{...ss.btn,width:"100%",padding:"13px",fontSize:"14px",fontWeight:700,background:loading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C0392B,#9B2335)",color:loading?"var(--text-3)":"#fff",boxShadow:loading?"none":"0 8px 24px rgba(192,57,43,0.4)",cursor:loading?"not-allowed":"pointer",marginBottom:"12px"}}>
                    {loading?"⏳ Verificando...":"Entrar →"}
                  </motion.button>

                  <div style={{display:"flex",gap:"8px",flexDirection:"column"}}>
                    {onRegister && (
                      <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={onRegister}
                        style={{...ss.btn,background:"rgba(192,57,43,0.1)",color:"#C0392B",border:"1px solid rgba(192,57,43,0.3)",fontSize:"12px",padding:"9px 20px",width:"100%",fontWeight:600}}>
                        🏆 Crear mi club gratis
                      </motion.button>
                    )}
                    <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={onDemo}
                      style={{...ss.btn,background:"transparent",color:"var(--text-3)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"9px 20px",width:"100%"}}>
                      🎮 Probar en modo demo
                    </motion.button>
                  </div>
                  </motion.div>
                  )}

                  {loginMode==="reset" && (
                    <motion.div key="reset" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.15}}>
                    {resetSent ? (
                      <div style={{textAlign:"center",padding:"16px 0"}}>
                        <div style={{fontSize:"40px",marginBottom:"12px"}}>📧</div>
                        <div style={{fontWeight:800,fontSize:"16px",marginBottom:"8px"}}>Revisa tu email</div>
                        <div style={{fontSize:"12px",color:"var(--text-3)",lineHeight:1.7,marginBottom:"8px"}}>
                          Enviamos un link a <strong style={{color:"var(--text-1)"}}>{email}</strong>.
                        </div>
                        <div style={{fontSize:"12px",color:"var(--text-3)",lineHeight:1.7,marginBottom:"20px"}}>
                          Haz clic en el link del email para crear tu nueva contraseña.
                        </div>
                        <div style={{fontSize:"11px",color:"var(--text-4)",marginBottom:"20px"}}>
                          ¿No llegó? Revisa la carpeta de spam o espera unos minutos.
                        </div>
                        <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                          onClick={()=>{setLoginMode("form");setResetSent(false);setError("");}}
                          style={{...ss.btn,background:"transparent",color:"#C0392B",border:"1px solid rgba(192,57,43,0.35)",fontSize:"12px",padding:"10px 24px",fontWeight:600}}>
                          ← Volver al inicio de sesión
                        </motion.button>
                      </div>
                    ) : (
                      <>
                      <div style={{fontWeight:800,fontSize:"18px",marginBottom:"4px",letterSpacing:"-0.01em"}}>Recuperar contraseña</div>
                      <div style={{...ss.muted,fontSize:"11px",marginBottom:"22px"}}>Te enviamos un link para crear una nueva contraseña</div>

                      <div style={{marginBottom:"14px"}}>
                        <div style={ss.label}>Email de tu cuenta</div>
                        <input type="email" value={email} onChange={e=>{setEmail(e.target.value);setError("");}}
                          onKeyDown={e=>{if(e.key==="Enter")handleReset();}} placeholder="tu@email.com" autoComplete="email" autoFocus
                          style={{...ss.input,borderColor:error?"#C0392B":"var(--border-soft)"}}/>
                      </div>

                      <AnimatePresence>
                        {error && (
                          <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                            style={{fontSize:"12px",color:"#C0392B",marginBottom:"14px",padding:"8px 12px",borderRadius:"var(--r-sm)",background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.25)"}}>
                            ⚠️ {error}
                          </motion.div>
                        )}
                      </AnimatePresence>

                      <motion.button whileHover={!loading?{scale:1.02,y:-2}:{}} whileTap={!loading?{scale:0.98}:{}}
                        onClick={handleReset} disabled={loading}
                        style={{...ss.btn,width:"100%",padding:"13px",fontSize:"14px",fontWeight:700,background:loading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C0392B,#9B2335)",color:loading?"var(--text-3)":"#fff",boxShadow:loading?"none":"0 8px 24px rgba(192,57,43,0.4)",cursor:loading?"not-allowed":"pointer",marginBottom:"12px"}}>
                        {loading?"⏳ Enviando...":"Enviar link de recuperación →"}
                      </motion.button>

                      <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}}
                        onClick={()=>{setLoginMode("form");setError("");}}
                        style={{...ss.btn,background:"transparent",color:"var(--text-3)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"9px 20px",width:"100%"}}>
                        ← Volver
                      </motion.button>
                      </>
                    )}
                    </motion.div>
                  )}

                  </AnimatePresence>
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
