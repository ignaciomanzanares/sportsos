import { useState, useEffect } from "react";
import { m as motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { SPORTS_CONFIG } from "../data/sports";
import { supabase } from "../lib/supabase";
import SectionTitle from "../components/SectionTitle";
import Badge from "../components/Badge";

const PLAN_COLOR = { free:"#6B7896", pro:"#C0392B", elite:"#C98408" };

function StatCard({ icon, value, label, sub, color, delay=0 }) {
  return (
    <motion.div {...fadeUp} transition={{ delay }} whileHover={{ y:-3 }}
      style={{ ...ss.card, padding:"20px", border:`1px solid ${color}33`,
        background:`linear-gradient(135deg,${color}08,transparent)` }}>
      <div style={{ fontSize:"24px", marginBottom:"10px" }}>{icon}</div>
      <div style={{ fontSize:"32px", fontWeight:900, color, letterSpacing:"-0.03em" }}>{value}</div>
      <div style={{ fontWeight:700, fontSize:"13px", marginTop:"6px" }}>{label}</div>
      {sub && <div style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"3px" }}>{sub}</div>}
    </motion.div>
  );
}

function AlertRow({ icon, msg, color }) {
  return (
    <div style={{ display:"flex", alignItems:"center", gap:"10px", padding:"10px 12px",
      borderRadius:"var(--r-sm)", background:`${color}08`, border:`1px solid ${color}22`,
      marginBottom:"8px", fontSize:"12px" }}>
      <span style={{ fontSize:"16px" }}>{icon}</span>
      <span style={{ color:"var(--text-2)" }}>{msg}</span>
    </div>
  );
}


const PLAN_LABELS    = { free:"Free", starter:"Starter", pro:"Pro", elite:"Elite" };
const PLAN_PRICES    = { free:0, starter:0, pro:29, elite:59 };
// El id del superadmin ya no se escribe acá: cambiar_plan/suspender_club lo
// toman de la sesión real (auth.uid()), que es lo único que no se puede
// falsear desde el navegador.

// ── Hook: carga datos reales de Supabase ──────────────────────────────────
function useAdminData() {
  const [data, setData] = useState({ clubs:[], users:[], history:[], clubRequests:[], loading:true });

  const load = async () => {
    const [{ data: clubs }, { data: users }, { data: hist }, { data: clubReqs }] = await Promise.all([
      supabase.from("clubs").select("*").order("created_at", { ascending:false }),
      supabase.from("profiles").select("id,nombre,rol,plan,club_id,created_at").order("created_at", { ascending:false }),
      supabase.from("plan_history").select("*").order("created_at", { ascending:false }).limit(50),
      supabase.from("club_requests").select("*").order("created_at", { ascending:false }).limit(50),
    ]);
    setData({ clubs: clubs||[], users: users||[], history: hist||[], clubRequests: clubReqs||[], loading:false });
  };

  useEffect(() => { load(); }, []);

  // El cambio de plan ocurre entero dentro de la base (función cambiar_plan):
  // verifica que quien llama sea superadmin de verdad, actualiza el club y a
  // sus miembros, y deja el registro en plan_history en una sola operación.
  // Hacerlo desde el navegador exigía que `plan` fuera escribible por
  // cualquiera — que es justo el agujero que cierra la migración 002.
  const cambiarPlan = async (clubId, nuevoPlan, vence, notas) => {
    const { error } = await supabase.rpc("cambiar_plan", {
      p_club_id: clubId,
      p_plan:    nuevoPlan,
      p_vence:   vence || null,
      p_notas:   notas || null,
    });
    if (error) throw error;
    await load();
  };

  const suspenderClub = async (clubId, suspender) => {
    const { error } = await supabase.rpc("suspender_club", {
      p_club_id:   clubId,
      p_suspender: suspender,
    });
    if (error) throw error;
    await load();
  };

  const marcarClubRequestsVistos = async () => {
    const idsNuevos = data.clubRequests.filter(r => !r.visto).map(r => r.id);
    if (idsNuevos.length === 0) return;
    await supabase.from("club_requests").update({ visto: true }).in("id", idsNuevos);
    setData(d => ({ ...d, clubRequests: d.clubRequests.map(r => idsNuevos.includes(r.id) ? { ...r, visto: true } : r) }));
  };

  return { ...data, cambiarPlan, suspenderClub, marcarClubRequestsVistos, reload: load };
}

// ── Vista previa de roles ─────────────────────────────────────────────────

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// Registros reales de usuarios agrupados por mes (últimos 6 meses)
function registrosPorMes(users) {
  const meses = [];
  const hoy = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: MESES[d.getMonth()], val: 0 });
  }
  users.forEach(u => {
    if (!u.created_at) return;
    const d = new Date(u.created_at);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    const m = meses.find(m => m.key === key);
    if (m) m.val++;
  });
  return meses;
}

/* ── MembresiasModule — antes vivía como if (module==="membresias"){...} con
   4 useState() llamados condicionalmente dentro del cuerpo de
   SuperAdminView, violando las Rules of Hooks (mismo patrón que
   MuroModule/CalendarioModule en EntrenadorView). Además tenía un bug
   aparte: usaba la variable `history` sin destructurarla del hook
   useAdminData(), así que en realidad apuntaba al `window.history` del
   navegador — history.filter(...)/history.map(...) no existen ahí, así
   que este módulo tiraba error apenas se abría. Ambos se corrigieron acá. */
function MembresiasModule({ clubs, users, loading, history, cambiarPlan, suspenderClub, showToast }) {
  const [editando, setEditando]   = useState(null);   // clubId que está en modo edición
  const [form, setForm]           = useState({});     // { [clubId]: { plan, vence, notas } }
  const [guardando, setGuardando] = useState(false);
  const [verHistorial, setVerHistorial] = useState(false);

  const adminDeClub = (clubId) => users.find(u => u.club_id === clubId && u.rol === "admin");
  const activosReales = clubs.filter(c => !c.suspended);

  const abrirEdicion = (club) => {
    setEditando(club.id);
    setForm(f => ({...f, [club.id]: {
      plan: club.plan || "free",
      vence: club.plan_vence || "",
      notas: club.plan_notas || "",
    }}));
  };

  const guardarCambios = async (clubId) => {
    const f = form[clubId];
    if (!f) return;
    setGuardando(true);
    // Ahora esto puede fallar de verdad: la base rechaza el cambio si quien
    // llama no es superadmin. Antes eran updates sueltos sin revisar el error,
    // así que un rechazo pasaba en silencio y el toast mentía.
    try {
      await cambiarPlan(clubId, f.plan, f.vence || null, f.notas || null);
      setEditando(null);
      showToast(`Plan actualizado a ${PLAN_LABELS[f.plan]||f.plan} ✅`, "success");
    } catch (e) {
      showToast("No se pudo cambiar el plan: " + e.message, "error");
    } finally {
      setGuardando(false);
    }
  };

  const toggleSuspender = async (club) => {
    const suspender = !club.suspended;
    try {
      await suspenderClub(club.id, suspender);
      showToast(suspender ? `${club.name} suspendido` : `${club.name} reactivado ✅`, suspender?"warning":"success");
    } catch (e) {
      showToast("No se pudo cambiar el estado del club: " + e.message, "error");
    }
  };

  const PLANES = [
    { id:"free",  label:"Free",  precio:0,  color:"#6B7896", desc:"Sin cargo" },
    { id:"pro",   label:"Pro",   precio:29, color:"#C0392B", desc:"USD/mes" },
    { id:"elite", label:"Elite", precio:59, color:"#C98408", desc:"USD/mes" },
  ];

  return (
    <div>
      <SectionTitle title="Membresías y Pagos" sub="Control de planes, estados y facturación de todos los clubes"/>

      {/* KPIs */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"14px", marginBottom:"24px" }}>
        <StatCard icon="🏢" value={activosReales.length} label="Clubes activos" color="#3B82F6"/>
        {/* Acá decía "MRR (USD/mes)" con la suma de los precios de lista. No
            hay ninguna pasarela de cobro conectada y todas las funciones están
            abiertas en todos los planes: ese dinero no entra. Un tablero que
            muestra facturación que no existe es el peor lugar para mentirse.
            Va el dato que sí es cierto. */}
        <StatCard icon="👥" value={users.length} label="Cuentas creadas" color="#1FA04A"/>
        <StatCard icon="⚡" value={clubs.filter(c=>c.plan==="elite"&&!c.suspended).length} label="Plan Elite" color="#C98408"/>
        <StatCard icon="🚫" value={clubs.filter(c=>c.suspended).length} label="Suspendidos" color="#EF4444"/>
      </div>

      {/* Tabla de clubes */}
      <motion.div {...fadeUp} style={{ ...ss.card, padding:0, overflow:"hidden", marginBottom:"20px" }}>
        <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border-soft)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ fontWeight:700, fontSize:"14px" }}>Clubes registrados</div>
          <div style={{ fontSize:"12px", color:"var(--text-3)" }}>{clubs.length} en total</div>
        </div>

        {loading && <div style={{ padding:"24px", fontSize:"12px", color:"var(--text-3)" }}>⏳ Cargando desde Supabase...</div>}

        {!loading && clubs.length === 0 && (
          <div style={{ padding:"40px", textAlign:"center", color:"var(--text-3)", fontSize:"13px" }}>
            Sin clubes aún. Aparecerán aquí cuando los admins completen el onboarding.
          </div>
        )}

        {clubs.map((club, i) => {
          const admin    = adminDeClub(club.id);
          const sp2      = SPORTS_CONFIG[club.sport] || SPORTS_CONFIG.rugby;
          const planActual = club.plan || "free";
          const color    = PLAN_COLOR[planActual] || "#6B7896";
          const enEdit   = editando === club.id;
          const fEdit    = form[club.id] || {};
          const histClub = history.filter(h=>h.club_id===club.id).slice(0,3);

          return (
            <motion.div key={club.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.04}}
              style={{ borderBottom:"1px solid var(--border-soft)", opacity:club.suspended?0.6:1 }}>

              {/* Fila principal */}
              <div style={{ padding:"16px 20px", display:"flex", alignItems:"center", gap:"14px", flexWrap:"wrap" }}>
                <div style={{ width:"40px", height:"40px", borderRadius:"8px", background:`${sp2.color}18`, border:`1px solid ${sp2.color}33`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:"18px", flexShrink:0 }}>
                  {sp2.icon}
                </div>

                <div style={{ flex:1, minWidth:"150px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px", flexWrap:"wrap" }}>
                    <span style={{ fontWeight:700, fontSize:"14px" }}>{club.name}</span>
                    {club.suspended && <Badge color="#EF4444">Suspendido</Badge>}
                  </div>
                  <div style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>
                    {sp2.name} · {club.country||"—"} {admin && `· 👤 ${admin.nombre||"Admin"}`}
                  </div>
                  {club.plan_vence && (
                    <div style={{ fontSize:"10px", color: new Date(club.plan_vence)<new Date()?"#EF4444":"#C98408", marginTop:"2px", fontWeight:600 }}>
                      {new Date(club.plan_vence)<new Date()?"⚠️ Vencido":"📅 Vence"}: {new Date(club.plan_vence).toLocaleDateString("es-CL")}
                    </div>
                  )}
                  {club.plan_notas && (
                    <div style={{ fontSize:"10px", color:"var(--text-3)", marginTop:"2px", fontStyle:"italic" }}>"{club.plan_notas}"</div>
                  )}
                </div>

                {/* Badge plan + acciones */}
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:"8px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
                    <Badge color={color}>{PLAN_LABELS[planActual]||planActual} — ${PLAN_PRICES[planActual]||0}/mes</Badge>
                    {!club.suspended && !enEdit && (
                      <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>abrirEdicion(club)}
                        style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-2)", border:"1px solid var(--border-soft)", fontSize:"11px", padding:"4px 10px" }}>
                        ✏️ Editar
                      </motion.button>
                    )}
                  </div>
                  <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={()=>toggleSuspender(club)}
                    style={{ ...ss.btn, background:club.suspended?"rgba(34,197,94,0.1)":"rgba(239,68,68,0.1)", color:club.suspended?"#22C55E":"#EF4444", border:`1px solid ${club.suspended?"#22C55E44":"#EF444444"}`, fontSize:"11px" }}>
                    {club.suspended?"✅ Reactivar":"🚫 Suspender"}
                  </motion.button>
                </div>
              </div>

              {/* Panel de edición */}
              {enEdit && (
                <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}}
                  style={{ padding:"16px 20px", background:"var(--bg-elev-1)", borderTop:"1px solid var(--border-soft)" }}>
                  <div style={{ fontWeight:600, fontSize:"13px", marginBottom:"14px" }}>✏️ Cambiar membresía — {club.name}</div>

                  {/* Selector de plan */}
                  <div style={{ marginBottom:"14px" }}>
                    <div style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"8px" }}>Plan</div>
                    <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                      {PLANES.map(p => (
                        <motion.button key={p.id} whileTap={{scale:0.95}}
                          onClick={()=>setForm(f=>({...f,[club.id]:{...f[club.id],plan:p.id}}))}
                          style={{ padding:"10px 18px", borderRadius:"var(--r-sm)", border:`2px solid ${fEdit.plan===p.id?p.color:"var(--border-soft)"}`, background:fEdit.plan===p.id?`${p.color}18`:"transparent", color:fEdit.plan===p.id?p.color:"var(--text-2)", fontSize:"13px", fontWeight:fEdit.plan===p.id?700:400, cursor:"pointer", transition:"all 0.15s" }}>
                          <div style={{ fontWeight:700 }}>{p.label}</div>
                          <div style={{ fontSize:"10px", marginTop:"2px", opacity:0.8 }}>${p.precio} {p.desc}</div>
                        </motion.button>
                      ))}
                    </div>
                  </div>

                  {/* Fecha de vencimiento */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px", marginBottom:"14px" }}>
                    <div>
                      <div style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px" }}>Fecha de vencimiento (opcional)</div>
                      <input type="date" value={fEdit.vence||""} onChange={e=>setForm(f=>({...f,[club.id]:{...f[club.id],vence:e.target.value}}))}
                        style={{ ...ss.input, width:"100%" }}/>
                      <div style={{ fontSize:"10px", color:"var(--text-4)", marginTop:"4px" }}>Deja vacío para sin vencimiento</div>
                    </div>
                    <div>
                      <div style={{ fontSize:"11px", color:"var(--text-3)", fontWeight:600, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:"6px" }}>Notas internas</div>
                      <input value={fEdit.notas||""} onChange={e=>setForm(f=>({...f,[club.id]:{...f[club.id],notas:e.target.value}}))}
                        placeholder="Ej: pago por transferencia, cortesía 30 días..."
                        style={{ ...ss.input, width:"100%" }}/>
                    </div>
                  </div>

                  <div style={{ display:"flex", gap:"8px", justifyContent:"flex-end" }}>
                    <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>setEditando(null)}
                      style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-2)", border:"1px solid var(--border-soft)" }}>
                      Cancelar
                    </motion.button>
                    <motion.button disabled={guardando} whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>guardarCambios(club.id)}
                      style={{ ...ss.btn, background:"linear-gradient(135deg,#22C55E,#16A34A)", color:"#fff", boxShadow:"0 4px 14px rgba(34,197,94,0.3)", opacity:guardando?0.6:1 }}>
                      {guardando?"Guardando...":"Guardar cambios"}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* Historial mini */}
              {histClub.length > 0 && !enEdit && (
                <div style={{ padding:"8px 20px 10px", borderTop:"1px solid var(--border-soft)" }}>
                  {histClub.map((h)=>(
                    <div key={h.id} style={{ fontSize:"10px", color:"var(--text-4)", display:"flex", gap:"8px", padding:"2px 0" }}>
                      <span>{new Date(h.created_at).toLocaleDateString("es-CL")}</span>
                      <span style={{ color:"var(--text-3)" }}>{h.plan_antes} → <span style={{ fontWeight:700, color:PLAN_COLOR[h.plan_nuevo]||"var(--text-2)" }}>{PLAN_LABELS[h.plan_nuevo]||h.plan_nuevo}</span></span>
                      {h.notas && <span style={{ fontStyle:"italic" }}>— {h.notas}</span>}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })}
      </motion.div>

      {/* Historial completo */}
      {history.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay:0.1 }} style={{ ...ss.card, padding:0, overflow:"hidden" }}>
          <div style={{ padding:"14px 20px", borderBottom:"1px solid var(--border-soft)", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer" }} onClick={()=>setVerHistorial(v=>!v)}>
            <div style={{ fontWeight:700, fontSize:"13px" }}>📋 Historial de cambios de plan</div>
            <span style={{ fontSize:"11px", color:"var(--text-3)" }}>{verHistorial?"Ocultar":"Ver todos"} ({history.length})</span>
          </div>
          {verHistorial && history.map((h)=>{
            const club = clubs.find(c=>c.id===h.club_id);
            return (
              <div key={h.id} style={{ display:"flex", gap:"12px", padding:"10px 20px", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                <span style={{ color:"var(--text-4)", minWidth:"80px" }}>{new Date(h.created_at).toLocaleDateString("es-CL")}</span>
                <span style={{ fontWeight:600, flex:1 }}>{club?.name||"Club"}</span>
                <span style={{ color:"var(--text-3)" }}>{h.plan_antes||"—"} → <span style={{ fontWeight:700, color:PLAN_COLOR[h.plan_nuevo]||"var(--text-1)" }}>{PLAN_LABELS[h.plan_nuevo]||h.plan_nuevo}</span></span>
                {h.notas && <span style={{ color:"var(--text-3)", fontStyle:"italic" }}>{h.notas}</span>}
              </div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}

// ── Vista principal ───────────────────────────────────────────────────────
// Acá vivía "Vista de Roles": un mini-app dentro de la app que dibujaba
// cada rol con datos de demo. Duplicaba el selector de rol de la barra de
// arriba, que hace lo mismo y con los datos reales del club.
//
// Y salía caro: para dibujar esas vistas importaba AdminView,
// EntrenadorView, PreparadorView, JugadorView, HomeView y PerfilView acá
// adentro, así que abrir el panel de plataforma se bajaba media aplicación.
// Justo lo que el lazy() de App.jsx estaba tratando de evitar.
export default function SuperAdminView({ module, showToast }) {
  const { clubs, users, loading, history, clubRequests, cambiarPlan, suspenderClub, marcarClubRequestsVistos } = useAdminData();

  useEffect(() => {
    if (module === "clubes") marcarClubRequestsVistos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [module]);

  const totalClubes  = clubs.length;
  const commData = registrosPorMes(users);
  const totalUsuarios = users.length;
  const porPlan = {
    free:  users.filter(u=>!u.plan||u.plan==="free").length,
    pro:   users.filter(u=>u.plan==="pro").length,
    elite: users.filter(u=>u.plan==="elite").length,
  };

  // Últimos 7 días de registros. El corte se calcula una vez al montar y no
  // en cada dibujado: si no, el render depende del reloj.
  const [ahora] = useState(() => Date.now());
  const hace7dias = new Date(ahora - 7*24*3600*1000).toISOString();
  const nuevosEstaSemana = users.filter(u => u.created_at > hace7dias).length;
  const clubesNuevos = clubs.filter(c => c.created_at > hace7dias).length;

  // Alertas: clubes sin jugadores (solo 1 usuario = el admin)
  const clubesSolos = clubs.filter(c => users.filter(u=>u.club_id===c.id).length <= 1);

  const pieData = [
    { name:"Free",  value: porPlan.free  || 1, color:"#6B7896" },
    { name:"Pro",   value: porPlan.pro   || 0, color:"#C0392B" },
    { name:"Elite", value: porPlan.elite || 0, color:"#C98408" },
  ];

  if (module==="dashboard") return (
    <div>
      <SectionTitle title="Dashboard Global — SportOS" sub="Operaciones en tiempo real · América Latina"/>

      {loading && (
        <div style={{ fontSize:"12px", color:"var(--text-3)", marginBottom:"16px" }}>
          ⏳ Cargando datos de Supabase...
        </div>
      )}

      {/* Stats principales */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:"14px", marginBottom:"20px" }}>
        <StatCard icon="🏢" value={totalClubes} label="Clubes activos" sub={`+${clubesNuevos} esta semana`} color="#3B82F6" delay={0}/>
        <StatCard icon="👥" value={totalUsuarios} label="Usuarios totales" sub={`+${nuevosEstaSemana} esta semana`} color="#1FA04A" delay={0.05}/>
        {/* Ídem: no hay cobro. Se muestra el reparto de planes, que es real. */}
        <StatCard icon="⚡" value={porPlan.pro + porPlan.elite} label="En Pro o Elite" sub={`${porPlan.pro} Pro · ${porPlan.elite} Elite`} color="#C98408" delay={0.1}/>
        <StatCard icon="🆓" value={porPlan.free} label="Usuarios Free" sub="Sin plan de pago aún" color="#6B7896" delay={0.15}/>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:"16px", marginBottom:"20px" }}>
        {/* Registros reales por mes (registrosPorMes sobre profiles), no un mock */}
        <motion.div {...fadeUp} style={{ ...ss.card }}>
          <div style={{ fontWeight:600, marginBottom:"16px", fontSize:"14px" }}>📈 Registros — últimos 6 meses</div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={commData}>
              <defs>
                <linearGradient id="comm-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#C0392B" stopOpacity={0.5}/>
                  <stop offset="100%" stopColor="#C0392B" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
              <XAxis dataKey="month" stroke="#6B7896" fontSize={11}/>
              <YAxis stroke="#6B7896" fontSize={11}/>
              <Tooltip contentStyle={{background:"var(--bg-glass-strong)",backdropFilter:"blur(20px)",border:"1px solid var(--border-mid)",borderRadius:"var(--r-md)",color:"var(--text-1)",fontSize:12}}/>
              <Area type="monotone" dataKey="val" stroke="#C0392B" fill="url(#comm-grad)" strokeWidth={2.5}/>
            </AreaChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Distribución de planes */}
        <motion.div {...fadeUp} transition={{ delay:0.1 }} style={{ ...ss.card }}>
          <div style={{ fontWeight:600, marginBottom:"12px", fontSize:"14px" }}>🎯 Distribución de planes</div>
          <PieChart width={200} height={120}>
            <Pie data={pieData} cx={100} cy={60} innerRadius={35} outerRadius={55} dataKey="value">
              {pieData.map((e,i) => <Cell key={i} fill={e.color}/>)}
            </Pie>
            <Tooltip contentStyle={{background:"var(--bg-glass-strong)",border:"1px solid var(--border-mid)",borderRadius:"var(--r-sm)",fontSize:11}}/>
          </PieChart>
          <div style={{ display:"flex", flexDirection:"column", gap:"6px", marginTop:"8px" }}>
            {pieData.map(p => (
              <div key={p.name} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", fontSize:"12px" }}>
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <span style={{ width:"8px", height:"8px", borderRadius:"50%", background:p.color, display:"inline-block" }}/>
                  <span style={{ color:"var(--text-2)" }}>{p.name}</span>
                </div>
                <span style={{ fontWeight:700, color:p.color }}>{p.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Alertas */}
      <motion.div {...fadeUp} transition={{ delay:0.15 }} style={{ ...ss.card, marginBottom:"20px" }}>
        <div style={{ fontWeight:600, marginBottom:"14px", fontSize:"14px" }}>🚨 Alertas del sistema</div>
        {clubesSolos.length > 0
          ? clubesSolos.slice(0,5).map(c => (
              <AlertRow key={c.id} icon="⚠️" msg={`Club "${c.name}" tiene solo 1 usuario — posible abandono`} color="#C98408"/>
            ))
          : <AlertRow icon="✅" msg="Sin alertas activas — todos los clubes tienen actividad" color="#1FA04A"/>
        }
        {porPlan.free > porPlan.pro * 3 && (
          <AlertRow icon="📣" msg={`${porPlan.free} usuarios en plan Free sin convertir a Pro`} color="#C0392B"/>
        )}
      </motion.div>

      {/* Últimos usuarios registrados */}
      <motion.div {...fadeUp} transition={{ delay:0.2 }} style={{ ...ss.card }}>
        <div style={{ fontWeight:600, marginBottom:"16px", fontSize:"14px" }}>👥 Últimos usuarios registrados</div>
        {users.length === 0 ? (
          <div style={{ fontSize:"12px", color:"var(--text-3)" }}>Sin usuarios registrados aún.</div>
        ) : (
          <table style={{ width:"100%", fontSize:"12px", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Nombre","Rol","Plan","Fecha"].map(h => (
                <th key={h} style={{ textAlign:"left", color:"var(--text-3)", padding:"8px", borderBottom:"1px solid var(--border-soft)", textTransform:"uppercase", letterSpacing:"0.05em", fontSize:"10px" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {users.slice(0,8).map((u,i) => (
                <motion.tr key={u.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}
                  style={{ borderBottom:"1px solid var(--border-soft)" }}>
                  <td style={{ padding:"10px 8px", fontWeight:600 }}>{u.nombre || "—"}</td>
                  <td style={{ padding:"10px 8px", color:"var(--text-2)" }}>{u.rol || "jugador"}</td>
                  <td style={{ padding:"10px 8px" }}>
                    <Badge color={PLAN_COLOR[u.plan||"free"]}>{u.plan||"free"}</Badge>
                  </td>
                  <td style={{ padding:"10px 8px", color:"var(--text-3)" }}>
                    {u.created_at ? new Date(u.created_at).toLocaleDateString("es-CL") : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </motion.div>
    </div>
  );

  if (module==="clubes") return (
    <div>
      <SectionTitle title="Gestión de Clubes" sub={`${clubs.length} clubes registrados`}/>

      {/* Clubes reales de Supabase */}
      {clubs.length > 0 && (
        <motion.div {...fadeUp} style={{ ...ss.card, padding:0, overflow:"hidden", marginBottom:"20px" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)", fontWeight:600, fontSize:"13px" }}>
            Clubes en Supabase
          </div>
          <table style={{ width:"100%", fontSize:"12px", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Club","Deporte","País","Usuarios","Creado"].map(h => (
                <th key={h} style={{ textAlign:"left", color:"var(--text-3)", padding:"12px", borderBottom:"1px solid var(--border-soft)", textTransform:"uppercase", letterSpacing:"0.05em", fontSize:"10px" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {clubs.map((c,i) => {
                const sp2 = SPORTS_CONFIG[c.sport] || SPORTS_CONFIG.rugby;
                const miembros = users.filter(u => u.club_id === c.id).length;
                return (
                  <motion.tr key={c.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
                    style={{ borderBottom:"1px solid var(--border-soft)" }}>
                    <td style={{ padding:"12px", fontWeight:600 }}>{c.name}</td>
                    <td style={{ padding:"12px" }}>{sp2.icon} {sp2.name}</td>
                    <td style={{ padding:"12px" }}>{c.country || "—"}</td>
                    <td style={{ padding:"12px" }}>
                      <Badge color={miembros > 1 ? "#1FA04A" : "#C98408"}>{miembros} usuarios</Badge>
                    </td>
                    <td style={{ padding:"12px", color:"var(--text-3)" }}>
                      {c.created_at ? new Date(c.created_at).toLocaleDateString("es-CL") : "—"}
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}

      {/* Auditoría: solicitudes de creación de club (self-serve, auto-aprobadas) */}
      {clubRequests.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay:0.05 }} style={{ ...ss.card, padding:0, overflow:"hidden", marginBottom:"20px" }}>
          <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)", fontWeight:600, fontSize:"13px" }}>
            📋 Solicitudes de club recientes (auditoría)
          </div>
          <table style={{ width:"100%", fontSize:"12px", borderCollapse:"collapse" }}>
            <thead><tr>
              {["Club","Deporte","País","Solicitante","Email","Fecha"].map(h => (
                <th key={h} style={{ textAlign:"left", color:"var(--text-3)", padding:"12px", borderBottom:"1px solid var(--border-soft)", textTransform:"uppercase", letterSpacing:"0.05em", fontSize:"10px" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {clubRequests.map((r,i) => (
                <motion.tr key={r.id} initial={{opacity:0,x:-16}} animate={{opacity:1,x:0}} transition={{delay:i*0.03}}
                  style={{ borderBottom:"1px solid var(--border-soft)" }}>
                  <td style={{ padding:"12px", fontWeight:600 }}>
                    {r.nombre_club}
                    {!r.visto && <span style={{marginLeft:"8px",fontSize:"9px",padding:"2px 7px",borderRadius:"99px",background:"#3B82F622",color:"#3B82F6",border:"1px solid #3B82F644",fontWeight:800}}>NUEVO</span>}
                  </td>
                  <td style={{ padding:"12px" }}>{(SPORTS_CONFIG[r.deporte]||{}).icon} {r.deporte || "—"}</td>
                  <td style={{ padding:"12px" }}>{r.pais || "—"}</td>
                  <td style={{ padding:"12px" }}>{r.nombre_solicitante || "—"}</td>
                  <td style={{ padding:"12px", color:"var(--text-3)" }}>{r.email_solicitante || "—"}</td>
                  <td style={{ padding:"12px", color:"var(--text-3)" }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString("es-CL") : "—"}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}

      {clubs.length === 0 && clubRequests.length === 0 && !loading && (
        <div style={{ padding:"40px", textAlign:"center", color:"var(--text-3)", fontSize:"13px" }}>
          Sin clubes aún. Aparecerán aquí cuando los admins completen el onboarding.
        </div>
      )}
    </div>
  );


  if (module==="membresias") return <MembresiasModule clubs={clubs} users={users} loading={loading} history={history}
    cambiarPlan={cambiarPlan} suspenderClub={suspenderClub} showToast={showToast}/>;


  return null;
}
