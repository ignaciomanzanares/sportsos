import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { supabase } from "../lib/supabase";
import { SPORTS_CONFIG } from "../data/sports";

const GRUPOS = ["A+","A-","B+","B-","AB+","AB-","O+","O-"];
const SEGUROS = ["Fonasa A","Fonasa B","Fonasa C","Fonasa D","Isapre","Sin seguro","Otro"];

function Field({ label, children }) {
  return (
    <div>
      <div style={ss.label}>{label}</div>
      {children}
    </div>
  );
}

function ReadRow({ label, value, icon }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"10px 0", borderBottom:"1px solid var(--border-soft)" }}>
      <span style={{ fontSize:"12px", color:"var(--text-3)" }}>{icon} {label}</span>
      <span style={{ fontSize:"13px", fontWeight:600, color:"var(--text-1)" }}>{value || "—"}</span>
    </div>
  );
}

export default function PerfilView({ currentUser, sport, sportColor, readOnly=false, playerData=null, onSaved }) {
  const sp = SPORTS_CONFIG[sport] || SPORTS_CONFIG.rugby;
  const positions = sp.positions || [];
  // En rugby hay dos Lock y dos Centro de verdad, pero como opciones de un
  // desplegable repetirlas no aporta nada y ademas rompia las keys de React.
  const posicionesUnicas = [...new Set(positions)];

  const emptyForm = {
    nombre:"", email:"", telefono:"", direccion:"",
    fecha_nacimiento:"", altura_cm:"", peso_kg:"",
    posicion_1:"", posicion_2:"",
    seguro_salud:"", grupo_sanguineo:"",
    contacto_emergencia_nombre:"", contacto_emergencia_tel:"",
    pie_hab:"", numero_camiseta:"",
  };

  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [tab, setTab] = useState("personal");
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoLinkedWarn, setPhotoLinkedWarn] = useState(false);
  const [uploadError, setUploadError] = useState("");

  // Edad calculada
  const edad = form.fecha_nacimiento
    ? Math.floor((Date.now() - new Date(form.fecha_nacimiento)) / (365.25 * 24 * 3600 * 1000))
    : null;

  useEffect(() => {
    const source = readOnly ? playerData : currentUser;
    if (!source) { setLoading(false); return; }

    if (readOnly && playerData) {
      // playerData es una fila de "players" (position/altura_m/número/etc),
      // pero el form espera las columnas de "profiles" (posicion_1/altura_cm/
      // numero_camiseta/etc) — sin este mapeo, Posición/Altura/Contacto de
      // emergencia salían siempre vacíos aunque el dato existiera en players.
      setForm({
        ...emptyForm,
        nombre: playerData.name || playerData.nombre || "",
        email: playerData.email || "",
        telefono: playerData.telefono || "",
        fecha_nacimiento: playerData.fecha_nacimiento || "",
        altura_cm: playerData.altura_m ? Math.round(Number(playerData.altura_m) * 100) : "",
        peso_kg: playerData.peso_kg || "",
        posicion_1: playerData.position || "",
        seguro_salud: playerData.isapre || playerData.seguro || "",
        contacto_emergencia_nombre: playerData.contacto_emergencia_nombre || "",
        contacto_emergencia_tel: playerData.contacto_emergencia_telefono || "",
        numero_camiseta: playerData.number || "",
      });
      setLoading(false);
      return;
    }

    // Cargar desde Supabase
    if (currentUser?.id) {
      supabase.from("profiles").select("*").eq("id", currentUser.id).single()
        .then(({ data }) => {
          if (data) setForm(f => ({ ...f, ...data, email: currentUser.email || data.email || "" }));
          else setForm(f => ({ ...f, nombre: currentUser.nombre || "", email: currentUser.email || "" }));
          setLoading(false);
        });
      // Cargar foto si existe
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(`${currentUser.id}.jpg`);
      if (urlData?.publicUrl) setAvatarUrl(urlData.publicUrl + "?t=" + Date.now());
    } else {
      setForm(f => ({ ...f, nombre: currentUser?.nombre || "", email: currentUser?.email || "" }));
      setLoading(false);
    }
  }, [currentUser, playerData, readOnly]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser?.id) return;
    setUploadingPhoto(true);
    setUploadError("");
    const path = `${currentUser.id}.jpg`;
    const { error } = await supabase.storage.from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) {
      setUploadError(`Error al subir: ${error.message}`);
      setUploadingPhoto(false);
      return;
    }
    if (!error) {
      const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
      const cleanUrl = urlData.publicUrl;
      setAvatarUrl(cleanUrl + "?t=" + Date.now());
      // Guardar en profiles
      await supabase.from("profiles").update({ avatar_url: cleanUrl }).eq("id", currentUser.id);
      // Actualizar players por profile_id (funciona si el admin usó el botón 🔗 Invitar)
      const { data: updated } = await supabase
        .from("players")
        .update({ avatar_url: cleanUrl })
        .eq("profile_id", currentUser.id)
        .select("id");
      // Fallback: si no se vinculó por profile_id, buscar por club_id + sin cuenta vinculada
      // y vincular automáticamente si hay exactamente uno que coincide por nombre
      if ((!updated || updated.length === 0) && currentUser.club_id) {
        const { data: candidates } = await supabase
          .from("players")
          .select("id, name")
          .eq("club_id", currentUser.club_id)
          .is("profile_id", null);
        if (candidates?.length === 1) {
          // Solo un jugador sin vincular en el club → vincular automáticamente
          await supabase.from("players")
            .update({ avatar_url: cleanUrl, profile_id: currentUser.id })
            .eq("id", candidates[0].id);
        } else {
          // Varios jugadores sin vincular → no podemos saber cuál es → avisar
          setPhotoLinkedWarn(true);
        }
      }
    }
    setUploadingPhoto(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    if (currentUser?.id) {
      const { error } = await supabase.from("profiles").update({
        nombre: form.nombre, telefono: form.telefono, direccion: form.direccion,
        fecha_nacimiento: form.fecha_nacimiento || null,
        altura_cm: form.altura_cm ? Number(form.altura_cm) : null,
        peso_kg: form.peso_kg ? Number(form.peso_kg) : null,
        posicion_1: form.posicion_1, posicion_2: form.posicion_2,
        seguro_salud: form.seguro_salud, grupo_sanguineo: form.grupo_sanguineo,
        contacto_emergencia_nombre: form.contacto_emergencia_nombre,
        contacto_emergencia_tel: form.contacto_emergencia_tel,
        pie_hab: form.pie_hab,
      }).eq("id", currentUser.id);
      setSaving(false);
      if (error) { setSaveError("Error al guardar: " + error.message); return; }
    } else {
      setSaving(false);
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
    if (onSaved) onSaved({ ...form, avatar_url: avatarUrl });
  };

  const TABS = [
    { id:"personal", label:"Personal" },
    { id:"deportivo", label:"Deportivo" },
    { id:"salud", label:"Salud" },
    { id:"emergencia", label:"Emergencia" },
  ];

  if (loading) return (
    <div style={{ display:"flex", justifyContent:"center", padding:"60px", color:"var(--text-3)" }}>
      Cargando perfil...
    </div>
  );

  // ── Modo solo lectura (entrenador/admin viendo jugador) ──
  if (readOnly) return (
    <motion.div {...fadeUp}>
      {/* Avatar y nombre */}
      <div style={{ display:"flex", alignItems:"center", gap:"18px", marginBottom:"24px" }}>
        {playerData?.avatar_url
          ? <img src={playerData.avatar_url} alt={form.nombre}
              style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover",
                border:`2.5px solid ${sportColor}55`, boxShadow:`0 0 20px ${sportColor}44`, flexShrink:0 }}/>
          : <div style={{ width:"72px", height:"72px", borderRadius:"50%",
              background:`linear-gradient(135deg,${sportColor}44,${sportColor}11)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:"28px", fontWeight:800, color:sportColor,
              border:`2.5px solid ${sportColor}55`,
              boxShadow:`0 0 20px ${sportColor}44`, flexShrink:0 }}>
              {(form.nombre||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
            </div>
        }
        <div>
          <div style={{ fontSize:"20px", fontWeight:800 }}>{form.nombre || "Jugador"}</div>
          <div style={{ display:"flex", gap:"8px", marginTop:"6px", flexWrap:"wrap" }}>
            {form.posicion_1 && <span style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"99px",
              background:`${sportColor}18`, color:sportColor, border:`1px solid ${sportColor}33`, fontWeight:600 }}>
              {form.posicion_1}
            </span>}
            {form.numero_camiseta && <span style={{ fontSize:"11px", padding:"3px 10px", borderRadius:"99px",
              background:"var(--bg-elev-2)", color:"var(--text-2)", fontWeight:600 }}>
              #{form.numero_camiseta}
            </span>}
            {edad && <span style={{ fontSize:"11px", color:"var(--text-3)" }}>{edad} años</span>}
          </div>
        </div>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
        <div style={{ ...ss.card, padding:"18px" }}>
          <div style={{ fontWeight:700, fontSize:"12px", color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:"12px" }}>Personal</div>
          <ReadRow icon="📅" label="Fecha nacimiento" value={form.fecha_nacimiento}/>
          <ReadRow icon="📏" label="Altura" value={form.altura_cm ? `${form.altura_cm} cm` : null}/>
          <ReadRow icon="⚖️" label="Peso" value={form.peso_kg ? `${form.peso_kg} kg` : null}/>
          <ReadRow icon="📞" label="Teléfono" value={form.telefono}/>
          <ReadRow icon="📍" label="Dirección" value={form.direccion}/>
        </div>
        <div style={{ ...ss.card, padding:"18px" }}>
          <div style={{ fontWeight:700, fontSize:"12px", color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:"12px" }}>Deportivo & Salud</div>
          <ReadRow icon="🎽" label="Posición principal" value={form.posicion_1}/>
          <ReadRow icon="🔄" label="Posición secundaria" value={form.posicion_2}/>
          <ReadRow icon="🦶" label="Pie/mano hábil" value={form.pie_hab}/>
          <ReadRow icon="🩸" label="Grupo sanguíneo" value={form.grupo_sanguineo}/>
          <ReadRow icon="🏥" label="Seguro de salud" value={form.seguro_salud}/>
        </div>
        <div style={{ ...ss.card, padding:"18px", gridColumn:"span 2" }}>
          <div style={{ fontWeight:700, fontSize:"12px", color:"var(--text-3)", textTransform:"uppercase",
            letterSpacing:"0.07em", marginBottom:"12px" }}>Contacto de emergencia</div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
            <ReadRow icon="👤" label="Nombre" value={form.contacto_emergencia_nombre}/>
            <ReadRow icon="📞" label="Teléfono" value={form.contacto_emergencia_tel}/>
          </div>
        </div>
      </div>
    </motion.div>
  );

  // ── Modo edición (el propio jugador/admin) ──
  return (
    <motion.div {...fadeUp}>
      {/* Avatar con subida de foto */}
      <div style={{ display:"flex", alignItems:"center", gap:"18px", marginBottom:"28px" }}>
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:"8px", flexShrink:0 }}>
          {avatarUrl
            ? <img src={avatarUrl} alt="foto" onError={()=>setAvatarUrl(null)}
                style={{ width:72, height:72, borderRadius:"50%", objectFit:"cover",
                  border:`2.5px solid ${sportColor}55`, boxShadow:`0 0 20px ${sportColor}44` }}/>
            : <div style={{ width:72, height:72, borderRadius:"50%",
                background:`linear-gradient(135deg,${sportColor}44,${sportColor}11)`,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:"26px", fontWeight:800, color:sportColor,
                border:`2.5px solid ${sportColor}55`, boxShadow:`0 0 20px ${sportColor}44` }}>
                {(form.nombre||"?").split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
              </div>
          }
          <label htmlFor="photo-upload"
            style={{ display:"flex", alignItems:"center", gap:"5px", cursor:"pointer",
              padding:"5px 10px", borderRadius:"var(--r-sm)", fontSize:"11px", fontWeight:600,
              background:`${sportColor}18`, border:`1px solid ${sportColor}44`, color:sportColor }}>
            {uploadingPhoto ? "⏳ Subiendo..." : "📷 Cambiar foto"}
          </label>
          <input id="photo-upload" type="file" accept="image/*" onChange={handlePhotoUpload}
            style={{ display:"none" }}/>
          {photoLinkedWarn && (
            <div style={{ fontSize:"10px", color:"#F59E0B", textAlign:"center", maxWidth:"110px", lineHeight:1.4 }}>
              ⚠️ Foto guardada. Pide al admin el link personal para vincular al equipo.
            </div>
          )}
          {uploadError && (
            <div style={{ fontSize:"10px", color:"#EF4444", textAlign:"center", maxWidth:"110px", lineHeight:1.4 }}>
              ❌ {uploadError}
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize:"20px", fontWeight:800 }}>{form.nombre || "Mi Perfil"}</div>
          <div style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"3px" }}>{form.email}</div>
          {edad && <div style={{ fontSize:"11px", color:sportColor, marginTop:"4px", fontWeight:600 }}>{edad} años</div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", gap:"4px", background:"var(--bg-elev-2)", borderRadius:"var(--r-md)",
        padding:"4px", marginBottom:"20px", overflowX:"auto" }}>
        {TABS.map(t => (
          <motion.button key={t.id} whileTap={{ scale:0.97 }} onClick={() => setTab(t.id)}
            style={{ flex:1, padding:"8px 12px", borderRadius:"var(--r-sm)", border:"none",
              cursor:"pointer", fontSize:"12px", fontWeight:tab===t.id?700:500,
              background:tab===t.id?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"transparent",
              color:tab===t.id?sportColor:"var(--text-2)", transition:"all 0.2s",
              whiteSpace:"nowrap" }}>
            {t.label}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {tab==="personal" && (
          <motion.div key="personal" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}
            style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <Field label="Nombre completo">
                <input value={form.nombre} onChange={e=>set("nombre",e.target.value)} style={ss.input} placeholder="Tu nombre"/>
              </Field>
              <Field label="Email">
                <input value={form.email} disabled style={{ ...ss.input, opacity:0.5 }}/>
              </Field>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <Field label="Teléfono">
                <input value={form.telefono} onChange={e=>set("telefono",e.target.value)} style={ss.input} placeholder="+56 9 1234 5678"/>
              </Field>
              <Field label="Fecha de nacimiento">
                <input type="date" value={form.fecha_nacimiento} onChange={e=>set("fecha_nacimiento",e.target.value)} style={ss.input}/>
              </Field>
            </div>
            <Field label="Dirección">
              <input value={form.direccion} onChange={e=>set("direccion",e.target.value)} style={ss.input} placeholder="Calle, número, ciudad"/>
            </Field>
          </motion.div>
        )}

        {tab==="deportivo" && (
          <motion.div key="deportivo" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}
            style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <Field label="Posición principal">
                <select value={form.posicion_1} onChange={e=>set("posicion_1",e.target.value)} style={{ ...ss.input, cursor:"pointer" }}>
                  <option value="">Seleccionar</option>
                  {posicionesUnicas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Posición secundaria">
                <select value={form.posicion_2} onChange={e=>set("posicion_2",e.target.value)} style={{ ...ss.input, cursor:"pointer" }}>
                  <option value="">Seleccionar</option>
                  {posicionesUnicas.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            </div>
            {/* El número de camiseta lo asigna el club, no el jugador: se saca
                del formulario. Se sigue mostrando arriba, junto al nombre. */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <Field label="Pie / mano hábil">
                <select value={form.pie_hab} onChange={e=>set("pie_hab",e.target.value)} style={{ ...ss.input, cursor:"pointer" }}>
                  <option value="">Seleccionar</option>
                  <option>Derecho</option>
                  <option>Izquierdo</option>
                  <option>Ambos</option>
                </select>
              </Field>
              <Field label="Altura (cm)">
                <input type="number" value={form.altura_cm} onChange={e=>set("altura_cm",e.target.value)} style={ss.input} placeholder="Ej: 178" min="100" max="250"/>
              </Field>
            </div>
            <Field label="Peso (kg)">
              <input type="number" value={form.peso_kg} onChange={e=>set("peso_kg",e.target.value)} style={{ ...ss.input, maxWidth:"140px" }} placeholder="Ej: 82" min="30" max="200"/>
            </Field>
          </motion.div>
        )}

        {tab==="salud" && (
          <motion.div key="salud" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}
            style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <Field label="Seguro de salud">
                <select value={form.seguro_salud} onChange={e=>set("seguro_salud",e.target.value)} style={{ ...ss.input, cursor:"pointer" }}>
                  <option value="">Seleccionar</option>
                  {SEGUROS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
              <Field label="Grupo sanguíneo">
                <select value={form.grupo_sanguineo} onChange={e=>set("grupo_sanguineo",e.target.value)} style={{ ...ss.input, cursor:"pointer" }}>
                  <option value="">Seleccionar</option>
                  {GRUPOS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ ...ss.card, padding:"14px", background:"rgba(192,57,43,0.05)", border:"1px solid rgba(192,57,43,0.15)" }}>
              <div style={{ fontSize:"11px", color:"var(--text-3)", lineHeight:1.6 }}>
                🔒 Esta información es confidencial y solo la verán los entrenadores y el admin del club. Nunca se comparte fuera de SportOS.
              </div>
            </div>
          </motion.div>
        )}

        {tab==="emergencia" && (
          <motion.div key="emergencia" initial={{opacity:0,x:10}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-10}}
            style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
            <div style={{ fontSize:"13px", color:"var(--text-2)", marginBottom:"4px" }}>
              En caso de lesión o emergencia durante un partido o entrenamiento, ¿a quién avisamos?
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"14px" }}>
              <Field label="Nombre del contacto">
                <input value={form.contacto_emergencia_nombre} onChange={e=>set("contacto_emergencia_nombre",e.target.value)} style={ss.input} placeholder="Ej: María Rodríguez"/>
              </Field>
              <Field label="Teléfono de contacto">
                <input value={form.contacto_emergencia_tel} onChange={e=>set("contacto_emergencia_tel",e.target.value)} style={ss.input} placeholder="+56 9 8765 4321"/>
              </Field>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botón guardar */}
      <div style={{ marginTop:"24px", display:"flex", alignItems:"center", gap:"12px" }}>
        <motion.button whileHover={{ scale:1.03, y:-2 }} whileTap={{ scale:0.97 }}
          onClick={handleSave} disabled={saving}
          style={{ ...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,
            color:"#fff", padding:"12px 28px", fontSize:"14px", fontWeight:700,
            boxShadow:`0 8px 24px ${sportColor}44`, opacity:saving?0.7:1 }}>
          {saving ? "Guardando..." : "Guardar cambios"}
        </motion.button>
        <AnimatePresence>
          {saved && (
            <motion.div initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} exit={{opacity:0}}
              style={{ fontSize:"13px", color:"#1FA04A", fontWeight:600 }}>
              ✅ Guardado
            </motion.div>
          )}
        </AnimatePresence>
        {saveError && (
          <div style={{ fontSize:"12px", color:"#EF4444", marginTop:"4px" }}>⚠️ {saveError}</div>
        )}
      </div>
    </motion.div>
  );
}
