import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SPORTS_CONFIG, COUNTRIES } from "../data/sports";
import AuroraBg from "../components/AuroraBg";
import { ss } from "../styles/tokens";
import BackButton from "../components/BackButton";
import { supabase, supabaseConfigured } from "../lib/supabase";

const STEPS_NUEVO    = ["Tu cuenta", "Tu club", "Tu deporte"];
const STEPS_EXISTENTE = ["Tu club", "Tu deporte"];

export default function ClubOnboarding({ onComplete, onBack, existingUser = null }) {
  const STEPS = existingUser ? STEPS_EXISTENTE : STEPS_NUEVO;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Paso "Tu cuenta" (solo usuarios nuevos)
  const [nombre, setNombre] = useState(existingUser?.nombre || "");
  const [email, setEmail]   = useState(existingUser?.email  || "");
  const [pass, setPass]     = useState("");

  // Club que quedó a medias: el usuario ya se registró y eligió su club, pero
  // tuvo que confirmar el correo antes de que pudiéramos crearlo. Al volver
  // retomamos desde acá en vez de hacerle repetir todo.
  const pendiente = existingUser?.club_pendiente || null;

  // Paso 1: club
  const [clubName, setClubName]   = useState(pendiente?.name    || "");
  const [country, setCountry]     = useState(pendiente?.country || "CL");

  // Paso 2: deporte
  const [sport, setSport] = useState(pendiente?.sport || "rugby");

  // Cuenta creada, esperando que confirmen el correo para poder crear el club
  const [esperandoCorreo, setEsperandoCorreo] = useState(false);

  const sp       = SPORTS_CONFIG[sport];
  const accentColor = sp?.color || "#A855F7";

  const isLastStep  = step === STEPS.length - 1;
  const isClubStep  = existingUser ? step === 0 : step === 1;
  const isAcctStep  = !existingUser && step === 0;

  const next = async () => {
    setError("");

    if (isAcctStep) {
      if (!nombre.trim() || !email.trim() || pass.length < 6) {
        setError("Completa todos los campos. La contraseña debe tener al menos 6 caracteres."); return;
      }
      setStep(s => s + 1);
      return;
    }

    if (isClubStep) {
      if (!clubName.trim()) { setError("Escribe el nombre del club."); return; }
      setStep(s => s + 1);
      return;
    }

    // Paso final: crear club en Supabase
    setBusy(true);
    let nuevoUserId = null;
    try {
      // La cuenta se crea ANTES que el club. Al revés (como estaba) el club
      // se insertaba primero y después, si el signUp no dejaba sesión activa,
      // claim_new_club_admin() corría sin auth.uid() y no asignaba a nadie:
      // quedaba un club huérfano y un perfil sin club_id — el usuario entraba
      // a la app "sin club" y veía la vitrina de demo. Así se veían las filas
      // "Test Club Owner"/"Test Reload Owner" (jugador, club_id null).
      if (!existingUser) {
        const { data: authData, error: authErr } = await supabase.auth.signUp({
          email: email.trim(),
          password: pass,
          options: { data: {
            nombre: nombre.trim(),
            // Guardamos qué club quería crear: si Supabase pide confirmar el
            // correo, la sesión llega recién en el próximo login y ahí
            // retomamos desde estos datos.
            rol_pendiente: "admin",
            club_pendiente: { name: clubName.trim(), sport, country },
          } },
        });
        if (authErr) throw authErr;
        if (!authData.session) {
          // Confirmación por correo activada: sin sesión no hay auth.uid(), y
          // claim_new_club_admin() dejaría el club sin dueño. No creamos nada
          // todavía — el club se crea cuando vuelva confirmado.
          setEsperandoCorreo(true);
          setBusy(false);
          return;
        }
        nuevoUserId = authData.user?.id;
        if (!nuevoUserId) throw new Error("No se obtuvo ID de usuario");
      }

      // El id se genera acá mismo (no dejamos que la DB lo genere y lo leemos
      // de vuelta con .select()): un usuario recién creado todavía no es
      // "miembro" de ningún club, así que RLS le bloquea leer la fila que
      // acaba de insertar — el insert en sí funciona bien, pero el .select()
      // posterior fallaba con "violates row-level security policy", y ese
      // error quedaba atrapado en silencio dejando clubId en null.
      const clubId = crypto.randomUUID();
      const prefixes = { rugby:"RUGBY", futbol:"FUTBOL", basketball:"BASKET", handball:"HAND", hockey:"HOCKEY" };
      const prefix   = prefixes[sport] || "CLUB";
      const join_code = `${prefix}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
      const { error: clubErr } = await supabase
        .from("clubs")
        .insert({ id: clubId, name: clubName.trim(), country, sport, join_code });
      if (clubErr) throw new Error("No se pudo crear el club: " + clubErr.message);

      // Registro de auditoría (no bloquea el flujo si falla)
      try {
        await supabase.from("club_requests").insert({
          club_id: clubId,
          nombre_club: clubName.trim(),
          deporte: sport,
          pais: country,
          nombre_solicitante: (existingUser?.nombre || nombre || "").trim(),
          email_solicitante: (existingUser?.email || email || "").trim(),
        });
      } catch (_) { /* no crítico */ }

      if (existingUser) {
        // Usuario ya autenticado (Google): reclamar admin del club recién creado
        await supabase.from("profiles").update({ nombre: existingUser.nombre }).eq("id", existingUser.id);
        const { error: claimErr } = await supabase.rpc("claim_new_club_admin", { p_club_id: clubId });
        if (claimErr) throw new Error("El club se creó, pero no pudimos asignarte como admin: " + claimErr.message);
        // El club ya existe: limpiamos la intención guardada para no volver a
        // mandarlo al onboarding en el próximo login.
        if (pendiente) {
          await supabase.auth.updateUser({ data: { club_pendiente: null, rol_pendiente: null } });
        }
        onComplete({ ...existingUser, rol: "admin", club: clubName.trim(), club_id: clubId, sport, cats: [] });
      } else {
        // Usuario nuevo: la cuenta ya quedó creada y con sesión más arriba
        await supabase.from("profiles").update({ nombre: nombre.trim() }).eq("id", nuevoUserId);
        const { error: claimErr } = await supabase.rpc("claim_new_club_admin", { p_club_id: clubId });
        if (claimErr) throw new Error("El club se creó, pero no pudimos asignarte como admin: " + claimErr.message);
        onComplete({ id: nuevoUserId, nombre: nombre.trim(), email: email.trim(), rol: "admin", club: clubName.trim(), club_id: clubId, sport, cats: [] });
      }
    } catch (e) {
      if (!supabaseConfigured) {
        // Solo en dev sin .env: no hay backend, se sigue en modo local.
        onComplete({ nombre: nombre.trim(), email: email.trim(), rol: "admin", club: clubName.trim(), club_id: null, sport, cats: [] });
      } else {
        setError(e.message);
      }
    } finally {
      setBusy(false);
    }
  };

  // Cuenta creada, falta confirmar el correo. El club todavía no existe: se
  // crea con la sesión del primer login, para que quede con dueño.
  if (esperandoCorreo) return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <AuroraBg />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
        style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "420px" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "52px", marginBottom: "12px" }}>📬</div>
          <div style={{ fontWeight: 900, fontSize: "24px", letterSpacing: "-0.03em", marginBottom: "8px" }}>
            Confirma tu correo
          </div>
          <div style={{ fontSize: "13px", color: "var(--text-3)" }}>
            Te mandamos un link a <b>{email.trim()}</b>.
          </div>
        </div>
        <div style={ss.card}>
          <div style={{ fontSize: "13px", color: "var(--text-2)", lineHeight: 1.5 }}>
            Haz clic en el link y vuelve a iniciar sesión. Ahí terminamos de crear{" "}
            <b>{clubName.trim()}</b> — ya tenemos tus datos, no vas a repetir nada.
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => onComplete(null)}
            style={{ ...ss.btn, width: "100%", marginTop: "16px", padding: "14px", fontWeight: 700,
              fontSize: "14px", background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`,
              color: "#fff" }}>
            Ir a iniciar sesión →
          </motion.button>
        </div>
        <div style={{ textAlign: "center", marginTop: "14px", fontSize: "12px", color: "var(--text-4)" }}>
          Si no te llega, revisa el spam.
        </div>
      </motion.div>
    </div>
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px", overflow: "auto" }}>
      <AuroraBg />
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}
        style={{ position: "relative", zIndex: 2, width: "100%", maxWidth: "460px" }}>

        {/* Logo + volver */}
        <div style={{ textAlign: "center", marginBottom: "32px", position:"relative" }}>
          {onBack && step === 0 && (
            <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)"}}>
              <BackButton onClick={onBack} label="Volver"/>
            </div>
          )}
          {step > 0 && (
            <div style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)"}}>
              <BackButton onClick={()=>setStep(s=>s-1)} label="Atrás"/>
            </div>
          )}
          <div style={{ fontWeight: 900, fontSize: "28px", color: accentColor, letterSpacing: "-0.03em", filter: `drop-shadow(0 0 16px ${accentColor}66)` }}>⚡ SportOS</div>
          <div style={{ fontSize: "13px", color: "var(--text-3)", marginTop: "6px" }}>Configura tu club en 3 pasos</div>
        </div>

        {/* Stepper */}
        <div style={{ display: "flex", alignItems: "center", marginBottom: "32px", gap: "0" }}>
          {STEPS.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", flex: 1 }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", flex: 1 }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", fontWeight: 700, background: i < step ? accentColor : i === step ? `${accentColor}33` : "var(--bg-elev-2)", color: i < step ? "#fff" : i === step ? accentColor : "var(--text-4)", border: `2px solid ${i <= step ? accentColor : "var(--border-soft)"}`, transition: "all 0.3s" }}>
                  {i < step ? "✓" : i + 1}
                </div>
                <span style={{ fontSize: "10px", color: i === step ? accentColor : "var(--text-4)", fontWeight: i === step ? 700 : 400, letterSpacing: "0.04em", whiteSpace: "nowrap" }}>{s}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ height: "2px", flex: 1, background: i < step ? accentColor : "var(--border-soft)", transition: "all 0.3s", margin: "0 4px", marginBottom: "20px" }} />
              )}
            </div>
          ))}
        </div>

        {/* Card del paso */}
        <div style={{ ...ss.card, border: `1px solid ${accentColor}33`, background: `linear-gradient(135deg,${accentColor}08,var(--bg-glass))` }}>
          <AnimatePresence mode="wait">
            {isAcctStep && (
              <motion.div key="s-acct" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "6px" }}>Crea tu cuenta</div>
                <div style={{ color: "var(--text-2)", fontSize: "13px", marginBottom: "24px" }}>El admin del club. Podrás invitar a más personas después.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <div style={ss.label}>Tu nombre</div>
                    <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: José Sánchez" style={ss.input} />
                  </div>
                  <div>
                    <div style={ss.label}>Email</div>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="tu@email.com" style={ss.input} />
                  </div>
                  <div>
                    <div style={ss.label}>Contraseña</div>
                    <input type="password" value={pass} onChange={e => setPass(e.target.value)} placeholder="Mínimo 6 caracteres" style={ss.input} />
                  </div>
                </div>
              </motion.div>
            )}

            {isClubStep && (
              <motion.div key="s-club" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                {existingUser && (
                  <div style={{ marginBottom: "16px", padding: "10px 14px", borderRadius: "var(--r-sm)", background: `${accentColor}18`, border: `1px solid ${accentColor}44`, color: accentColor, fontSize: "12px", fontWeight: 600 }}>
                    Hola, {existingUser.nombre}. Ya tienes cuenta. Ahora configura tu club.
                  </div>
                )}
                <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "6px" }}>Tu club</div>
                <div style={{ color: "var(--text-2)", fontSize: "13px", marginBottom: "24px" }}>Así aparecerá en la plataforma.</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div>
                    <div style={ss.label}>Nombre del club</div>
                    <input value={clubName} onChange={e => setClubName(e.target.value)} placeholder="Ej: Rugby Club Santiago" style={ss.input} />
                  </div>
                  <div>
                    <div style={ss.label}>País</div>
                    <select value={country} onChange={e => setCountry(e.target.value)} style={{ ...ss.input, cursor: "pointer" }}>
                      {Object.entries(COUNTRIES).map(([k, v]) => (
                        <option key={k} value={k}>{v.flag} {v.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </motion.div>
            )}

            {isLastStep && (
              <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                <div style={{ fontWeight: 700, fontSize: "18px", marginBottom: "6px" }}>¿Qué deporte?</div>
                <div style={{ color: "var(--text-2)", fontSize: "13px", marginBottom: "20px" }}>Puedes agregar más deportes después.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {Object.entries(SPORTS_CONFIG).map(([k, v]) => (
                    <motion.button key={k} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.96 }} onClick={() => setSport(k)}
                      style={{ padding: "16px 12px", borderRadius: "var(--r-md)", border: `2px solid ${k === sport ? v.color : "var(--border-soft)"}`, cursor: "pointer", background: k === sport ? `${v.color}18` : "var(--bg-elev-2)", color: k === sport ? v.color : "var(--text-2)", textAlign: "center", transition: "all 0.2s", boxShadow: k === sport ? `0 0 16px ${v.color}33` : "none" }}>
                      <div style={{ fontSize: "24px", marginBottom: "6px" }}>{v.icon}</div>
                      <div style={{ fontSize: "12px", fontWeight: k === sport ? 700 : 500 }}>{v.name}</div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {error && (
            <div style={{ marginTop: "16px", padding: "10px 14px", borderRadius: "var(--r-sm)", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: "12px" }}>
              ⚠️ {error}
            </div>
          )}

          <motion.button disabled={busy} whileHover={{ scale: 1.02, y: -1 }} whileTap={{ scale: 0.98 }} onClick={next}
            style={{ ...ss.btn, width: "100%", marginTop: "24px", padding: "14px", fontSize: "14px", fontWeight: 700, background: `linear-gradient(135deg,${accentColor},${accentColor}cc)`, color: "#fff", boxShadow: `0 8px 24px ${accentColor}44`, opacity: busy ? 0.6 : 1 }}>
            {busy ? "Creando tu club..." : !isLastStep ? "Continuar →" : `Crear mi club de ${sp.name} ✓`}
          </motion.button>
        </div>

        {/* O continuar con Google — solo para usuarios nuevos, no para quien ya usó OAuth */}
        {!existingUser && <div style={{marginTop:"16px",textAlign:"center"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",marginBottom:"12px"}}>
            <div style={{flex:1,height:"1px",background:"var(--border-soft)"}}/>
            <span style={{fontSize:"11px",color:"var(--text-4)"}}>o más rápido</span>
            <div style={{flex:1,height:"1px",background:"var(--border-soft)"}}/>
          </div>
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}}
            onClick={async()=>{
              const {error} = await supabase.auth.signInWithOAuth({
                provider:"google",
                options:{redirectTo: window.location.origin}
              });
              if(error) console.error(error.message);
            }}
            style={{width:"100%",padding:"11px",borderRadius:"var(--r-md)",border:"1px solid #e0e0e0",background:"#fff",color:"#1a1a1a",fontSize:"13px",fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:"10px",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(0,0,0,0.12)"}}>
            <svg width="16" height="16" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.08 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.59-13.46-8.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/><path fill="none" d="M0 0h48v48H0z"/></svg>
            Registrarme con Google
          </motion.button>
        </div>}

        {!existingUser && (
          <div style={{ textAlign: "center", marginTop: "16px", fontSize: "12px", color: "var(--text-3)" }}>
            ¿Ya tienes cuenta?{" "}
            <span onClick={() => onComplete(null)} style={{ color: accentColor, cursor: "pointer", fontWeight: 600 }}>Ingresar</span>
          </div>
        )}
      </motion.div>
    </div>
  );
}
