import { useState, useEffect } from "react";
import { m as motion } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import AuroraBg from "../components/AuroraBg";
import { supabase } from "../lib/supabase";
import { useProviderEnabled } from "../lib/authProviders";
import BackButton from "../components/BackButton";

const ROL_INFO = {
  superadmin: { label:"Super Admin",       icon:"⚡", color:"#8040CC", desc:"Acceso total a la plataforma SportOS." },
  admin:       { label:"Admin Club",        icon:"🏢", color:"#3B82F6", desc:"Gestiona el club, jugadores y finanzas." },
  entrenador:  { label:"Entrenador",        icon:"📋", color:"#C98408", desc:"Nóminas, tácticas y seguimiento del plantel." },
  preparador:  { label:"Preparador Físico", icon:"💪", color:"#C0392B", desc:"Microciclos, cargas y estado del plantel." },
  jugador:     { label:"Jugador",           icon:"👤", color:"#1FA04A", desc:"Tu dashboard, cuota, gym y convocatorias." },
};

export default function InvitationScreen({ params, onComplete, onBack }) {
  const rol       = params.get("rol")     || "jugador";
  const clubName  = params.get("name")    || "Tu Club";
  const sport     = params.get("sport")   || "rugby";
  const catsRaw   = params.get("cats")    || "";
  const cats      = catsRaw ? decodeURIComponent(catsRaw).split(",").map(c=>c.trim()).filter(Boolean) : [];
  // Ojo: club/pid ya no se leen de la URL. El servidor los resuelve desde el
  // token en accept_invitation(); lo que venga en el link es solo decorativo.
  const token     = params.get("token")   || null;
  const expiry    = parseInt(params.get("exp") || "0", 10);
  const info      = ROL_INFO[rol] || ROL_INFO.jugador;
  const isExpired = expiry > 0 && Date.now() > expiry;

  const [form, setForm]     = useState({ nombre:"", email:"", password:"" });
  const [step, setStep]     = useState("form"); // "form" | "success"
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errors, setErrors] = useState({});
  const googleHabilitado = useProviderEnabled("google");
  const [serverError, setServerError] = useState("");

  const redeemWithSession = async (user) => {
    setLoading(true);
    setServerError("");
    try {
      const { data: acc, error: accErr } = await supabase.rpc("accept_invitation", { p_token: token });
      // El servidor rechaza los canjes que bajarían de rol a quien ya está en
      // el club: hay que distinguirlo de un link vencido, porque el link sigue
      // sirviendo — para otra persona.
      if (accErr) throw new Error(accErr.message?.includes("invitacion_te_degrada")
        ? "invitacion_te_degrada" : "invitacion_invalida");
      // Sin respuesta del servidor no inventamos la asignación: el rol y el
      // club de la URL los escribe quien manda el link, no la base.
      if (!acc?.[0]) throw new Error("invitacion_invalida");
      const assigned = acc[0];

      const nombreGoogle = user.user_metadata?.full_name || user.user_metadata?.name || "";
      if (nombreGoogle) await supabase.from("profiles").update({ nombre: nombreGoogle }).eq("id", user.id);

      setLoading(false);
      setForm(f => ({ ...f, nombre: nombreGoogle || user.email }));
      setStep("success");

      setTimeout(() => {
        onComplete({
          id: user.id,
          nombre: nombreGoogle || user.email,
          email: user.email,
          rol: assigned.rol,
          club: assigned.club_name || clubName,
          club_id: assigned.club_id,
          sport: assigned.sport || sport,
          cats: (assigned.cats || "").split(",").map(c=>c.trim()).filter(Boolean),
          isReal: true,
        });
      }, 1400);
    } catch (err) {
      setLoading(false);
      setCheckingSession(false);
      setServerError(
        err.message === "invitacion_te_degrada"
          ? "Ya perteneces a este club con un rol superior, así que no aplicamos la invitación. El link sigue válido: pásaselo a la persona que quieres invitar."
        : err.message === "invitacion_invalida"
          ? "Este link de invitación ya no es válido (expiró o ya fue usado). Pide uno nuevo al administrador del club."
          : "Error al procesar tu cuenta con Google. Intenta de nuevo.");
    }
  };

  // Al volver de Google (redirectTo apunta al mismo link de invitación), ya
  // hay sesión activa — saltamos el formulario y canjeamos el token directo.
  useEffect(() => {
    if (isExpired || !token) { setCheckingSession(false); return; }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) redeemWithSession(session.user);
      else setCheckingSession(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleGoogle = async () => {
    setServerError("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.href },
    });
    if (error) setServerError("Error al conectar con Google: " + error.message);
  };

  // Link expirado (solo si viene con &exp= y ya pasó el tiempo)
  if (isExpired) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <AuroraBg/>
      <motion.div {...scaleIn} style={{...ss.card,maxWidth:"400px",width:"90%",textAlign:"center",padding:"40px 32px",position:"relative",zIndex:1}}>
        <div style={{fontSize:"48px",marginBottom:"16px"}}>⏰</div>
        <div style={{fontWeight:800,fontSize:"20px",marginBottom:"8px"}}>Link expirado</div>
        <div style={{fontSize:"13px",color:"var(--text-3)",lineHeight:1.7,marginBottom:"24px"}}>
          Este link de invitación ya no es válido.<br/>
          Los links expiran a las <strong>48 horas</strong> de ser generados.
        </div>
        <div style={{fontSize:"12px",color:"var(--text-3)",padding:"12px 16px",borderRadius:"var(--r-md)",background:"rgba(192,57,43,0.06)",border:"1px solid rgba(192,57,43,0.2)",marginBottom:"24px"}}>
          Pídele al administrador del club que genere un nuevo link de invitación.
        </div>
        {onBack && (
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={onBack}
            style={{...ss.btn,background:"transparent",color:"var(--text-2)",border:"1px solid var(--border-soft)",fontSize:"13px",padding:"10px 24px"}}>
            ← Volver al inicio
          </motion.button>
        )}
      </motion.div>
    </div>
  );

  const validate = () => {
    const e = {};
    if (!form.nombre.trim())        e.nombre   = "Escribe tu nombre";
    if (!form.email.includes("@"))  e.email    = "Email inválido";
    if (form.password.length < 6)   e.password = "Mínimo 6 caracteres";
    return e;
  };

  const handleSubmit = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setLoading(true);
    setServerError("");

    try {
      // Sin token no hay invitación que canjear. Antes se aceptaba igual y se
      // usaba el rol de la URL: bastaba con editar ?rol=admin a mano.
      if (!token) throw new Error("invitacion_invalida");

      // 1. Crear cuenta en Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        // El token viaja en el metadata: si hay que confirmar el correo, la
        // sesión llega recién en el próximo login y la invitación se canjea
        // ahí, no acá.
        options: { data: { nombre: form.nombre.trim(), invitacion_token: token } },
      });
      if (authError) throw authError;

      const userId = authData.user?.id;
      if (!userId) throw new Error("No se obtuvo ID de usuario");

      if (!authData.session) {
        // Confirmación por correo activada: accept_invitation necesita
        // auth.uid() y ahora mismo no hay sesión. Canjear acá dejaría la
        // invitación quemada sin haber asignado nada.
        setLoading(false);
        setStep("confirmar");
        return;
      }

      // 2. Canjear la invitación: el servidor valida el token contra la tabla
      //    invitations y recién ahí asigna rol/club_id/vínculo de jugador.
      //    El cliente ya no puede auto-asignarse un rol (ver accept_invitation
      //    y la política "own profile update" en supabase/schema.sql).
      const { data: acc, error: accErr } = await supabase.rpc("accept_invitation", { p_token: token });

      // Los motivos que la función distingue se muestran tal cual: aplastarlos
      // todos en "link inválido" escondía la causa real y dejaba al usuario (y
      // a quien depura) sin nada con qué trabajar.
      //
      // Salvo un caso: App.jsx también canjea el token guardado en el
      // user_metadata al detectar la sesión nueva, así que los dos canjes
      // corren a la vez y el que llega segundo recibe 'invitacion_ya_usada'.
      // La asignación se hizo igual — antes de dar error hay que mirar el
      // perfil, no el resultado de esta llamada.
      let assigned = acc?.[0] || null;
      if (!assigned) {
        if (accErr) console.error("accept_invitation falló:", accErr);
        const { data: perfil } = await supabase
          .from("profiles").select("rol, club_id").eq("id", userId).single();
        if (perfil?.club_id) {
          const { data: c } = await supabase
            .from("clubs").select("name, sport").eq("id", perfil.club_id).single();
          assigned = { rol: perfil.rol, club_id: perfil.club_id,
                       club_name: c?.name, sport: c?.sport, cats: "", player_id: null };
        } else {
          throw new Error(accErr?.message || "invitacion_invalida");
        }
      }

      setLoading(false);
      setStep("success");

      // Entrar automáticamente después de 1.4s
      setTimeout(() => {
        onComplete({
          id: userId,
          nombre: form.nombre.trim(),
          email: form.email.trim(),
          rol: assigned.rol,
          club: assigned.club_name || clubName,
          club_id: assigned.club_id,
          sport: assigned.sport || sport,
          cats: (assigned.cats || "").split(",").map(c=>c.trim()).filter(Boolean),
          isReal: true,
        });
      }, 1400);

    } catch (err) {
      setLoading(false);
      const m = err.message || "";
      if (m.includes("already registered")) {
        setServerError("Este email ya tiene cuenta. Inicia sesión en su lugar.");
      } else if (m.includes("invitacion_no_encontrada")) {
        setServerError("Este link no corresponde a ninguna invitación. Pide uno nuevo al administrador del club.");
      } else if (m.includes("invitacion_ya_usada")) {
        setServerError("Esta invitación ya fue usada por otra persona. Pide una nueva al administrador del club.");
      } else if (m.includes("invitacion_expirada")) {
        setServerError("Esta invitación venció (duran 48 horas). Pide una nueva al administrador del club.");
      } else if (m.includes("invitacion_te_degrada")) {
        setServerError("Ya perteneces a este club con un rol superior, así que no aplicamos la invitación. El link sigue válido para la persona que quieres invitar.");
      } else if (m === "invitacion_invalida") {
        setServerError("Este link de invitación ya no es válido (expiró o ya fue usado). Pide uno nuevo al administrador del club.");
      } else {
        setServerError(err.message || "Error al crear la cuenta. Intenta de nuevo.");
      }
    }
  };

  const clubLabel = clubName.replace(/-/g," ").replace(/\b\w/g,c=>c.toUpperCase());

  if (checkingSession) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <AuroraBg/>
      <div style={{position:"relative",zIndex:1,fontSize:"13px",color:"var(--text-3)"}}>⏳ Verificando invitación...</div>
    </div>
  );

  // Cuenta creada, falta confirmar el correo. La invitación NO se canjeó
  // todavía: queda guardada y se canjea sola al iniciar sesión.
  if (step === "confirmar") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <AuroraBg/>
      <motion.div {...scaleIn} style={{...ss.card,maxWidth:"420px",width:"90%",textAlign:"center",padding:"40px 32px",position:"relative",zIndex:1}}>
        <div style={{fontSize:"48px",marginBottom:"16px"}}>📬</div>
        <div style={{fontSize:"22px",fontWeight:800,marginBottom:"8px"}}>Confirma tu correo</div>
        <div style={{color:"var(--text-2)",fontSize:"13px",lineHeight:1.6,marginBottom:"20px"}}>
          Te mandamos un link a <strong>{form.email.trim()}</strong>. Haz clic y
          después inicia sesión: ahí quedas como{" "}
          <strong style={{color:info.color}}>{info.label}</strong> en{" "}
          <strong>{clubLabel}</strong>. Tu invitación sigue guardada.
        </div>
        <div style={{fontSize:"11px",color:"var(--text-3)"}}>Si no te llega, revisa el spam.</div>
      </motion.div>
    </div>
  );

  if (step === "success") return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <AuroraBg/>
      <motion.div {...scaleIn} style={{...ss.card,maxWidth:"420px",width:"90%",textAlign:"center",padding:"40px 32px",position:"relative",zIndex:1}}>
        <motion.div initial={{scale:0}} animate={{scale:1}} transition={{type:"spring",stiffness:300,damping:20,delay:0.2}}
          style={{width:"80px",height:"80px",borderRadius:"50%",background:`linear-gradient(135deg,${info.color}33,${info.color}11)`,border:`2px solid ${info.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"36px",margin:"0 auto 20px",boxShadow:`0 0 32px ${info.color}44`}}>
          ✅
        </motion.div>
        <motion.div {...fadeUp} transition={{delay:0.3}}>
          <div style={{fontSize:"22px",fontWeight:800,marginBottom:"8px"}}>¡Bienvenido, {form.nombre.split(" ")[0]}!</div>
          <div style={{color:"var(--text-2)",fontSize:"13px",marginBottom:"24px",lineHeight:1.6}}>
            Tu cuenta fue creada como <strong style={{color:info.color}}>{info.label}</strong> en <strong>{clubLabel}</strong>.
          </div>
          <div style={{fontSize:"11px",color:"var(--text-3)"}}>Entrando a SportOS...</div>
        </motion.div>
      </motion.div>
    </div>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",overflow:"hidden"}}>
      <AuroraBg/>
      {onBack && (
        <div style={{position:"fixed",top:"16px",left:"20px",zIndex:10}}>
          <BackButton onClick={onBack} label="Inicio"/>
        </div>
      )}
      <motion.div {...fadeUp} style={{maxWidth:"440px",width:"90%",position:"relative",zIndex:1}}>

        {/* Cabecera — club y rol */}
        <motion.div {...scaleIn} style={{...ss.card,marginBottom:"16px",textAlign:"center",padding:"28px 24px",border:`1px solid ${info.color}33`,background:`linear-gradient(135deg,${info.color}08,transparent)`}}>
          <div style={{width:"64px",height:"64px",borderRadius:"50%",background:`linear-gradient(135deg,${info.color}33,${info.color}11)`,border:`2px solid ${info.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"28px",margin:"0 auto 14px",boxShadow:`0 0 24px ${info.color}44`}}>
            {info.icon}
          </div>
          <div style={{fontSize:"11px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,marginBottom:"6px"}}>Invitación a</div>
          <div style={{fontSize:"20px",fontWeight:800,marginBottom:"4px"}}>{clubLabel}</div>
          <div style={{display:"inline-flex",alignItems:"center",gap:"6px",padding:"5px 14px",borderRadius:"99px",background:`${info.color}18`,border:`1px solid ${info.color}44`,marginTop:"8px"}}>
            <span style={{fontSize:"13px"}}>{info.icon}</span>
            <span style={{fontSize:"12px",fontWeight:700,color:info.color}}>{info.label}</span>
          </div>
          <div style={{...ss.muted,fontSize:"11px",marginTop:"10px"}}>{info.desc}</div>
          {cats.length > 0 && (
            <div style={{marginTop:"12px"}}>
              <div style={{fontSize:"10px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.06em",fontWeight:600,marginBottom:"6px"}}>
                {rol==="jugador"?"Plantel asignado":"Categorías asignadas"}
              </div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",justifyContent:"center"}}>
                {cats.map(cat=>(
                  <span key={cat} style={{fontSize:"11px",padding:"3px 10px",borderRadius:"99px",background:`${info.color}18`,color:info.color,border:`1px solid ${info.color}44`,fontWeight:600}}>{cat}</span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Formulario */}
        <motion.div {...fadeUp} transition={{delay:0.1}} style={{...ss.card,padding:"28px 24px"}}>
          <div style={{fontWeight:700,fontSize:"15px",marginBottom:"20px"}}>Crea tu cuenta</div>

          <div style={{marginBottom:"14px"}}>
            <div style={ss.label}>Nombre completo</div>
            <input value={form.nombre} onChange={e=>{setForm(p=>({...p,nombre:e.target.value}));setErrors(p=>({...p,nombre:""}));}}
              placeholder="Ej: Pablo Rodríguez" style={{...ss.input,borderColor:errors.nombre?"#C0392B":"var(--border-soft)"}}/>
            {errors.nombre && <div style={{color:"#C0392B",fontSize:"11px",marginTop:"4px"}}>{errors.nombre}</div>}
          </div>

          <div style={{marginBottom:"14px"}}>
            <div style={ss.label}>Email</div>
            <input type="email" value={form.email} onChange={e=>{setForm(p=>({...p,email:e.target.value}));setErrors(p=>({...p,email:""}));setServerError("");}}
              placeholder="tu@email.com" style={{...ss.input,borderColor:errors.email?"#C0392B":"var(--border-soft)"}}/>
            {errors.email && <div style={{color:"#C0392B",fontSize:"11px",marginTop:"4px"}}>{errors.email}</div>}
          </div>

          <div style={{marginBottom:"20px"}}>
            <div style={ss.label}>Contraseña</div>
            <input type="password" value={form.password} onChange={e=>{setForm(p=>({...p,password:e.target.value}));setErrors(p=>({...p,password:""}));}}
              placeholder="Mínimo 6 caracteres" style={{...ss.input,borderColor:errors.password?"#C0392B":"var(--border-soft)"}}/>
            {errors.password && <div style={{color:"#C0392B",fontSize:"11px",marginTop:"4px"}}>{errors.password}</div>}
          </div>

          {serverError && (
            <div style={{fontSize:"12px",color:"#C0392B",marginBottom:"14px",padding:"10px 12px",borderRadius:"var(--r-sm)",background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.25)"}}>
              ⚠️ {serverError}
            </div>
          )}

          <motion.button whileHover={!loading?{scale:1.02,y:-2}:{}} whileTap={!loading?{scale:0.98}:{}}
            onClick={handleSubmit} disabled={loading}
            style={{...ss.btn,background:loading?"rgba(255,255,255,0.06)":`linear-gradient(135deg,${info.color},${info.color}cc)`,color:loading?"var(--text-3)":"#fff",width:"100%",padding:"14px",fontSize:"14px",fontWeight:700,boxShadow:loading?"none":`0 8px 24px ${info.color}44`,cursor:loading?"not-allowed":"pointer",marginBottom:"14px"}}>
            {loading?"⏳ Creando cuenta...":`Unirme como ${info.label} ${info.icon}`}
          </motion.button>

          {googleHabilitado && <>
          <div style={{display:"flex",alignItems:"center",gap:"10px",margin:"4px 0 14px"}}>
            <div style={{flex:1,height:"1px",background:"var(--border-soft)"}}/>
            <span style={{fontSize:"11px",color:"var(--text-4)"}}>o más rápido</span>
            <div style={{flex:1,height:"1px",background:"var(--border-soft)"}}/>
          </div>

          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={handleGoogle} disabled={loading}
            style={{width:"100%",padding:"11px",borderRadius:"var(--r-md)",border:"1px solid #e0e0e0",background:"#fff",color:"#1a1a1a",fontSize:"13px",fontWeight:600,cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(0,0,0,0.12)",marginBottom:"14px"}}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Unirme con Google
          </motion.button>
          </>}

          <div style={{textAlign:"center",fontSize:"11px",color:"var(--text-3)",lineHeight:1.6}}>
            Al registrarte aceptas los <span style={{color:info.color,cursor:"pointer"}}>Términos de uso</span> de SportOS.<br/>
            Tu rol fue asignado por el administrador del club.
          </div>
        </motion.div>

        <div style={{textAlign:"center",marginTop:"16px"}}>
          <span style={{fontSize:"11px",fontWeight:800,color:info.color,letterSpacing:"-0.01em",filter:`drop-shadow(0 0 8px ${info.color}66)`}}>⚡ SportOS</span>
        </div>
      </motion.div>
    </div>
  );
}
