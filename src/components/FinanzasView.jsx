import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import { m as motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import EmptyState from "./EmptyState";
import { periodoDe, nombrePeriodo, correrPeriodo, periodoDePago } from "../lib/periodo";
import { estadoPorJugador } from "../lib/usePayments";

// ── Categorías predefinidas ───────────────────────────────────────────────

const CAT_INGRESOS = ["Cuotas", "Sponsor", "Venta de entradas", "Evento", "Aporte externo", "Otro"];
const CAT_EGRESOS  = ["Cancha / Arriendo", "Implementos", "Viajes", "Árbitros", "Premiaciones", "Servicios", "Otro"];
const CAT_ADMIN    = ["Luz / Agua", "Internet", "Contabilidad", "Seguro", "Material oficina", "Otro"];

const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

// ── Datos mock iniciales ──────────────────────────────────────────────────

const MOCK_MOVIMIENTOS = [
  { id:1,  tipo:"ingreso", cat:"Cuotas",           desc:"Cuotas marzo plantel",     monto:450000, fecha:"2026-03-05" },
  { id:2,  tipo:"ingreso", cat:"Sponsor",           desc:"Auspicio Empresa XYZ",     monto:300000, fecha:"2026-03-10" },
  { id:3,  tipo:"egreso",  cat:"Cancha / Arriendo", desc:"Arriendo cancha marzo",    monto:120000, fecha:"2026-03-12" },
  { id:4,  tipo:"egreso",  cat:"Árbitros",          desc:"Árbitros partido local",   monto:45000,  fecha:"2026-03-15" },
  { id:5,  tipo:"ingreso", cat:"Venta de entradas", desc:"Partido vs Universitario", monto:80000,  fecha:"2026-03-20" },
  { id:6,  tipo:"egreso",  cat:"Implementos",       desc:"Pelotas y conos",          monto:65000,  fecha:"2026-03-22" },
  { id:7,  tipo:"ingreso", cat:"Cuotas",            desc:"Cuotas abril plantel",     monto:460000, fecha:"2026-04-05" },
  { id:8,  tipo:"egreso",  cat:"Viajes",            desc:"Bus partido visitante",    monto:95000,  fecha:"2026-04-08" },
  { id:9,  tipo:"egreso",  cat:"Cancha / Arriendo", desc:"Arriendo cancha abril",    monto:120000, fecha:"2026-04-12" },
  { id:10, tipo:"ingreso", cat:"Evento",            desc:"Cena anual del club",      monto:220000, fecha:"2026-04-18" },
];

const MOCK_SUELDOS = [
  { id:1, nombre:"Carlos Vega",   cargo:"Entrenador Principal", monto:800000, activo:true },
  { id:2, nombre:"Diego Fuentes", cargo:"Preparador Físico",    monto:600000, activo:true },
  { id:3, nombre:"Ana López",     cargo:"Kinesiólogo",          monto:500000, activo:true },
];

const MOCK_GASTOS_ADMIN = [
  { id:1, cat:"Luz / Agua",    desc:"Cuenta mensual sede",    monto:45000,  activo:true },
  { id:2, cat:"Internet",      desc:"Fibra óptica sede",      monto:28000,  activo:true },
  { id:3, cat:"Contabilidad",  desc:"Honorario contador",     monto:120000, activo:true },
];

// ── Helpers ───────────────────────────────────────────────────────────────

function fmt(n, sym="$") { return `${sym}${Number(n||0).toLocaleString("es-CL")}`; }

function StatBox({ icon, label, value, sub, color }) {
  return (
    <motion.div {...fadeUp} whileHover={{y:-3}}
      style={{ ...ss.card, padding:"20px", border:`1px solid ${color}33`,
        background:`linear-gradient(135deg,${color}08,transparent)` }}>
      <div style={{ fontSize:"22px", marginBottom:"8px" }}>{icon}</div>
      <div style={{ fontSize:"28px", fontWeight:900, color, letterSpacing:"-0.02em" }}>{value}</div>
      <div style={{ fontWeight:600, fontSize:"12px", marginTop:"6px" }}>{label}</div>
      {sub && <div style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"3px" }}>{sub}</div>}
    </motion.div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
      onClick={onClose}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:200,
        display:"flex", alignItems:"center", justifyContent:"center", padding:"20px" }}>
      <motion.div initial={{scale:0.93,opacity:0}} animate={{scale:1,opacity:1}} exit={{scale:0.93,opacity:0}}
        onClick={e=>e.stopPropagation()}
        style={{ ...ss.card, width:"100%", maxWidth:"460px", padding:"28px", maxHeight:"90vh", overflowY:"auto" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"20px" }}>
          <div style={{ fontWeight:700, fontSize:"16px" }}>{title}</div>
          <button onClick={onClose} style={{ background:"none", border:"none", color:"var(--text-3)",
            fontSize:"20px", cursor:"pointer", lineHeight:1 }}>×</button>
        </div>
        {children}
      </motion.div>
    </motion.div>
  );
}

// ── Componente principal ──────────────────────────────────────────────────

export default function FinanzasView({ countryData, payments=[], sportColor, showToast, clubId=null,
  confirmPayment=null, rejectPayment=null, registrarPagoManual=null, borrarPago=null, plantel=[] }) {
  const sym = countryData?.symbol || "$";
  // Transferencias declaradas por el jugador que nadie ha revisado todavía.
  // Mientras estén acá, el jugador ve "esperando confirmación" y no puede
  // hacer nada más: es lo único de esta pantalla que bloquea a otra persona.
  const porConfirmar = payments.filter(p => p.estado === "declarado");
  const [tab,          setTab]          = useState("resumen");
  const [mes,          setMes]          = useState(periodoDe());
  const [cuotaMensual, setCuotaMensual] = useState(0);
  const [enCurso,      setEnCurso]      = useState(false);

  /**
   * Ejecuta una acción sobre la plata y dice la verdad sobre cómo salió.
   *
   * Antes cada botón mostraba su mensaje de éxito apenas terminaba el await,
   * pasara lo que pasara: si la base rechazaba la escritura, el admin leía
   * "cuota confirmada" y la fila seguía ahí sin explicación. `enCurso` además
   * evita el doble click, que sobre "Pagó en efectivo" cobraba dos veces.
   */
  const correr = async (accion, exito, tono = "success") => {
    if (enCurso) return;
    setEnCurso(true);
    try {
      await accion();
      showToast?.(exito, tono);
    } catch (e) {
      showToast?.(`No se pudo guardar: ${e?.message || "error de conexión"}`, "error");
    } finally {
      setEnCurso(false);
    }
  };

  // El monto lo fija el admin en Mi Club; acá solo se lee para saber cuánto
  // falta y para registrar el pago de quien pagó en efectivo.
  useEffect(() => {
    if (!clubId) return;
    supabase.from("club_payment_info").select("cuota_mensual").eq("club_id", clubId).single()
      .then(({ data }) => setCuotaMensual(Number(data?.cuota_mensual) || 0));
  }, [clubId]);

  const pagosDelMes    = payments.filter(p => periodoDePago(p) === mes);
  const estadoMes      = estadoPorJugador(payments, mes);
  const alDia          = plantel.filter(j => estadoMes.get(j.id) === "pagado");
  const declararonMes  = plantel.filter(j => estadoMes.get(j.id) === "declarado");
  const deben          = plantel.filter(j => !estadoMes.get(j.id));
  const recaudadoMes   = pagosDelMes.filter(p => p.estado === "pagado").reduce((s,p)=>s+p.amount,0);
  // Los que deben primero: es la lista sobre la que hay que hacer algo.
  const ORDEN = { debe:0, declarado:1, pagado:2 };
  const plantelOrdenado = [...plantel].sort((a,b) =>
    (ORDEN[estadoMes.get(a.id) || "debe"] - ORDEN[estadoMes.get(b.id) || "debe"])
    || String(a.name||"").localeCompare(String(b.name||"")));
  // Sin club_id (demo/preview) se usa vitrina; con club_id, siempre lo real de Supabase (aunque esté vacío).
  const [movimientos,  setMovimientos]  = useState(clubId ? [] : MOCK_MOVIMIENTOS);
  const [sueldos,      setSueldos]      = useState(clubId ? [] : MOCK_SUELDOS);
  const [gastosAdmin,  setGastosAdmin]  = useState(clubId ? [] : MOCK_GASTOS_ADMIN);
  const [loading,      setLoading]      = useState(false);

  // Carga datos reales si hay club_id
  useEffect(() => {
    if (!clubId) return;
    setLoading(true);
    Promise.all([
      supabase.from("finanzas_movimientos").select("*").eq("club_id", clubId).order("fecha", { ascending: false }),
      supabase.from("finanzas_sueldos").select("*").eq("club_id", clubId).order("created_at"),
      supabase.from("finanzas_gastos_admin").select("*").eq("club_id", clubId).order("created_at"),
    ]).then(([movRes, suelRes, admRes]) => {
      setMovimientos((movRes.data || []).map(r => ({ ...r, desc: r.descripcion })));
      setSueldos(suelRes.data || []);
      setGastosAdmin((admRes.data || []).map(r => ({ ...r, desc: r.descripcion })));
      setLoading(false);
    });
  }, [clubId]);

  // Modales
  const [modalMov,    setModalMov]    = useState(false);
  const [modalSueldo, setModalSueldo] = useState(false);
  const [modalAdmin,  setModalAdmin]  = useState(false);
  const [editSueldo,  setEditSueldo]  = useState(null);
  const [editAdmin,   setEditAdmin]   = useState(null);

  // Formularios
  const emptyMov    = { tipo:"ingreso", cat:"Cuotas", desc:"", monto:"", fecha: new Date().toISOString().split("T")[0] };
  const emptySueldo = { nombre:"", cargo:"", monto:"" };
  const emptyAdmin  = { cat:"Luz / Agua", desc:"", monto:"" };
  const [formMov,    setFormMov]    = useState(emptyMov);
  const [formSueldo, setFormSueldo] = useState(emptySueldo);
  const [formAdmin,  setFormAdmin]  = useState(emptyAdmin);

  // ── Cálculos ──
  const totalIngresosMovs = movimientos.filter(m=>m.tipo==="ingreso").reduce((s,m)=>s+m.monto,0);
  const totalEgresosMovs  = movimientos.filter(m=>m.tipo==="egreso").reduce((s,m)=>s+m.monto,0);
  // Solo las cuotas confirmadas son ingreso. Sumar las declaradas —o peor,
  // las rechazadas— daba un saldo con plata que todavía no está en la cuenta.
  const cuotasPagadas     = payments.filter(p => p.estado === "pagado");
  const totalCuotas       = cuotasPagadas.reduce((s,p)=>s+p.amount,0);
  const totalIngresosReal = totalIngresosMovs + totalCuotas;
  const totalSueldos      = sueldos.filter(s=>s.activo).reduce((s,x)=>s+x.monto,0);
  const totalGastosAdmin  = gastosAdmin.filter(g=>g.activo).reduce((s,g)=>s+g.monto,0);
  const totalEgresosReal  = totalEgresosMovs + totalSueldos + totalGastosAdmin;
  const saldo             = totalIngresosReal - totalEgresosReal;

  // ── Datos para gráfico flujo de caja ──
  const flujoPorMes = MESES.slice(0,6).map((mes, i) => {
    const ingresos = movimientos.filter(m => m.tipo==="ingreso" && new Date(m.fecha).getMonth()===i+2).reduce((s,m)=>s+m.monto,0);
    const egresos  = movimientos.filter(m => m.tipo==="egreso"  && new Date(m.fecha).getMonth()===i+2).reduce((s,m)=>s+m.monto,0)
                   + (i===0||i===1 ? totalSueldos+totalGastosAdmin : 0);
    return { mes, ingresos: ingresos||0, egresos: egresos||(totalSueldos+totalGastosAdmin), saldo: ingresos - egresos };
  });

  // ── Agregar movimiento ──
  const agregarMovimiento = async () => {
    if (!formMov.desc || !formMov.monto) { showToast("Completa todos los campos","warning"); return; }
    const monto = Number(formMov.monto);
    if (clubId) {
      const { data, error } = await supabase.from("finanzas_movimientos")
        .insert({ club_id: clubId, tipo: formMov.tipo, cat: formMov.cat, descripcion: formMov.desc, monto, fecha: formMov.fecha })
        .select().single();
      if (error) { showToast("Error al guardar","error"); return; }
      setMovimientos(prev => [{ ...data, desc: data.descripcion }, ...prev]);
    } else {
      setMovimientos(prev => [{ ...formMov, id: Date.now(), monto }, ...prev]);
    }
    setFormMov(emptyMov);
    setModalMov(false);
    showToast(`${formMov.tipo==="ingreso"?"Ingreso":"Egreso"} registrado ✅`);
  };

  // ── Guardar sueldo ──
  const guardarSueldo = async () => {
    if (!formSueldo.nombre || !formSueldo.monto) { showToast("Completa todos los campos","warning"); return; }
    const monto = Number(formSueldo.monto);
    if (clubId) {
      if (editSueldo) {
        const { data, error } = await supabase.from("finanzas_sueldos")
          .update({ nombre: formSueldo.nombre, cargo: formSueldo.cargo, monto })
          .eq("id", editSueldo).select().single();
        if (error) { showToast("Error al guardar","error"); return; }
        setSueldos(prev => prev.map(s => s.id===editSueldo ? data : s));
        showToast("Sueldo actualizado ✅");
      } else {
        const { data, error } = await supabase.from("finanzas_sueldos")
          .insert({ club_id: clubId, nombre: formSueldo.nombre, cargo: formSueldo.cargo, monto, activo: true })
          .select().single();
        if (error) { showToast("Error al guardar","error"); return; }
        setSueldos(prev => [...prev, data]);
        showToast("Sueldo agregado ✅");
      }
    } else {
      if (editSueldo) {
        setSueldos(prev => prev.map(s => s.id===editSueldo ? { ...s, ...formSueldo, monto } : s));
        showToast("Sueldo actualizado ✅");
      } else {
        setSueldos(prev => [...prev, { ...formSueldo, id:Date.now(), monto, activo:true }]);
        showToast("Sueldo agregado ✅");
      }
    }
    setEditSueldo(null);
    setFormSueldo(emptySueldo);
    setModalSueldo(false);
  };

  // ── Guardar gasto admin ──
  const guardarAdmin = async () => {
    if (!formAdmin.desc || !formAdmin.monto) { showToast("Completa todos los campos","warning"); return; }
    const monto = Number(formAdmin.monto);
    if (clubId) {
      if (editAdmin) {
        const { data, error } = await supabase.from("finanzas_gastos_admin")
          .update({ cat: formAdmin.cat, descripcion: formAdmin.desc, monto })
          .eq("id", editAdmin).select().single();
        if (error) { showToast("Error al guardar","error"); return; }
        setGastosAdmin(prev => prev.map(g => g.id===editAdmin ? { ...data, desc: data.descripcion } : g));
        showToast("Gasto actualizado ✅");
      } else {
        const { data, error } = await supabase.from("finanzas_gastos_admin")
          .insert({ club_id: clubId, cat: formAdmin.cat, descripcion: formAdmin.desc, monto, activo: true })
          .select().single();
        if (error) { showToast("Error al guardar","error"); return; }
        setGastosAdmin(prev => [...prev, { ...data, desc: data.descripcion }]);
        showToast("Gasto agregado ✅");
      }
    } else {
      if (editAdmin) {
        setGastosAdmin(prev => prev.map(g => g.id===editAdmin ? { ...g, ...formAdmin, monto } : g));
        showToast("Gasto actualizado ✅");
      } else {
        setGastosAdmin(prev => [...prev, { ...formAdmin, id:Date.now(), monto, activo:true }]);
        showToast("Gasto agregado ✅");
      }
    }
    setEditAdmin(null);
    setFormAdmin(emptyAdmin);
    setModalAdmin(false);
  };

  const TABS = [
    { id:"resumen",   label:"Resumen",    icon:"📊" },
    { id:"cuotas",    label:"Cuotas",     icon:"🧾", badge: porConfirmar.length },
    { id:"ingresos",  label:"Ingresos",   icon:"💰" },
    { id:"egresos",   label:"Egresos",    icon:"📤" },
    { id:"sueldos",   label:"Sueldos",    icon:"👤" },
    { id:"admin",     label:"Gastos Adm.", icon:"🏢" },
    { id:"flujo",     label:"Flujo Caja", icon:"📈" },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:"20px", flexWrap:"wrap", gap:"12px" }}>
        <div>
          <div style={{ fontWeight:900, fontSize:"20px", letterSpacing:"-0.02em" }}>💼 Finanzas del Club</div>
          <div style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"3px" }}>{countryData?.name} · {countryData?.tax}</div>
        </div>
        <div style={{ display:"flex", gap:"8px" }}>
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={()=>{ setFormMov({...emptyMov,tipo:"ingreso"}); setModalMov(true); }}
            style={{ ...ss.btn, background:"rgba(31,160,74,0.15)", color:"#1FA04A",
              border:"1px solid rgba(31,160,74,0.3)", fontSize:"12px", fontWeight:700 }}>
            + Ingreso
          </motion.button>
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={()=>{ setFormMov({...emptyMov,tipo:"egreso"}); setModalMov(true); }}
            style={{ ...ss.btn, background:"rgba(192,57,43,0.12)", color:"#C0392B",
              border:"1px solid rgba(192,57,43,0.3)", fontSize:"12px", fontWeight:700 }}>
            + Egreso
          </motion.button>
          <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
            onClick={()=>{
              const sym2 = countryData?.symbol || "$";
              const rows = [
                ["Tipo","Categoría","Descripción","Monto","Fecha"],
                ...payments.map(p=>["ingreso","Cuotas",`Cuota ${p.playerName||p.jugador||""}`,p.amount||p.monto||0,p.date||p.fecha||""]),
                ...movimientos.map(m=>[m.tipo,m.cat,m.desc||m.descripcion||"",m.monto,m.fecha]),
                [],
                ["SUELDOS","","","",""],
                ["Nombre","Cargo","Monto mensual","Activo",""],
                ...sueldos.map(s=>[s.nombre,s.cargo,s.monto,s.activo?"Sí":"No",""]),
                [],
                ["GASTOS ADMIN","","","",""],
                ["Categoría","Descripción","Monto","Activo",""],
                ...gastosAdmin.map(g=>[g.cat,g.desc||g.descripcion||"",g.monto,g.activo?"Sí":"No",""]),
              ];
              const csv = rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
              const blob = new Blob(["﻿"+csv], {type:"text/csv;charset=utf-8;"});
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = `finanzas_${new Date().toISOString().slice(0,10)}.csv`;
              a.click(); URL.revokeObjectURL(url);
              showToast("CSV descargado ✅","success");
            }}
            style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-2)",
              border:"1px solid var(--border-soft)", fontSize:"12px" }}>
            📊 CSV
          </motion.button>
        </div>
      </div>

      {/* Stats resumen */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))", gap:"12px", marginBottom:"20px" }}>
        <StatBox icon="💰" label="Total ingresos" value={fmt(totalIngresosReal,sym)} sub="Este período" color="#1FA04A"/>
        <StatBox icon="📤" label="Total egresos"  value={fmt(totalEgresosReal,sym)} sub="Incluye sueldos y admin" color="#C0392B"/>
        <StatBox icon="👤" label="Sueldos"        value={fmt(totalSueldos,sym)}     sub={`${sueldos.filter(s=>s.activo).length} personas`} color="#C98408"/>
        <StatBox icon="💼" label="Saldo disponible" value={fmt(saldo,sym)}
          sub={saldo>=0?"Positivo ✅":"Déficit ⚠️"} color={saldo>=0?"#1FA04A":"#C0392B"}/>
      </div>

      {/* Aviso: hay jugadores esperando que les confirmen la transferencia */}
      {porConfirmar.length > 0 && tab !== "cuotas" && (
        <motion.button {...fadeUp} whileHover={{scale:1.005}} whileTap={{scale:0.995}}
          onClick={()=>setTab("cuotas")}
          style={{ width:"100%", textAlign:"left", cursor:"pointer", marginBottom:"14px",
            padding:"14px 16px", borderRadius:"var(--r-md)",
            border:"1px solid rgba(245,158,11,0.4)",
            background:"linear-gradient(135deg,rgba(245,158,11,0.12),transparent)",
            display:"flex", alignItems:"center", gap:"12px" }}>
          <span style={{ fontSize:"22px" }}>⏳</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:700, fontSize:"13px", color:"#F59E0B" }}>
              {porConfirmar.length === 1
                ? "1 jugador está esperando que le confirmes la cuota"
                : `${porConfirmar.length} jugadores están esperando que les confirmes la cuota`}
            </div>
            <div style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>
              Ya transfirieron. Hasta que confirmes, les sigue apareciendo la cuota como pendiente.
            </div>
          </div>
          <span style={{ fontSize:"12px", color:"#F59E0B", fontWeight:700, flexShrink:0 }}>Revisar →</span>
        </motion.button>
      )}

      {/* Tabs */}
      <div style={{ display:"flex", gap:"4px", background:"var(--bg-elev-2)", borderRadius:"var(--r-md)",
        padding:"4px", marginBottom:"20px", overflowX:"auto" }}>
        {TABS.map(t => (
          <motion.button key={t.id} whileTap={{scale:0.97}} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"8px 10px", borderRadius:"var(--r-sm)", border:"none",
              cursor:"pointer", fontSize:"11px", fontWeight:tab===t.id?700:500, whiteSpace:"nowrap",
              background:tab===t.id?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"transparent",
              color:tab===t.id?sportColor:"var(--text-2)", transition:"all 0.2s" }}>
            {t.icon} {t.label}
            {t.badge > 0 && (
              <span style={{ marginLeft:"5px", fontSize:"10px", padding:"1px 6px", borderRadius:"99px",
                background:"#F59E0B", color:"#1a1a1a", fontWeight:800 }}>{t.badge}</span>
            )}
          </motion.button>
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* ── RESUMEN ── */}
        {tab==="resumen" && (
          <motion.div key="resumen" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"16px" }}>
              {/* Ingresos por categoría */}
              <div style={{ ...ss.card, padding:"20px" }}>
                <div style={{ fontWeight:700, fontSize:"13px", marginBottom:"14px", color:"#1FA04A" }}>💰 Ingresos por categoría</div>
                {CAT_INGRESOS.map(cat => {
                  const total = movimientos.filter(m=>m.tipo==="ingreso"&&m.cat===cat).reduce((s,m)=>s+m.monto,0)
                    + (cat==="Cuotas" ? totalCuotas : 0);
                  if (!total) return null;
                  return (
                    <div key={cat} style={{ display:"flex", justifyContent:"space-between",
                      padding:"8px 0", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                      <span style={{ color:"var(--text-2)" }}>{cat}</span>
                      <span style={{ fontWeight:700, color:"#1FA04A" }}>{fmt(total,sym)}</span>
                    </div>
                  );
                })}
              </div>
              {/* Egresos por categoría */}
              <div style={{ ...ss.card, padding:"20px" }}>
                <div style={{ fontWeight:700, fontSize:"13px", marginBottom:"14px", color:"#C0392B" }}>📤 Egresos por categoría</div>
                {[...CAT_EGRESOS, "Sueldos", "Gastos Admin"].map(cat => {
                  let total = 0;
                  if (cat==="Sueldos") total = totalSueldos;
                  else if (cat==="Gastos Admin") total = totalGastosAdmin;
                  else total = movimientos.filter(m=>m.tipo==="egreso"&&m.cat===cat).reduce((s,m)=>s+m.monto,0);
                  if (!total) return null;
                  return (
                    <div key={cat} style={{ display:"flex", justifyContent:"space-between",
                      padding:"8px 0", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                      <span style={{ color:"var(--text-2)" }}>{cat}</span>
                      <span style={{ fontWeight:700, color:"#C0392B" }}>{fmt(total,sym)}</span>
                    </div>
                  );
                })}
                <div style={{ display:"flex", justifyContent:"space-between", padding:"10px 0",
                  fontSize:"13px", fontWeight:700, marginTop:"4px" }}>
                  <span>Total egresos</span>
                  <span style={{ color:"#C0392B" }}>{fmt(totalEgresosReal,sym)}</span>
                </div>
              </div>
            </div>
            {/* Saldo */}
            <motion.div {...fadeUp} transition={{delay:0.1}}
              style={{ ...ss.card, marginTop:"14px", padding:"20px", textAlign:"center",
                border:`1px solid ${saldo>=0?"rgba(31,160,74,0.3)":"rgba(192,57,43,0.3)"}`,
                background:`linear-gradient(135deg,${saldo>=0?"rgba(31,160,74,0.06)":"rgba(192,57,43,0.06)"},transparent)` }}>
              <div style={{ fontSize:"12px", color:"var(--text-3)", marginBottom:"6px", textTransform:"uppercase", letterSpacing:"0.08em" }}>Saldo del período</div>
              <div style={{ fontSize:"40px", fontWeight:900, letterSpacing:"-0.03em",
                color:saldo>=0?"#1FA04A":"#C0392B" }}>
                {saldo>=0?"+":""}{fmt(saldo,sym)}
              </div>
              <div style={{ fontSize:"12px", color:"var(--text-3)", marginTop:"6px" }}>
                {saldo>=0?"El club está en positivo ✅":"El club está en déficit — revisar egresos ⚠️"}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* ── CUOTAS ── */}
        {tab==="cuotas" && (
          <motion.div key="cuotas" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>

            {/* Por confirmar */}
            <div style={{ ...ss.card, padding:0, overflow:"hidden", marginBottom:"16px",
              border:porConfirmar.length>0?"1px solid rgba(245,158,11,0.35)":"1px solid var(--border-soft)" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:"13px" }}>⏳ Por confirmar</span>
                <span style={{ fontSize:"11px", color:"var(--text-3)" }}>
                  {porConfirmar.length} {porConfirmar.length===1?"transferencia":"transferencias"}
                </span>
              </div>

              {porConfirmar.length === 0 ? (
                <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"12px", color:"var(--text-3)" }}>
                  Nada pendiente. Cuando un jugador transfiera y lo declare en la app, aparece acá.
                </div>
              ) : porConfirmar.map(p => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  gap:"12px", padding:"12px 16px", borderBottom:"1px solid var(--border-soft)",
                  fontSize:"12px", flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontWeight:600, fontSize:"13px" }}>{p.playerName || "Jugador"}</div>
                    <div style={{ color:"var(--text-3)", fontSize:"11px", marginTop:"2px" }}>
                      {p.method} · {p.date} · <strong style={{ color:"var(--text-2)" }}>{fmt(p.amount,sym)}</strong>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:"6px", flexShrink:0 }}>
                    <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
                      onClick={()=>correr(
                        ()=>confirmPayment?.(p.id, p.playerId),
                        `Cuota de ${p.playerName || "el jugador"} confirmada ✅`)}
                      disabled={!confirmPayment}
                      style={{ ...ss.btn, background:"rgba(34,197,94,0.15)", color:"#22C55E",
                        border:"1px solid rgba(34,197,94,0.35)", fontSize:"12px", padding:"8px 16px",
                        fontWeight:700, opacity:confirmPayment?1:0.5 }}>
                      ✅ Recibí la plata
                    </motion.button>
                    <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
                      onClick={()=>correr(
                        ()=>rejectPayment?.(p.id),
                        "Marcado como no recibido", "warning")}
                      disabled={!rejectPayment}
                      style={{ ...ss.btn, background:"rgba(239,68,68,0.1)", color:"#EF4444",
                        border:"1px solid rgba(239,68,68,0.25)", fontSize:"12px", padding:"8px 14px",
                        opacity:rejectPayment?1:0.5 }}>
                      ✕ No llegó
                    </motion.button>
                  </div>
                </div>
              ))}
            </div>

            {/* Estado del plantel en el mes elegido */}
            <div style={{ ...ss.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"12px 16px", borderBottom:"1px solid var(--border-soft)",
                display:"flex", justifyContent:"space-between", alignItems:"center", gap:"10px", flexWrap:"wrap" }}>
                <span style={{ fontWeight:700, fontSize:"13px" }}>🧾 Cuota del mes</span>
                {/* Selector de mes: una cuota pertenece a un mes, así que la
                    pregunta "¿está al día?" siempre necesita saber cuál. */}
                <div style={{ display:"flex", alignItems:"center", gap:"6px" }}>
                  <button onClick={()=>setMes(m=>correrPeriodo(m,-1))}
                    style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-2)",
                      border:"1px solid var(--border-soft)", fontSize:"12px", padding:"5px 10px" }}>←</button>
                  <span style={{ fontWeight:700, fontSize:"12px", minWidth:"110px", textAlign:"center" }}>
                    {nombrePeriodo(mes)}
                  </span>
                  <button onClick={()=>setMes(m=>correrPeriodo(m,1))} disabled={mes>=periodoDe()}
                    style={{ ...ss.btn, background:"var(--bg-elev-2)",
                      color:mes>=periodoDe()?"var(--text-4)":"var(--text-2)",
                      border:"1px solid var(--border-soft)", fontSize:"12px", padding:"5px 10px",
                      cursor:mes>=periodoDe()?"not-allowed":"pointer" }}>→</button>
                </div>
              </div>

              {/* Resumen del mes */}
              <div style={{ display:"flex", gap:"16px", padding:"12px 16px", flexWrap:"wrap",
                borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                <span><strong style={{ color:"#22C55E", fontSize:"14px" }}>{alDia.length}</strong> al día</span>
                <span><strong style={{ color:"#F59E0B", fontSize:"14px" }}>{declararonMes.length}</strong> por confirmar</span>
                <span><strong style={{ color:"#EF4444", fontSize:"14px" }}>{deben.length}</strong> deben</span>
                <span style={{ marginLeft:"auto", color:"var(--text-3)" }}>
                  Recaudado: <strong style={{ color:"#1FA04A" }}>{fmt(recaudadoMes,sym)}</strong>
                  {cuotaMensual > 0 && <> · falta <strong style={{ color:"#EF4444" }}>{fmt(deben.length*cuotaMensual,sym)}</strong></>}
                </span>
              </div>

              {plantel.length === 0 ? (
                <div style={{ padding:"28px 16px", textAlign:"center", fontSize:"12px", color:"var(--text-3)" }}>
                  No hay jugadores en el plantel todavía.
                </div>
              ) : (
                <>
                  {!cuotaMensual && (
                    <div style={{ padding:"10px 16px", fontSize:"11px", color:"#E0A82E",
                      background:"rgba(201,132,8,0.08)", borderBottom:"1px solid var(--border-soft)" }}>
                      ⚠️ Todavía no configuras el monto de la cuota en Mi Club. Sin monto no se puede
                      registrar un pago desde acá ni calcular cuánto falta.
                    </div>
                  )}
                  {/* Primero los que deben: es la lista sobre la que hay que actuar. */}
                  {plantelOrdenado.map(j => {
                    const est = estadoMes.get(j.id) || "debe";
                    const E = {
                      pagado:    { label:"Al día",        color:"#22C55E" },
                      declarado: { label:"Por confirmar", color:"#F59E0B" },
                      debe:      { label:"Debe",          color:"#EF4444" },
                    }[est];
                    const suyo = pagosDelMes.filter(p => p.playerId === j.id && p.estado === "pagado")[0];
                    return (
                      <div key={j.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"10px 16px", borderBottom:"1px solid var(--border-soft)", fontSize:"12px", gap:"10px" }}>
                        <div style={{ minWidth:0, flex:1 }}>
                          <div style={{ fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{j.name}</div>
                          {suyo && (
                            <div style={{ color:"var(--text-3)", fontSize:"11px" }}>
                              {suyo.method} · {String(suyo.date||"").slice(0,10)} · {fmt(suyo.amount,sym)}
                            </div>
                          )}
                        </div>
                        <span style={{ fontSize:"10px", padding:"3px 9px", borderRadius:"99px", flexShrink:0,
                          background:`${E.color}1A`, color:E.color, border:`1px solid ${E.color}44`,
                          fontWeight:700, whiteSpace:"nowrap" }}>{E.label}</span>
                        {est === "debe" && registrarPagoManual && cuotaMensual > 0 && (
                          <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
                            onClick={()=>correr(
                              ()=>registrarPagoManual({ playerId:j.id, amount:cuotaMensual, method:"Efectivo", periodo:mes }),
                              `Cuota de ${j.name} registrada ✅`)}
                            style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-1)",
                              border:"1px solid var(--border-soft)", fontSize:"11px", padding:"6px 12px",
                              flexShrink:0, whiteSpace:"nowrap" }}>
                            💵 Pagó en efectivo
                          </motion.button>
                        )}
                        {est === "pagado" && suyo && borrarPago && (
                          <button onClick={()=>correr(()=>borrarPago(suyo.id), "Cuota deshecha", "warning")}
                            title="Deshacer este pago"
                            style={{ background:"none", border:"none", color:"var(--text-4)", cursor:"pointer",
                              fontSize:"14px", flexShrink:0, padding:"0 4px" }}>↺</button>
                        )}
                      </div>
                    );
                  })}
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* ── INGRESOS ── */}
        {tab==="ingresos" && (
          <motion.div key="ingresos" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <div style={{ ...ss.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:"13px" }}>Movimientos de ingresos</span>
                <span style={{ fontWeight:800, color:"#1FA04A", fontSize:"14px" }}>{fmt(totalIngresosReal,sym)}</span>
              </div>
              {/* Cuotas de jugadores — solo las confirmadas son ingreso */}
              {cuotasPagadas.map((p,i) => (
                <div key={p.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"12px 16px", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{p.playerName}</div>
                    <div style={{ color:"var(--text-3)", fontSize:"11px" }}>{p.date} · Cuota</div>
                  </div>
                  <span style={{ fontWeight:700, color:"#1FA04A" }}>+{fmt(p.amount,sym)}</span>
                </div>
              ))}
              {/* Otros ingresos */}
              {movimientos.filter(m=>m.tipo==="ingreso").map((m,i) => (
                <motion.div key={m.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"12px 16px", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{m.desc}</div>
                    <div style={{ color:"var(--text-3)", fontSize:"11px" }}>{m.fecha} · {m.cat}</div>
                  </div>
                  <span style={{ fontWeight:700, color:"#1FA04A" }}>+{fmt(m.monto,sym)}</span>
                </motion.div>
              ))}
              {payments.length === 0 && movimientos.filter(m=>m.tipo==="ingreso").length === 0 && (
                <EmptyState icon="💰" title="Sin ingresos aún" desc="Registra el primer ingreso del club para llevar el control financiero." color="#1FA04A"
                  action={()=>{ setFormMov({...emptyMov,tipo:"ingreso"}); setModalMov(true); }} actionLabel="+ Registrar primer ingreso"/>
              )}
            </div>
          </motion.div>
        )}

        {/* ── EGRESOS ── */}
        {tab==="egresos" && (
          <motion.div key="egresos" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <div style={{ ...ss.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:"13px" }}>Movimientos de egresos</span>
                <span style={{ fontWeight:800, color:"#C0392B", fontSize:"14px" }}>{fmt(totalEgresosReal,sym)}</span>
              </div>
              {movimientos.filter(m=>m.tipo==="egreso").map((m,i) => (
                <motion.div key={m.id} initial={{opacity:0}} animate={{opacity:1}} transition={{delay:i*0.04}}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                    padding:"12px 16px", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                  <div>
                    <div style={{ fontWeight:600 }}>{m.desc}</div>
                    <div style={{ color:"var(--text-3)", fontSize:"11px" }}>{m.fecha} · {m.cat}</div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ fontWeight:700, color:"#C0392B" }}>-{fmt(m.monto,sym)}</span>
                    <button onClick={()=>setMovimientos(p=>p.filter(x=>x.id!==m.id))}
                      style={{ background:"none", border:"none", color:"var(--text-4)",
                        cursor:"pointer", fontSize:"14px" }}>×</button>
                  </div>
                </motion.div>
              ))}
              {movimientos.filter(m=>m.tipo==="egreso").length === 0 && (
                <EmptyState icon="📤" title="Sin egresos registrados" desc="Registra los pagos y gastos del club para controlar el presupuesto." color="#C0392B"
                  action={()=>{ setFormMov({...emptyMov,tipo:"egreso"}); setModalMov(true); }} actionLabel="+ Registrar primer egreso"/>
              )}
            </div>
          </motion.div>
        )}

        {/* ── SUELDOS ── */}
        {tab==="sueldos" && (
          <motion.div key="sueldos" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
              <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
                onClick={()=>{ setFormSueldo(emptySueldo); setEditSueldo(null); setModalSueldo(true); }}
                style={{ ...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,
                  color:"#fff", fontSize:"12px", fontWeight:700, boxShadow:`0 4px 14px ${sportColor}44` }}>
                + Agregar persona
              </motion.button>
            </div>
            <div style={{ ...ss.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:"13px" }}>Nómina de sueldos</span>
                <span style={{ fontWeight:800, color:"#C98408" }}>{fmt(totalSueldos,sym)} / mes</span>
              </div>
              {sueldos.length === 0 && (
                <EmptyState icon="👤" title="Sin personas en nómina" desc="Agrega al staff del club para controlar los sueldos mensuales." color="#C98408"
                  action={()=>{ setFormSueldo(emptySueldo); setEditSueldo(null); setModalSueldo(true); }} actionLabel="+ Agregar primera persona"/>
              )}
              {sueldos.map((s,i) => (
                <motion.div key={s.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                  style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px",
                    borderBottom:"1px solid var(--border-soft)", opacity:s.activo?1:0.45 }}>
                  <div style={{ width:"38px", height:"38px", borderRadius:"50%", flexShrink:0,
                    background:`linear-gradient(135deg,${sportColor}33,${sportColor}11)`,
                    display:"flex", alignItems:"center", justifyContent:"center",
                    fontSize:"12px", fontWeight:800, color:sportColor,
                    border:`1.5px solid ${sportColor}44` }}>
                    {s.nombre.split(" ").map(n=>n[0]).join("").slice(0,2).toUpperCase()}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:"13px" }}>{s.nombre}</div>
                    <div style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>{s.cargo}</div>
                  </div>
                  <div style={{ fontWeight:800, color:"#C98408", fontSize:"14px" }}>{fmt(s.monto,sym)}</div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                      onClick={()=>{ setFormSueldo({nombre:s.nombre,cargo:s.cargo,monto:s.monto}); setEditSueldo(s.id); setModalSueldo(true); }}
                      style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-2)",
                        border:"1px solid var(--border-soft)", fontSize:"11px", padding:"5px 10px" }}>
                      Editar
                    </motion.button>
                    <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                      onClick={()=>setSueldos(p=>p.map(x=>x.id===s.id?{...x,activo:!x.activo}:x))}
                      style={{ ...ss.btn, fontSize:"11px", padding:"5px 10px",
                        background:s.activo?"rgba(192,57,43,0.1)":"rgba(31,160,74,0.1)",
                        color:s.activo?"#C0392B":"#1FA04A",
                        border:`1px solid ${s.activo?"rgba(192,57,43,0.3)":"rgba(31,160,74,0.3)"}` }}>
                      {s.activo?"Pausar":"Activar"}
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── GASTOS ADMIN ── */}
        {tab==="admin" && (
          <motion.div key="admin" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:"12px" }}>
              <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}}
                onClick={()=>{ setFormAdmin(emptyAdmin); setEditAdmin(null); setModalAdmin(true); }}
                style={{ ...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,
                  color:"#fff", fontSize:"12px", fontWeight:700, boxShadow:`0 4px 14px ${sportColor}44` }}>
                + Agregar gasto
              </motion.button>
            </div>
            <div style={{ ...ss.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)",
                display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                <span style={{ fontWeight:700, fontSize:"13px" }}>Gastos administrativos fijos</span>
                <span style={{ fontWeight:800, color:"#C0392B" }}>{fmt(totalGastosAdmin,sym)} / mes</span>
              </div>
              {gastosAdmin.length === 0 && (
                <EmptyState icon="💼" title="Sin gastos fijos registrados" desc="Agrega los gastos recurrentes del club: alquiler, servicios, seguros, etc." color={sportColor}
                  action={()=>{ setFormAdmin(emptyAdmin); setEditAdmin(null); setModalAdmin(true); }} actionLabel="+ Agregar primer gasto"/>
              )}
              {gastosAdmin.map((g,i) => (
                <motion.div key={g.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
                  style={{ display:"flex", alignItems:"center", gap:"12px", padding:"14px 16px",
                    borderBottom:"1px solid var(--border-soft)", opacity:g.activo?1:0.45 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:"13px" }}>{g.desc}</div>
                    <div style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"2px" }}>{g.cat}</div>
                  </div>
                  <div style={{ fontWeight:800, color:"#C0392B", fontSize:"14px" }}>{fmt(g.monto,sym)}</div>
                  <div style={{ display:"flex", gap:"6px" }}>
                    <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                      onClick={()=>{ setFormAdmin({cat:g.cat,desc:g.desc,monto:g.monto}); setEditAdmin(g.id); setModalAdmin(true); }}
                      style={{ ...ss.btn, background:"var(--bg-elev-2)", color:"var(--text-2)",
                        border:"1px solid var(--border-soft)", fontSize:"11px", padding:"5px 10px" }}>
                      Editar
                    </motion.button>
                    <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                      onClick={()=>setGastosAdmin(p=>p.filter(x=>x.id!==g.id))}
                      style={{ ...ss.btn, background:"rgba(192,57,43,0.1)", color:"#C0392B",
                        border:"1px solid rgba(192,57,43,0.3)", fontSize:"11px", padding:"5px 10px" }}>
                      Eliminar
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── FLUJO DE CAJA ── */}
        {tab==="flujo" && (
          <motion.div key="flujo" initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} exit={{opacity:0}}>
            <motion.div {...fadeUp} style={{ ...ss.card, marginBottom:"16px" }}>
              <div style={{ fontWeight:700, fontSize:"14px", marginBottom:"16px" }}>📈 Flujo de caja — últimos 6 meses</div>
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={flujoPorMes}>
                  <defs>
                    <linearGradient id="grad-ing" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#1FA04A" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#1FA04A" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="grad-egr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#C0392B" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#C0392B" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)"/>
                  <XAxis dataKey="mes" stroke="#6B7896" fontSize={11}/>
                  <YAxis stroke="#6B7896" fontSize={11} tickFormatter={v=>`$${(v/1000).toFixed(0)}k`}/>
                  <Tooltip contentStyle={{ background:"var(--bg-glass-strong)", backdropFilter:"blur(20px)",
                    border:"1px solid var(--border-mid)", borderRadius:"var(--r-md)", color:"var(--text-1)", fontSize:12 }}
                    formatter={(v,n)=>[fmt(v,sym), n==="ingresos"?"Ingresos":"Egresos"]}/>
                  <Legend/>
                  <Area type="monotone" dataKey="ingresos" stroke="#1FA04A" fill="url(#grad-ing)" strokeWidth={2.5} name="ingresos"/>
                  <Area type="monotone" dataKey="egresos"  stroke="#C0392B" fill="url(#grad-egr)" strokeWidth={2.5} name="egresos"/>
                </AreaChart>
              </ResponsiveContainer>
            </motion.div>

            {/* Tabla cronológica */}
            <motion.div {...fadeUp} transition={{delay:0.1}} style={{ ...ss.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"14px 16px", borderBottom:"1px solid var(--border-soft)", fontWeight:700, fontSize:"13px" }}>
                Todos los movimientos
              </div>
              {[...movimientos].sort((a,b)=>b.fecha.localeCompare(a.fecha)).map((m,i) => (
                <div key={m.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                  padding:"11px 16px", borderBottom:"1px solid var(--border-soft)", fontSize:"12px" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:"10px" }}>
                    <span style={{ fontSize:"16px" }}>{m.tipo==="ingreso"?"💰":"📤"}</span>
                    <div>
                      <div style={{ fontWeight:600 }}>{m.desc}</div>
                      <div style={{ fontSize:"11px", color:"var(--text-3)" }}>{m.fecha} · {m.cat}</div>
                    </div>
                  </div>
                  <span style={{ fontWeight:800, color:m.tipo==="ingreso"?"#1FA04A":"#C0392B" }}>
                    {m.tipo==="ingreso"?"+":"-"}{fmt(m.monto,sym)}
                  </span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── MODALES ── */}
      <AnimatePresence>
        {modalMov && (
          <Modal title={formMov.tipo==="ingreso"?"Registrar ingreso":"Registrar egreso"} onClose={()=>setModalMov(false)}>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              <div>
                <div style={ss.label}>Tipo</div>
                <div style={{ display:"flex", gap:"8px" }}>
                  {["ingreso","egreso"].map(t => (
                    <button key={t} onClick={()=>setFormMov(f=>({...f,tipo:t,cat:t==="ingreso"?CAT_INGRESOS[0]:CAT_EGRESOS[0]}))}
                      style={{ flex:1, padding:"8px", borderRadius:"var(--r-sm)", border:`1px solid ${formMov.tipo===t?(t==="ingreso"?"#1FA04A":"#C0392B"):"var(--border-soft)"}`,
                        background:formMov.tipo===t?(t==="ingreso"?"rgba(31,160,74,0.1)":"rgba(192,57,43,0.1)"):"transparent",
                        color:formMov.tipo===t?(t==="ingreso"?"#1FA04A":"#C0392B"):"var(--text-2)",
                        cursor:"pointer", fontWeight:600, fontSize:"13px", textTransform:"capitalize" }}>
                      {t==="ingreso"?"💰 Ingreso":"📤 Egreso"}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={ss.label}>Categoría</div>
                <select value={formMov.cat} onChange={e=>setFormMov(f=>({...f,cat:e.target.value}))} style={{...ss.input,cursor:"pointer"}}>
                  {(formMov.tipo==="ingreso"?CAT_INGRESOS:CAT_EGRESOS).map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={ss.label}>Descripción</div>
                <input value={formMov.desc} onChange={e=>setFormMov(f=>({...f,desc:e.target.value}))} style={ss.input} placeholder="Ej: Auspicio empresa XYZ"/>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"12px" }}>
                <div>
                  <div style={ss.label}>Monto ({sym})</div>
                  <input type="number" value={formMov.monto} onChange={e=>setFormMov(f=>({...f,monto:e.target.value}))} style={ss.input} placeholder="0"/>
                </div>
                <div>
                  <div style={ss.label}>Fecha</div>
                  <input type="date" value={formMov.fecha} onChange={e=>setFormMov(f=>({...f,fecha:e.target.value}))} style={ss.input}/>
                </div>
              </div>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={agregarMovimiento}
                style={{ ...ss.btn, background:formMov.tipo==="ingreso"?"linear-gradient(135deg,#1FA04A,#16A34A)":"linear-gradient(135deg,#C0392B,#9B2335)",
                  color:"#fff", width:"100%", padding:"13px", fontSize:"14px", fontWeight:700,
                  boxShadow:formMov.tipo==="ingreso"?"0 6px 20px rgba(31,160,74,0.35)":"0 6px 20px rgba(192,57,43,0.35)" }}>
                Guardar {formMov.tipo==="ingreso"?"ingreso":"egreso"}
              </motion.button>
            </div>
          </Modal>
        )}

        {modalSueldo && (
          <Modal title={editSueldo?"Editar sueldo":"Agregar persona"} onClose={()=>setModalSueldo(false)}>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              <div>
                <div style={ss.label}>Nombre completo</div>
                <input value={formSueldo.nombre} onChange={e=>setFormSueldo(f=>({...f,nombre:e.target.value}))} style={ss.input} placeholder="Ej: Carlos Vega"/>
              </div>
              <div>
                <div style={ss.label}>Cargo</div>
                <input value={formSueldo.cargo} onChange={e=>setFormSueldo(f=>({...f,cargo:e.target.value}))} style={ss.input} placeholder="Ej: Entrenador Principal"/>
              </div>
              <div>
                <div style={ss.label}>Sueldo mensual ({sym})</div>
                <input type="number" value={formSueldo.monto} onChange={e=>setFormSueldo(f=>({...f,monto:e.target.value}))} style={ss.input} placeholder="0"/>
              </div>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={guardarSueldo}
                style={{ ...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,
                  color:"#fff", width:"100%", padding:"13px", fontSize:"14px", fontWeight:700,
                  boxShadow:`0 6px 20px ${sportColor}44` }}>
                {editSueldo?"Actualizar":"Agregar"}
              </motion.button>
            </div>
          </Modal>
        )}

        {modalAdmin && (
          <Modal title={editAdmin?"Editar gasto":"Agregar gasto administrativo"} onClose={()=>setModalAdmin(false)}>
            <div style={{ display:"flex", flexDirection:"column", gap:"14px" }}>
              <div>
                <div style={ss.label}>Categoría</div>
                <select value={formAdmin.cat} onChange={e=>setFormAdmin(f=>({...f,cat:e.target.value}))} style={{...ss.input,cursor:"pointer"}}>
                  {CAT_ADMIN.map(c=><option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={ss.label}>Descripción</div>
                <input value={formAdmin.desc} onChange={e=>setFormAdmin(f=>({...f,desc:e.target.value}))} style={ss.input} placeholder="Ej: Cuenta mensual sede"/>
              </div>
              <div>
                <div style={ss.label}>Monto mensual ({sym})</div>
                <input type="number" value={formAdmin.monto} onChange={e=>setFormAdmin(f=>({...f,monto:e.target.value}))} style={ss.input} placeholder="0"/>
              </div>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={guardarAdmin}
                style={{ ...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,
                  color:"#fff", width:"100%", padding:"13px", fontSize:"14px", fontWeight:700,
                  boxShadow:`0 6px 20px ${sportColor}44` }}>
                {editAdmin?"Actualizar":"Agregar"}
              </motion.button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}
