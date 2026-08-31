import { useState, useEffect } from "react";
import { m as motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuroraBg from "../components/AuroraBg";
import BackButton from "../components/BackButton";
import { ss } from "../styles/tokens";

/**
 * Entrar al club solo, con el código — sin esperar que el admin mande nada.
 *
 * Antes el camino era: pedir entrar, que el admin apruebe, que el admin copie
 * un link y lo mande por WhatsApp. Con 109 jugadores eso son 109 mensajes uno
 * por uno, y por eso el club tenía 142 fichas y casi ninguna cuenta.
 *
 * Acá se manda UN link al grupo y cada uno se registra. El servidor
 * (unirme_con_codigo) es quien valida el código y asigna el club: esta
 * pantalla no puede otorgarse nada a sí misma, y el rol siempre es jugador.
 */
export default function UnirmeScreen({ codigoInicial = "", onComplete, onBack, onIrALogin }) {
  const [step,  setStep]  = useState(codigoInicial ? "buscando" : "codigo");
  const [code,  setCode]  = useState(codigoInicial);
  const [club,  setClub]  = useState(null);
  const [form,  setForm]  = useState({ nombre:"", email:"", password:"" });
  const [error, setError] = useState("");
  const [busy,  setBusy]  = useState(false);

  /**
   * Pide al servidor entrar al club. Devuelve la asignación o lanza.
   *
   * Va antes que buscarClub porque esa la llama: declarada después, se leía
   * una constante que en ese punto todavía no existía.
   */
  const canjear = async (codigo) => {
    const { data, error: rpcErr } = await supabase.rpc("unirme_con_codigo", { p_codigo: codigo });
    if (rpcErr) {
      const motivos = {
        codigo_invalido: "Ese código ya no sirve. Pedile el nuevo a tu administrador.",
        ya_perteneces_a_otro_club: "Tu cuenta ya está en otro club. Pedile a ese administrador que te dé de baja primero.",
        sin_sesion: "Se perdió la sesión. Volvé a intentar.",
      };
      const clave = Object.keys(motivos).find(k => rpcErr.message?.includes(k));
      if (clave) throw new Error(motivos[clave]);
      // PGRST202 = la función no existe en la base. Pasa si se desplegó la app
      // sin correr supabase/unirme_con_codigo.sql; el mensaje crudo de
      // PostgREST no le dice nada a un jugador parado en la cancha.
      if (rpcErr.code === "PGRST202") {
        throw new Error("El club todavía no tiene activado el ingreso por código. Avisale a tu administrador.");
      }
      // Cualquier otra cosa es un problema nuestro, y el mensaje crudo de
      // Postgres no le sirve a nadie: el ingreso estuvo roto mostrándole
      // "column reference sport is ambiguous" a quien abría el link. Se avisa
      // en castellano y el detalle queda en la consola, que es donde se busca.
      console.error("[unirme] falló unirme_con_codigo:", rpcErr);
      throw new Error("Tu cuenta quedó creada, pero no pudimos meterte al club. Avisale a tu administrador y volvé a abrir este link — no hace falta que te registres de nuevo.");
    }
    return data?.[0] || null;
  };

  const buscarClub = async (valor) => {
    const codigo = String(valor ?? code).trim();
    if (!codigo) { setError("Escribe el código de tu club."); setStep("codigo"); return; }
    setBusy(true); setError("");
    const { data, error: dbErr } = await supabase.rpc("lookup_club_by_code", { p_code: codigo });
    setBusy(false);
    if (dbErr || !data?.length) {
      setError("Ese código no existe. Pedíselo a tu entrenador o al administrador del club.");
      setStep("codigo");
      return;
    }
    setClub(data[0]);

    // Si ya venía con sesión —abrió el link dos veces, o ya tenía cuenta de
    // antes— no tiene sentido pedirle que se registre de nuevo: se lo mete al
    // club directo. Sin esto, el que reenvía el link al grupo y lo prueba él
    // mismo se topaba con un formulario de registro y creía que estaba roto.
    const { data: sesion } = await supabase.auth.getSession();
    if (sesion?.session?.user) {
      setBusy(true);
      try {
        const asignado = await canjear(codigo);
        const u = sesion.session.user;
        setBusy(false);
        onComplete({
          id: u.id,
          nombre: u.user_metadata?.nombre || data[0].name,
          email: u.email,
          rol: "jugador",
          club: asignado?.club_name || data[0].name,
          club_id: asignado?.club_id || data[0].id,
          sport: asignado?.sport || data[0].sport,
          cats: [],
          isReal: true,
        });
        return;
      } catch (e) {
        setBusy(false);
        // El caso más común acá: ya es de otro club, o ya es admin de este.
        // Se muestra el motivo y se lo deja seguir a mano.
        setError(e.message);
      }
    }

    setStep("form");
  };

  // Con el código en el link (?unirme=CODIGO) se salta el primer paso.
  useEffect(() => {
    if (codigoInicial) buscarClub(codigoInicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigoInicial]);

  const registrarme = async () => {
    if (!form.nombre.trim())     { setError("Escribí tu nombre y apellido."); return; }
    if (!form.email.includes("@")) { setError("Ese correo no parece válido."); return; }
    if (form.password.length < 6)  { setError("La contraseña necesita al menos 6 caracteres."); return; }
    setBusy(true); setError("");

    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        // El código viaja en el metadata: si el club pide confirmar el correo,
        // la sesión llega recién en el próximo login y se canjea ahí. Sin esto
        // el registro quedaría hecho y la persona sin club.
        options: { data: { nombre: form.nombre.trim(), codigo_club: code.trim() } },
      });

      if (authErr) {
        // El caso más común de todos: ya tiene cuenta de un intento anterior.
        if (/already|registrad/i.test(authErr.message)) {
          setError("Ya existe una cuenta con ese correo. Iniciá sesión y volvé a abrir este link.");
          setBusy(false);
          return;
        }
        throw authErr;
      }

      if (!authData.session) { setBusy(false); setStep("confirmar"); return; }

      const asignado = await canjear(code.trim());
      setBusy(false);
      onComplete({
        id: authData.user.id,
        nombre: form.nombre.trim(),
        email: form.email.trim(),
        rol: "jugador",
        club: asignado?.club_name || club?.name,
        club_id: asignado?.club_id || club?.id,
        sport: asignado?.sport || club?.sport,
        cats: [],
        isReal: true,
      });
    } catch (e) {
      setBusy(false);
      setError(e.message || "No se pudo completar el registro.");
    }
  };

  const acento = "#22C55E";
  const caja = { position:"relative", zIndex:2, width:"100%", maxWidth:"400px" };
  const pantalla = { position:"relative", minHeight:"100vh", display:"flex",
                     alignItems:"center", justifyContent:"center", padding:"24px 16px" };

  if (step === "buscando") return (
    <div style={pantalla}>
      <AuroraBg/>
      <div style={{...caja, textAlign:"center", color:"var(--text-3)"}}>Buscando tu club…</div>
    </div>
  );

  if (step === "confirmar") return (
    <div style={pantalla}>
      <AuroraBg/>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} style={{...caja, textAlign:"center"}}>
        <div style={{fontSize:"52px", marginBottom:"12px"}}>📩</div>
        <div style={{fontWeight:900, fontSize:"22px", marginBottom:"10px"}}>Confirmá tu correo</div>
        <div style={{fontSize:"13px", color:"var(--text-2)", lineHeight:1.6, marginBottom:"22px"}}>
          Te mandamos un mail a <strong style={{color:"var(--text-1)"}}>{form.email}</strong>.
          Abrilo, tocá el enlace y volvé a entrar: ahí quedás dentro de {club?.name}.
        </div>
        <button onClick={onIrALogin}
          style={{...ss.btn, width:"100%", padding:"13px", background:acento, color:"#04120A", fontWeight:700}}>
          Ir a iniciar sesión
        </button>
      </motion.div>
    </div>
  );

  if (step === "codigo") return (
    <div style={pantalla}>
      <AuroraBg/>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} style={caja}>
        <div style={{position:"absolute", left:0, top:0}}><BackButton onClick={onBack} label="Inicio"/></div>
        <div style={{textAlign:"center", paddingTop:"48px", marginBottom:"28px"}}>
          <div style={{fontSize:"52px", marginBottom:"12px"}}>🔑</div>
          <div style={{fontWeight:900, fontSize:"24px", letterSpacing:"-0.03em", marginBottom:"8px"}}>
            Entrar a mi club
          </div>
          <div style={{fontSize:"13px", color:"var(--text-3)"}}>
            Pedile el código a tu entrenador o al administrador
          </div>
        </div>
        <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())}
          onKeyDown={e=>e.key==="Enter"&&buscarClub()}
          placeholder="RUGBY-4F2A" autoFocus
          style={{...ss.input, width:"100%", textAlign:"center", fontSize:"18px",
                  letterSpacing:"0.08em", fontWeight:700, padding:"14px"}}/>
        {error && <div style={{color:"#EF4444", fontSize:"12.5px", marginTop:"10px", textAlign:"center"}}>{error}</div>}
        <button onClick={()=>buscarClub()} disabled={busy}
          style={{...ss.btn, width:"100%", marginTop:"14px", padding:"13px",
                  background:acento, color:"#04120A", fontWeight:700, opacity:busy?0.6:1}}>
          {busy ? "Buscando…" : "Continuar"}
        </button>
      </motion.div>
    </div>
  );

  return (
    <div style={pantalla}>
      <AuroraBg/>
      <motion.div initial={{opacity:0,y:24}} animate={{opacity:1,y:0}} style={caja}>
        <div style={{position:"absolute", left:0, top:0}}>
          <BackButton onClick={()=>{ setStep("codigo"); setError(""); }} label="Atrás"/>
        </div>
        <div style={{textAlign:"center", paddingTop:"48px", marginBottom:"22px"}}>
          <div style={{fontSize:"12px", color:"var(--text-3)", marginBottom:"6px"}}>Te estás uniendo a</div>
          <div style={{fontWeight:900, fontSize:"24px", letterSpacing:"-0.03em"}}>{club?.name}</div>
        </div>

        <input value={form.nombre} onChange={e=>setForm(f=>({...f, nombre:e.target.value}))}
          placeholder="Nombre y apellido" autoFocus
          style={{...ss.input, width:"100%", marginBottom:"10px", padding:"13px"}}/>
        {/* El nombre completo importa más de lo que parece: con él la app
            engancha la ficha que ya existe —con su asistencia y sus tries de
            todo el año— en vez de crear una vacía. */}
        <div style={{fontSize:"11px", color:"var(--text-3)", marginBottom:"14px", lineHeight:1.5}}>
          Escribilo como aparece en las nóminas del club, así encontramos tus partidos y tus tries.
        </div>

        <input value={form.email} onChange={e=>setForm(f=>({...f, email:e.target.value}))}
          placeholder="Tu correo" type="email" autoComplete="email"
          style={{...ss.input, width:"100%", marginBottom:"10px", padding:"13px"}}/>
        <input value={form.password} onChange={e=>setForm(f=>({...f, password:e.target.value}))}
          placeholder="Una contraseña (mínimo 6)" type="password" autoComplete="new-password"
          onKeyDown={e=>e.key==="Enter"&&registrarme()}
          style={{...ss.input, width:"100%", padding:"13px"}}/>

        {error && <div style={{color:"#EF4444", fontSize:"12.5px", marginTop:"12px", lineHeight:1.5}}>{error}</div>}

        <button onClick={registrarme} disabled={busy}
          style={{...ss.btn, width:"100%", marginTop:"16px", padding:"14px",
                  background:acento, color:"#04120A", fontWeight:700, fontSize:"15px", opacity:busy?0.6:1}}>
          {busy ? "Entrando…" : "Entrar al club"}
        </button>
        <button onClick={onIrALogin}
          style={{...ss.btn, width:"100%", marginTop:"8px", padding:"12px", background:"transparent",
                  color:"var(--text-3)", border:"1px solid var(--border-soft)", fontSize:"12.5px"}}>
          Ya tengo cuenta
        </button>
      </motion.div>
    </div>
  );
}
