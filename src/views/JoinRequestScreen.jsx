import { useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { SPORTS_CONFIG, puestosDeFicha } from "../data/sports";
import AuroraBg from "../components/AuroraBg";
import BackButton from "../components/BackButton";
import { ss } from "../styles/tokens";

export default function JoinRequestScreen({ onBack }) {
  const [step, setStep]     = useState("code"); // "code" | "form" | "success"
  const [code, setCode]     = useState("");
  const [club, setClub]     = useState(null);   // { id, name, sport }
  const [busy, setBusy]     = useState(false);
  const [error, setError]   = useState("");
  const [form, setForm]     = useState({ nombre:"", email:"", posicion:"", categoria:"" });

  const sp          = club ? (SPORTS_CONFIG[club.sport] || SPORTS_CONFIG.rugby) : null;
  const accentColor = sp?.color || "#3B82F6";

  const lookupCode = async () => {
    if (!code.trim()) { setError("Escribe el código de tu club."); return; }
    setBusy(true);
    setError("");
    const { data, error: dbErr } = await supabase
      .rpc("lookup_club_by_code", { p_code: code.trim() });
    setBusy(false);
    if (dbErr || !data || data.length === 0) {
      setError("Código no encontrado. Pídele el código correcto a tu administrador.");
      return;
    }
    setClub(data[0]);
    setStep("form");
  };

  const submitRequest = async () => {
    if (!form.nombre.trim()) { setError("Escribe tu nombre."); return; }
    if (!form.email.includes("@")) { setError("Email inválido."); return; }
    setBusy(true);
    setError("");
    const { error: dbErr } = await supabase
      .from("join_requests")
      .insert({
        club_id:  club.id,
        nombre:   form.nombre.trim(),
        email:    form.email.trim(),
        posicion: form.posicion,
        categoria: form.categoria,
        status:   "pendiente",
      });
    setBusy(false);
    if (dbErr) { setError("Error al enviar. Intenta de nuevo."); return; }
    setStep("success");
  };

  // ── Pantalla: ingresar código ──────────────────────────────────────────
  if (step === "code") return (
    <div style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:"24px 16px" }}>
      <AuroraBg/>
      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
        style={{ position:"relative", zIndex:2, width:"100%", maxWidth:"400px" }}>

        <div style={{ position:"absolute", left:0, top:0 }}>
          <BackButton onClick={onBack} label="Inicio"/>
        </div>

        <div style={{ textAlign:"center", paddingTop:"48px", marginBottom:"28px" }}>
          <div style={{ fontSize:"52px", marginBottom:"12px" }}>🔑</div>
          <div style={{ fontWeight:900, fontSize:"24px", letterSpacing:"-0.03em", marginBottom:"8px" }}>
            Unirme a un club
          </div>
          <div style={{ fontSize:"13px", color:"var(--text-3)" }}>
            Pídele el código a tu administrador o entrenador
          </div>
        </div>

        <div style={ss.card}>
          <div style={ss.label}>Código de club</div>
          <input
            value={code}
            onChange={e => { setCode(e.target.value.toUpperCase()); setError(""); }}
            onKeyDown={e => e.key === "Enter" && lookupCode()}
            placeholder="Ej: RUGBY-4F2A"
            autoFocus
            style={{ ...ss.input, fontSize:"20px", fontFamily:"monospace", letterSpacing:"0.1em",
              textAlign:"center", textTransform:"uppercase", padding:"14px 16px" }}
          />
          {error && (
            <div style={{ color:"#EF4444", fontSize:"12px", marginTop:"8px" }}>⚠️ {error}</div>
          )}
          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
            onClick={lookupCode} disabled={busy}
            style={{ ...ss.btn, width:"100%", marginTop:"16px", padding:"14px", fontWeight:700,
              fontSize:"14px", background:"linear-gradient(135deg,#3B82F6,#2563EB)",
              color:"#fff", boxShadow:"0 6px 20px rgba(59,130,246,0.4)", opacity:busy?0.6:1 }}>
            {busy ? "Buscando..." : "Buscar club →"}
          </motion.button>
        </div>

        <div style={{ textAlign:"center", marginTop:"14px", fontSize:"12px", color:"var(--text-4)" }}>
          El código te lo da el admin del club. Tiene el formato DEPORTE-XXXX.
        </div>
      </motion.div>
    </div>
  );

  // ── Pantalla: formulario ───────────────────────────────────────────────
  if (step === "form") return (
    <div style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", padding:"24px 16px", overflowY:"auto" }}>
      <AuroraBg/>
      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
        style={{ position:"relative", zIndex:2, width:"100%", maxWidth:"420px" }}>

        <div style={{ position:"absolute", left:0, top:0 }}>
          <BackButton onClick={() => { setStep("code"); setError(""); }} label="Atrás"/>
        </div>

        {/* Cabecera del club */}
        <div style={{ textAlign:"center", paddingTop:"48px", marginBottom:"20px" }}>
          <div style={{ fontSize:"44px", marginBottom:"8px" }}>{sp?.icon}</div>
          <div style={{ fontWeight:900, fontSize:"22px", color:accentColor,
            filter:`drop-shadow(0 0 12px ${accentColor}66)` }}>
            {club.name}
          </div>
          <div style={{ marginTop:"6px" }}>
            <span style={{ padding:"3px 12px", borderRadius:"99px",
              background:`${accentColor}18`, color:accentColor,
              border:`1px solid ${accentColor}33`, fontWeight:700, fontSize:"11px" }}>
              {sp?.name}
            </span>
          </div>
        </div>

        <div style={{ ...ss.card, border:`1px solid ${accentColor}22` }}>
          <div style={{ fontWeight:700, fontSize:"15px", marginBottom:"18px" }}>
            Tu información
          </div>

          <div style={{ marginBottom:"14px" }}>
            <div style={ss.label}>Nombre completo *</div>
            <input value={form.nombre}
              onChange={e => setForm(p => ({ ...p, nombre:e.target.value }))}
              placeholder="Ej: Pablo Rodríguez" style={ss.input}/>
          </div>

          <div style={{ marginBottom:"14px" }}>
            <div style={ss.label}>Email *</div>
            <input type="email" value={form.email}
              onChange={e => setForm(p => ({ ...p, email:e.target.value }))}
              placeholder="tu@email.com" style={ss.input}/>
          </div>

          {sp?.positions?.length > 0 && (
            <div style={{ marginBottom:"14px" }}>
              <div style={ss.label}>Posición <span style={{ color:"var(--text-4)", fontWeight:400 }}>(opcional)</span></div>
              <select value={form.posicion}
                onChange={e => setForm(p => ({ ...p, posicion:e.target.value }))}
                style={{ ...ss.input, cursor:"pointer" }}>
                <option value="">Sin especificar</option>
                {puestosDeFicha(sp).map(pos => <option key={pos} value={pos}>{pos}</option>)}
              </select>
            </div>
          )}

          {sp?.categories?.length > 0 && (
            <div style={{ marginBottom:"20px" }}>
              <div style={ss.label}>Categoría <span style={{ color:"var(--text-4)", fontWeight:400 }}>(opcional)</span></div>
              {/* Agrupadas cuando el deporte lo define: en rugby, Pre-Intermedia,
                  Intermedia y Primera no son edades distintas — son los tres
                  equipos que el club tiene en adulta. Sueltas entre menores
                  y juveniles se leen como si fueran categorías de edad. */}
              {(sp.categoryGroups || [{ label:null, cats:sp.categories }]).map(grupo => (
                <div key={grupo.label || "todas"} style={{ marginTop:"8px" }}>
                  {grupo.label && (
                    <div style={{ fontSize:"10px", color:"var(--text-4)", letterSpacing:"0.06em",
                      textTransform:"uppercase", marginBottom:"5px" }}>{grupo.label}</div>
                  )}
                  <div style={{ display:"flex", gap:"6px", flexWrap:"wrap" }}>
                    {grupo.cats.map(cat => (
                      <motion.button key={cat} whileTap={{ scale:0.96 }}
                        onClick={() => setForm(p => ({ ...p, categoria: p.categoria === cat ? "" : cat }))}
                        style={{ ...ss.btn, fontSize:"12px", padding:"7px 14px",
                          background: form.categoria === cat ? `${accentColor}22` : "var(--bg-elev-2)",
                          color:      form.categoria === cat ? accentColor : "var(--text-2)",
                          border:`1px solid ${form.categoria === cat ? accentColor+"55" : "var(--border-soft)"}` }}>
                        {form.categoria === cat ? "✅ " : ""}{cat}
                      </motion.button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div style={{ color:"#EF4444", fontSize:"12px", marginBottom:"12px" }}>⚠️ {error}</div>
          )}

          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
            onClick={submitRequest} disabled={busy}
            style={{ ...ss.btn, width:"100%", padding:"14px", fontWeight:700, fontSize:"14px",
              background:`linear-gradient(135deg,${accentColor},${accentColor}cc)`,
              color:"#fff", boxShadow:`0 6px 20px ${accentColor}44`, opacity:busy?0.6:1 }}>
            {busy ? "Enviando solicitud..." : "Enviar solicitud →"}
          </motion.button>

          <div style={{ fontSize:"11px", color:"var(--text-4)", textAlign:"center", marginTop:"10px" }}>
            El administrador del club revisa tu solicitud y te manda el link para crear tu cuenta.
          </div>
        </div>
      </motion.div>
    </div>
  );

  // ── Pantalla: éxito ────────────────────────────────────────────────────
  return (
    <div style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", padding:"24px 16px" }}>
      <AuroraBg/>
      <motion.div initial={{ scale:0.8, opacity:0 }} animate={{ scale:1, opacity:1 }}
        transition={{ type:"spring", stiffness:300, damping:22 }}
        style={{ position:"relative", zIndex:2, width:"100%", maxWidth:"400px", textAlign:"center" }}>
        <div style={{ ...ss.card, padding:"40px 32px" }}>
          <motion.div initial={{ scale:0 }} animate={{ scale:1 }}
            transition={{ delay:0.2, type:"spring", stiffness:400, damping:20 }}
            style={{ fontSize:"56px", marginBottom:"16px" }}>
            ✅
          </motion.div>
          <div style={{ fontWeight:900, fontSize:"22px", marginBottom:"8px" }}>
            ¡Solicitud enviada!
          </div>
          <div style={{ fontSize:"13px", color:"var(--text-2)", lineHeight:1.8, marginBottom:"20px" }}>
            Tu solicitud quedó registrada en{" "}
            <strong style={{ color:accentColor }}>{club.name}</strong>.<br/>
            Cuando el administrador la apruebe, te manda el link para crear tu cuenta.
          </div>
          {/* SportOS todavía no envía correos: el link se lo pasa el admin por
              WhatsApp o mail desde su panel. Prometer "revisa tu bandeja" dejaba
              a la gente esperando un email que nunca iba a llegar. */}
          <div style={{ padding:"12px 16px", borderRadius:"var(--r-md)",
            background:`${accentColor}10`, border:`1px solid ${accentColor}22`,
            fontSize:"12px", color:"var(--text-2)", marginBottom:"24px" }}>
            Te va a escribir a <strong>{form.email}</strong> o por WhatsApp. Si tienes apuro,
            pídele directamente el link a tu entrenador.
          </div>
          <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }} onClick={onBack}
            style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-1)",
              border:"1px solid var(--border-soft)", fontSize:"13px", padding:"11px 28px" }}>
            ← Volver al inicio
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
