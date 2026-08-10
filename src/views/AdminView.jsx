import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { supabase } from "../lib/supabase";
import { PLANS } from "../lib/freemium";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import { SPORTS_CONFIG } from "../data/sports";
import SectionTitle from "../components/SectionTitle";
import Stat from "../components/Stat";
import Badge from "../components/Badge";
import PanelLesiones from "../components/PanelLesiones";
import Semaforo from "../components/Semaforo";
import EmptyState from "../components/EmptyState";
import FinanzasView from "../components/FinanzasView";
import { downloadTemplate, parsePlayersFile } from "../lib/playerImport";

const EMPTY_PLAYER = {name:"", number:"", cat:"", position:"", age:"", med:"verde", cuota:"ok"};

export default function AdminView({module, sport, sp, club, activeClubs, setActiveClubs, countryData, players, addPlayer, importOrUpdatePlayers, updatePlayer, removePlayer, showToast, sportColor, payments=[], setPayments, confirmPayment, rejectPayment, clubId=null, currentUser=null, userPlan="free"}) {
  const [primaryColor, setPrimaryColor] = useState(club?.colors?.primary || "#1B4332");
  const [secondaryColor, setSecondaryColor] = useState(club?.colors?.secondary || "#FFD700");

  // Cargar los colores reales cuando el club llega desde Supabase (puede
  // llegar después del primer render)
  useEffect(() => {
    if (club?.colors) {
      setPrimaryColor(club.colors.primary || "#1B4332");
      setSecondaryColor(club.colors.secondary || "#FFD700");
    }
  }, [club?.colors]);

  const saveColors = async (primary, secondary) => {
    if (!clubId) return;
    const { error } = await supabase.from("clubs").update({ colors: { primary, secondary } }).eq("id", clubId);
    if (error) showToast("Error al guardar los colores: " + error.message, "error");
  };

  // Datos de pago del club (transferencia manual)
  const emptyPago = { cuota_mensual:"", banco:"", tipo_cuenta:"", numero_cuenta:"", rut_titular:"", nombre_titular:"", email_titular:"", mercadopago_public_key:"", mercadopago_access_token:"" };
  const [pagoForm, setPagoForm] = useState(emptyPago);
  const [pagoSaving, setPagoSaving] = useState(false);
  const [pagoSaved, setPagoSaved] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    supabase.from("club_payment_settings").select("*").eq("club_id", clubId).single()
      .then(({ data }) => { if (data) setPagoForm({ ...emptyPago, ...data }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clubId]);

  const guardarDatosPago = async () => {
    if (!clubId) return;
    setPagoSaving(true);
    const { error } = await supabase.from("club_payment_settings")
      .upsert({ club_id: clubId, ...pagoForm, cuota_mensual: pagoForm.cuota_mensual === "" ? null : Number(pagoForm.cuota_mensual) }, { onConflict: "club_id" });
    setPagoSaving(false);
    if (error) { showToast("Error al guardar datos de pago: " + error.message, "error"); return; }
    setPagoSaved(true);
    setTimeout(() => setPagoSaved(false), 2500);
  };

  const pagosPendientes = payments.filter(p => p.estado === "declarado");

  // Integración con ARUSA (importa partidos automáticamente)
  const [arusaClubId, setArusaClubId] = useState("");
  const [arusaLastSync, setArusaLastSync] = useState(null);
  const [arusaSaving, setArusaSaving] = useState(false);
  const [arusaSyncing, setArusaSyncing] = useState(false);

  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("arusa_club_id, arusa_last_sync").eq("id", clubId).single()
      .then(({ data }) => { if (data) { setArusaClubId(data.arusa_club_id || ""); setArusaLastSync(data.arusa_last_sync); } });
  }, [clubId]);

  const guardarArusaClubId = async () => {
    if (!clubId) return;
    setArusaSaving(true);
    const { error } = await supabase.from("clubs").update({ arusa_club_id: arusaClubId || null }).eq("id", clubId);
    setArusaSaving(false);
    if (error) { showToast("Error al guardar: " + error.message, "error"); return; }
    showToast("ID de ARUSA guardado ✅", "success");
  };

  const sincronizarArusa = async () => {
    if (!clubId) return;
    setArusaSyncing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch("/api/sync-arusa", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ club_id: clubId }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || "Error desconocido");
      setArusaLastSync(new Date().toISOString());
      showToast(`Sincronizado ✅ — ${data.creados} nuevos, ${data.actualizados} actualizados`, "success");
    } catch (e) {
      showToast("Error al sincronizar: " + e.message, "error");
    } finally {
      setArusaSyncing(false);
    }
  };

  // Estado para gestión de jugadores
  const [playerForm, setPlayerForm] = useState(null); // null = cerrado | EMPTY_PLAYER = nuevo | {id,...} = editando
  const [playerSaving, setPlayerSaving] = useState(false);
  const [playerSearch, setPlayerSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState(null); // {id, name, timeoutId}
  const [invRol, setInvRol] = useState("jugador");
  const [invLink, setInvLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [invCats, setInvCats] = useState([]);
  const [invPlantel, setInvPlantel] = useState("");
  const [members, setMembers]           = useState([]);
  const [joinCode, setJoinCode]         = useState("");
  const [joinCopied, setJoinCopied]     = useState(false);
  const [joinRequests, setJoinRequests] = useState([]);
  const [jugTab, setJugTab]             = useState("plantel");
  const [approvedReq, setApprovedReq]   = useState(null);
  const [importBusy, setImportBusy]     = useState(false);
  const [importError, setImportError]   = useState("");

  const handleImportFile = async (file) => {
    if (!file) return;
    setImportBusy(true);
    setImportError("");
    try {
      const result = await parsePlayersFile(file);
      if (!result.ok) { setImportError(result.error); return; }
      await importOrUpdatePlayers(result.players);
      showToast(`${result.players.length} jugadores importados/actualizados ✅`, "success");
    } catch (e) {
      setImportError("Error al leer el archivo: " + e.message);
    } finally {
      setImportBusy(false);
    }
  };

  // Cargar miembros del club desde Supabase
  useEffect(() => {
    if (!clubId) return;
    supabase.from("profiles").select("id,nombre,rol,created_at").eq("club_id", clubId)
      .then(({ data }) => { if (data) setMembers(data); });
  }, [clubId]);

  // Cargar código de club
  useEffect(() => {
    if (!clubId) return;
    supabase.from("clubs").select("join_code").eq("id", clubId).single()
      .then(({ data }) => { if (data?.join_code) setJoinCode(data.join_code); });
  }, [clubId]);

  // Cargar solicitudes de unión
  useEffect(() => {
    if (!clubId) return;
    supabase.from("join_requests").select("*").eq("club_id", clubId)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setJoinRequests(data); });
  }, [clubId]);

  const ROL_OPTS = [
    {id:"jugador",    label:"Jugador",           icon:"👤"},
    {id:"entrenador", label:"Entrenador",         icon:"📋"},
    {id:"preparador", label:"Preparador Físico",  icon:"💪"},
  ];

  const toggleCat = (cat) => {
    setInvCats(prev => prev.includes(cat) ? prev.filter(c=>c!==cat) : [...prev,cat]);
    setInvLink("");
  };

  const canGenerate = () => {
    if(invRol==="jugador") return invPlantel !== "";
    return invCats.length > 0;
  };

  const generateLink = async () => {
    if(!canGenerate()){ showToast("Asigna al menos una categoría antes de generar","warning"); return; }
    const token = Math.random().toString(36).slice(2,8).toUpperCase() + Math.random().toString(36).slice(2,8).toUpperCase();
    const catsValue = invRol==="jugador" ? invPlantel : invCats.join(",");
    const exp = Date.now() + 48 * 60 * 60 * 1000; // expira en 48 horas

    // El token queda respaldado en la tabla invitations — accept_invitation()
    // es la única vía que realmente asigna el rol/club_id al aceptar.
    const { error: invErr } = await supabase.from("invitations").insert({
      token, club_id: clubId, rol: invRol, cats: catsValue,
      created_by: currentUser?.id || null, expires_at: new Date(exp).toISOString(),
    });
    if (invErr) { showToast("Error al generar el link","warning"); return; }

    const base = window.location.origin;
    const catsParam = encodeURIComponent(catsValue);
    const nameParam = encodeURIComponent(club.name);
    const inviterParam = currentUser?.id ? `&inviter=${currentUser.id}` : "";
    setInvLink(`${base}/?token=${token}&rol=${invRol}&club=${clubId||""}&name=${nameParam}&sport=${sport}&cats=${catsParam}${inviterParam}&exp=${exp}`);
    setCopied(false);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(invLink);
    setCopied(true);
    showToast("Link copiado al portapapeles ✅","success");
    setTimeout(()=>setCopied(false), 2500);
  };

  const sendWhatsApp = () => {
    const rolLabel = ROL_OPTS.find(r=>r.id===invRol)?.label;
    const catsLabel = invRol==="jugador" ? invPlantel : invCats.join(", ");
    const msg = encodeURIComponent(`¡Hola! Te invito a unirte a ${club.name} en SportOS como ${rolLabel} (${catsLabel}).\n\nEntra aquí para crear tu cuenta:\n${invLink}`);
    window.open(`https://wa.me/?text=${msg}`,"_blank");
  };

  const regenCode = async () => {
    if (!clubId) return;
    const prefixes = { rugby:"RUGBY", futbol:"FUTBOL", basketball:"BASKET", handball:"HAND", hockey:"HOCKEY" };
    const prefix   = prefixes[sport] || "CLUB";
    const newCode  = `${prefix}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
    await supabase.from("clubs").update({ join_code: newCode }).eq("id", clubId);
    setJoinCode(newCode);
    showToast("Código regenerado ✅", "success");
  };

  const approveRequest = async (req) => {
    const base  = window.location.origin;
    const exp   = Date.now() + 48 * 60 * 60 * 1000;
    const token = Math.random().toString(36).slice(2,8).toUpperCase() + Math.random().toString(36).slice(2,8).toUpperCase();

    const { error: invErr } = await supabase.from("invitations").insert({
      token, club_id: clubId, rol: "jugador", cats: req.categoria || "",
      created_by: currentUser?.id || null, expires_at: new Date(exp).toISOString(),
    });
    if (invErr) { showToast("Error al aprobar la solicitud","warning"); return; }

    await supabase.from("join_requests").update({ status:"aprobado" }).eq("id", req.id);
    setJoinRequests(prev => prev.filter(r => r.id !== req.id));

    const catsParam = encodeURIComponent(req.categoria || "");
    const nameParam = encodeURIComponent(club?.name || "");
    const invParam  = currentUser?.id ? `&inviter=${currentUser.id}` : "";
    const invLink   = `${base}/?token=${token}&rol=jugador&club=${clubId||""}&name=${nameParam}&sport=${sport}&cats=${catsParam}${invParam}&exp=${exp}`;
    setApprovedReq({ request: req, invLink });
  };

  const rejectRequest = async (req) => {
    await supabase.from("join_requests").update({ status:"rechazado" }).eq("id", req.id);
    setJoinRequests(prev => prev.filter(r => r.id !== req.id));
    showToast(`Solicitud de ${req.nombre} rechazada`, "warning");
  };

  // En la mayoría de estos clubes el admin es también quien dirige: si Salud
  // viviera solo en el menú del entrenador, el historial de lesiones quedaría
  // fuera del alcance de la persona que administra el plantel.
  if(module==="salud") return (
    <div>
      <SectionTitle title="Panel de Salud" sub="Estado del plantel e historial de lesiones"/>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"12px"}}>
        {[["verde","Aptos","#22C55E"],["amarillo","Alerta","#F59E0B"],["rojo","No aptos","#EF4444"]].map(([k,l,c])=>(
          <div key={k} style={{...ss.card,cursor:"default"}}>
            <div style={ss.muted}>{l}</div>
            <div style={{fontSize:"26px",fontWeight:800,color:c,letterSpacing:"-0.02em",lineHeight:1.1}}>{players.filter(p=>p.med_status===k).length}</div>
            <div style={{...ss.muted,fontSize:"11px",marginTop:"4px"}}>{players.length?Math.round(players.filter(p=>p.med_status===k).length/players.length*100):0}% del plantel</div>
          </div>
        ))}
      </div>
      <PanelLesiones clubId={clubId} players={players} currentUserId={currentUser?.id||null} showToast={showToast}/>
    </div>
  );

  if(module==="miclub") return (
    <div>
      <SectionTitle title="Configuración del Club" sub="Deportes activos, colores y métodos de pago"/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"20px"}}>
        <motion.div {...fadeUp} style={ss.card}>
          <div style={{fontWeight:600,marginBottom:"14px",fontSize:"14px"}}>🏅 Deportes activos</div>
          {Object.entries(SPORTS_CONFIG).map(([k,v],i)=>(
            <motion.div key={k} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:i*0.06}} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 0",borderBottom:"1px solid var(--border-soft)"}}>
              <div style={{display:"flex",alignItems:"center",gap:"12px"}}><span style={{fontSize:"22px"}}>{v.icon}</span><span style={{fontSize:"13px",fontWeight:500}}>{v.name}</span></div>
              <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                <motion.div onClick={()=>{setActiveClubs(prev=>({...prev,[k]:!prev[k]}));showToast(`${v.name} ${activeClubs[k]?"desactivado":"activado"}`,activeClubs[k]?"warning":"success");}} whileTap={{scale:0.95}} style={{width:"40px",height:"22px",borderRadius:"99px",background:activeClubs[k]?v.color:"#4A5568",position:"relative",transition:"background 0.2s",cursor:"pointer",boxShadow:activeClubs[k]?`0 0 12px ${v.color}66`:"none"}}>
                  <motion.div animate={{left:activeClubs[k]?"20px":"2px"}} transition={{type:"spring",stiffness:500,damping:30}} style={{position:"absolute",top:"2px",width:"18px",height:"18px",borderRadius:"50%",background:"#fff",boxShadow:"0 2px 4px rgba(0,0,0,0.2)"}}/>
                </motion.div>
                <span style={{fontSize:"11px",color:activeClubs[k]?v.color:"var(--text-3)",fontWeight:600,minWidth:"55px",textAlign:"right"}}>{activeClubs[k]?"Activo":"Inactivo"}</span>
              </div>
            </motion.div>
          ))}
        </motion.div>
        <div>
          <motion.div {...fadeUp} transition={{duration:0.4,delay:0.1}} style={{...ss.card,marginBottom:"12px"}}>
            <div style={{fontWeight:600,marginBottom:"12px",fontSize:"14px"}}>🎨 Paleta del club</div>
            <div style={{display:"flex",gap:"16px",alignItems:"center"}}>
              <div><div style={ss.label}>Primario</div><input type="color" value={primaryColor} onChange={e=>{const v=e.target.value;setPrimaryColor(v);saveColors(v,secondaryColor);}} style={{width:"56px",height:"36px",border:"none",borderRadius:"var(--r-sm)",cursor:"pointer",background:"transparent"}}/></div>
              <div><div style={ss.label}>Secundario</div><input type="color" value={secondaryColor} onChange={e=>{const v=e.target.value;setSecondaryColor(v);saveColors(primaryColor,v);}} style={{width:"56px",height:"36px",border:"none",borderRadius:"var(--r-sm)",cursor:"pointer",background:"transparent"}}/></div>
              <motion.div animate={{background:`linear-gradient(135deg,${primaryColor},${secondaryColor})`}} style={{flex:1,height:"44px",borderRadius:"var(--r-md)",border:"1px solid var(--border-soft)",boxShadow:"var(--shadow-sm)"}}/>
            </div>
          </motion.div>
          <motion.div {...fadeUp} transition={{duration:0.4,delay:0.15}} style={{...ss.card,marginBottom:"12px"}}>
            <div style={{fontWeight:600,marginBottom:"12px",fontSize:"14px"}}>💳 País y pagos</div>
            <div style={{fontSize:"15px",marginBottom:"8px",fontWeight:500}}>{countryData.flag} {countryData.name} · {countryData.currency}</div>
            <div style={{...ss.muted,fontSize:"11px",marginBottom:"10px"}}>Documento fiscal: {countryData.tax}</div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>{countryData.payments.map(p=><Badge key={p} color="#3B82F6">{p}</Badge>)}</div>
          </motion.div>
          <motion.div {...fadeUp} transition={{duration:0.4,delay:0.2}} style={ss.card}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              {/* El plan sale del perfil. Estaba escrito a mano ("Plan Pro,
                  renueva el 15 Jun 2025"): a un club en Free le decía que
                  tenía Pro, con una fecha de renovación ya vencida. */}
              <div>
                <div style={{fontWeight:700,fontSize:"14px"}}>{PLANS[userPlan]?.icon} Plan {PLANS[userPlan]?.label || "Free"}</div>
                <div style={{...ss.muted,fontSize:"11px",marginTop:"4px"}}>
                  {PLANS[userPlan]?.price ? `US$${PLANS[userPlan].price} al mes` : "Sin costo"}
                </div>
              </div>
              <Badge color={PLANS[userPlan]?.color || "#6B5A5A"} glow>Activo</Badge>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Código de solicitud del club ── */}
      <motion.div {...fadeUp} transition={{delay:0.22}} style={{...ss.card, marginTop:"20px", border:"1px solid rgba(59,130,246,0.25)", background:"linear-gradient(135deg,rgba(59,130,246,0.06),transparent)"}}>
        <div style={{fontWeight:700,fontSize:"14px",marginBottom:"8px",display:"flex",alignItems:"center",gap:"8px"}}>
          🔑 Código de solicitud del club
        </div>
        <div style={{fontSize:"12px",color:"var(--text-3)",marginBottom:"14px"}}>
          Comparte este código con jugadores para que puedan solicitar unirse desde la pantalla de inicio. Cuando lo apruebas, les envías el link de acceso.
        </div>
        {joinCode ? (
          <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:1,fontFamily:"monospace",fontSize:"22px",fontWeight:900,letterSpacing:"0.12em",color:"#3B82F6",padding:"14px 16px",background:"rgba(59,130,246,0.1)",borderRadius:"var(--r-md)",border:"1px solid rgba(59,130,246,0.25)",textAlign:"center",minWidth:"160px"}}>
              {joinCode}
            </div>
            <div style={{display:"flex",gap:"6px",flexShrink:0}}>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                onClick={()=>{ navigator.clipboard.writeText(joinCode); setJoinCopied(true); setTimeout(()=>setJoinCopied(false),2000); showToast("Código copiado ✅","success"); }}
                style={{...ss.btn,background:joinCopied?"rgba(34,197,94,0.2)":"var(--bg-elev-2)",color:joinCopied?"#22C55E":"var(--text-1)",border:`1px solid ${joinCopied?"rgba(34,197,94,0.4)":"var(--border-soft)"}`,fontSize:"12px",padding:"10px 14px",fontWeight:joinCopied?700:400}}>
                {joinCopied?"✅ Copiado":"📋 Copiar"}
              </motion.button>
              <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={regenCode}
                title="Regenerar (el código anterior dejará de funcionar)"
                style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-3)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"10px 12px"}}>
                🔄
              </motion.button>
            </div>
          </div>
        ) : (
          <div style={{fontSize:"12px",color:"var(--text-3)"}}>Cargando código...</div>
        )}
      </motion.div>

      {/* ── Integración con ARUSA (importa partidos automáticamente) ── */}
      <motion.div {...fadeUp} transition={{delay:0.225}} style={{...ss.card, marginTop:"20px", border:"1px solid rgba(192,57,43,0.25)", background:"linear-gradient(135deg,rgba(192,57,43,0.06),transparent)"}}>
        <div style={{fontWeight:700,fontSize:"14px",marginBottom:"8px",display:"flex",alignItems:"center",gap:"8px"}}>
          🏉 Integración con ARUSA
        </div>
        <div style={{fontSize:"12px",color:"var(--text-3)",marginBottom:"14px"}}>
          Carga el ID del club en arusa.cl (se ve en la URL de la página del club, ej: arusa.cl/es/club/<strong>8077049</strong>) para importar los partidos automáticamente todos los días. También puedes sincronizar manualmente cuando quieras.
        </div>
        <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap",marginBottom:"12px"}}>
          <input value={arusaClubId} onChange={e=>setArusaClubId(e.target.value)} placeholder="Ej: 8077049" style={{...ss.input,maxWidth:"220px"}}/>
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={guardarArusaClubId} disabled={arusaSaving}
            style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-1)",border:"1px solid var(--border-soft)",fontSize:"12px",opacity:arusaSaving?0.6:1}}>
            {arusaSaving?"Guardando...":"Guardar ID"}
          </motion.button>
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={sincronizarArusa} disabled={arusaSyncing || !arusaClubId}
            style={{...ss.btn,background:"linear-gradient(135deg,#C0392B,#9B2335)",color:"#fff",fontSize:"12px",fontWeight:700,opacity:(arusaSyncing||!arusaClubId)?0.6:1}}>
            {arusaSyncing?"Sincronizando...":"🔄 Sincronizar ahora"}
          </motion.button>
        </div>
        <div style={{fontSize:"11px",color:"var(--text-3)"}}>
          {arusaLastSync ? `Última sincronización: ${new Date(arusaLastSync).toLocaleString("es-CL")}` : "Todavía no se ha sincronizado"}
        </div>
      </motion.div>

      {/* ── Datos de pago (transferencia manual) ── */}
      <motion.div {...fadeUp} transition={{delay:0.23}} style={{...ss.card, marginTop:"20px", border:"1px solid rgba(31,160,74,0.25)", background:"linear-gradient(135deg,rgba(31,160,74,0.06),transparent)"}}>
        <div style={{fontWeight:700,fontSize:"14px",marginBottom:"8px",display:"flex",alignItems:"center",gap:"8px"}}>
          🏦 Datos de pago (transferencia)
        </div>
        <div style={{fontSize:"12px",color:"var(--text-3)",marginBottom:"14px"}}>
          Los jugadores verán estos datos al pagar por transferencia. Solo tú (admin) puedes verlos y editarlos.
        </div>
        <div style={{marginBottom:"14px"}}>
          <div style={ss.label}>Cuota mensual ({countryData?.currency||"CLP"})</div>
          <input type="number" min="0" value={pagoForm.cuota_mensual} onChange={e=>setPagoForm(f=>({...f,cuota_mensual:e.target.value}))} placeholder="Ej: 45000" style={{...ss.input,maxWidth:"220px"}}/>
          <div style={{fontSize:"10px",color:"var(--text-4)",marginTop:"4px"}}>Monto que cada jugador debe pagar al mes. Sin esto, los jugadores no podrán pagar.</div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"14px"}}>
          <div>
            <div style={ss.label}>Banco</div>
            <input value={pagoForm.banco} onChange={e=>setPagoForm(f=>({...f,banco:e.target.value}))} placeholder="Ej: Banco Estado" style={ss.input}/>
          </div>
          <div>
            <div style={ss.label}>Tipo de cuenta</div>
            <input value={pagoForm.tipo_cuenta} onChange={e=>setPagoForm(f=>({...f,tipo_cuenta:e.target.value}))} placeholder="Ej: Cuenta Corriente" style={ss.input}/>
          </div>
          <div>
            <div style={ss.label}>Número de cuenta</div>
            <input value={pagoForm.numero_cuenta} onChange={e=>setPagoForm(f=>({...f,numero_cuenta:e.target.value}))} placeholder="Ej: 000123456789" style={ss.input}/>
          </div>
          <div>
            <div style={ss.label}>RUT del titular</div>
            <input value={pagoForm.rut_titular} onChange={e=>setPagoForm(f=>({...f,rut_titular:e.target.value}))} placeholder="Ej: 12.345.678-9" style={ss.input}/>
          </div>
          <div>
            <div style={ss.label}>Nombre del titular</div>
            <input value={pagoForm.nombre_titular} onChange={e=>setPagoForm(f=>({...f,nombre_titular:e.target.value}))} placeholder="Ej: Club Old Reds" style={ss.input}/>
          </div>
          <div>
            <div style={ss.label}>Email del titular</div>
            <input value={pagoForm.email_titular} onChange={e=>setPagoForm(f=>({...f,email_titular:e.target.value}))} placeholder="tesoreria@club.cl" style={ss.input}/>
          </div>
        </div>
        <div style={{borderTop:"1px solid var(--border-soft)",paddingTop:"14px",marginTop:"4px",marginBottom:"14px"}}>
          <div style={{fontWeight:700,fontSize:"13px",marginBottom:"4px",display:"flex",alignItems:"center",gap:"6px"}}>
            🔵 Mercado Pago <span style={{fontSize:"9px",padding:"2px 7px",borderRadius:"99px",background:"rgba(239,68,68,0.12)",color:"#EF4444",fontWeight:700,border:"1px solid rgba(239,68,68,0.3)"}}>no disponible aún</span>
          </div>
          <div style={{fontSize:"11px",color:"var(--text-3)",marginBottom:"10px"}}>
            Esta integración todavía está en verificación y no está habilitada para los jugadores. Puedes cargar tus credenciales ahora para dejarlas listas, pero por ahora los jugadores solo verán "Transferencia" como método de pago.
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px"}}>
            <div>
              <div style={ss.label}>Public Key</div>
              <input value={pagoForm.mercadopago_public_key} onChange={e=>setPagoForm(f=>({...f,mercadopago_public_key:e.target.value}))} placeholder="APP_USR-xxxxxxxx" style={ss.input}/>
            </div>
            <div>
              <div style={ss.label}>Access Token</div>
              <input type="password" value={pagoForm.mercadopago_access_token} onChange={e=>setPagoForm(f=>({...f,mercadopago_access_token:e.target.value}))} placeholder="APP_USR-xxxxxxxx" style={ss.input}/>
            </div>
          </div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:"12px"}}>
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={guardarDatosPago} disabled={pagoSaving}
            style={{...ss.btn,background:"linear-gradient(135deg,#1FA04A,#16A34A)",color:"#fff",fontSize:"13px",fontWeight:700,padding:"10px 20px",opacity:pagoSaving?0.7:1}}>
            {pagoSaving?"Guardando...":"Guardar datos de pago"}
          </motion.button>
          {pagoSaved && <span style={{fontSize:"12px",color:"#1FA04A",fontWeight:600}}>✅ Guardado</span>}
        </div>
      </motion.div>

      {/* ── Confirmaciones de pago pendientes ── */}
      {pagosPendientes.length > 0 && (
        <motion.div {...fadeUp} transition={{delay:0.24}} style={{...ss.card, marginTop:"20px", border:"1px solid rgba(245,158,11,0.3)", background:"linear-gradient(135deg,rgba(245,158,11,0.06),transparent)"}}>
          <div style={{fontWeight:700,fontSize:"14px",marginBottom:"12px",display:"flex",alignItems:"center",gap:"8px"}}>
            ⏳ Confirmaciones de pago pendientes ({pagosPendientes.length})
          </div>
          {pagosPendientes.map(p => (
            <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 0",borderBottom:"1px solid var(--border-soft)",fontSize:"13px"}}>
              <div>
                <div style={{fontWeight:600}}>{p.playerName}</div>
                <div style={{fontSize:"11px",color:"var(--text-3)"}}>{p.method} · {countryData.symbol}{p.amount.toLocaleString()}</div>
              </div>
              <div style={{display:"flex",gap:"6px"}}>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                  onClick={()=>confirmPayment && confirmPayment(p.id, p.playerId)}
                  style={{...ss.btn,background:"rgba(34,197,94,0.15)",color:"#22C55E",border:"1px solid rgba(34,197,94,0.3)",fontSize:"12px",padding:"7px 14px",fontWeight:700}}>
                  ✅ Confirmar
                </motion.button>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                  onClick={()=>rejectPayment && rejectPayment(p.id)}
                  style={{...ss.btn,background:"rgba(239,68,68,0.1)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.25)",fontSize:"12px",padding:"7px 14px"}}>
                  ✕ Rechazar
                </motion.button>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* ── Generador de invitaciones ── */}
      <motion.div {...fadeUp} transition={{delay:0.25}} style={{...ss.card, marginTop:"20px", border:"1px solid rgba(34,197,94,0.25)", background:"linear-gradient(135deg,rgba(34,197,94,0.06),transparent)"}}>
        <div style={{fontWeight:700,fontSize:"14px",marginBottom:"16px",display:"flex",alignItems:"center",gap:"8px"}}>
          🔗 Invitar miembros al club
        </div>

        {/* Paso 1: elegir rol */}
        <div style={{marginBottom:"16px"}}>
          <div style={ss.label}>1. Rol a invitar</div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"6px"}}>
            {ROL_OPTS.map(r=>(
              <motion.button key={r.id} whileTap={{scale:0.96}} onClick={()=>{ setInvRol(r.id); setInvLink(""); setInvCats([]); setInvPlantel(""); }}
                style={{...ss.btn, background:invRol===r.id?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)", color:invRol===r.id?sportColor:"var(--text-2)", border:`1px solid ${invRol===r.id?sportColor+"55":"var(--border-soft)"}`, fontSize:"12px", padding:"9px 16px", boxShadow:invRol===r.id?`0 0 14px ${sportColor}33`:"none"}}>
                {r.icon} {r.label}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Paso 2: asignar categoría(s) */}
        <div style={{marginBottom:"18px"}}>
          {invRol === "jugador" ? (
            <>
              <div style={ss.label}>2. Asignar plantel</div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"6px"}}>
                {sp.categories.map(cat=>(
                  <motion.button key={cat} whileTap={{scale:0.96}} onClick={()=>{ setInvPlantel(cat); setInvLink(""); }}
                    style={{...ss.btn, background:invPlantel===cat?"rgba(34,197,94,0.15)":"var(--bg-elev-2)", color:invPlantel===cat?"#22C55E":"var(--text-2)", border:`1px solid ${invPlantel===cat?"rgba(34,197,94,0.4)":"var(--border-soft)"}`, fontSize:"12px", padding:"8px 14px"}}>
                    {invPlantel===cat?"✅ ":""}{cat}
                  </motion.button>
                ))}
              </div>
              {invPlantel && <div style={{...ss.muted,fontSize:"11px",marginTop:"6px"}}>El jugador solo verá la nómina, entrenamientos y convocatorias de <strong style={{color:"#22C55E"}}>{invPlantel}</strong>.</div>}
            </>
          ) : (
            <>
              <div style={ss.label}>2. Asignar categorías <span style={{color:"var(--text-3)",fontWeight:400}}>(puede ser más de una)</span></div>
              <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginTop:"6px"}}>
                {sp.categories.map(cat=>{
                  const active = invCats.includes(cat);
                  return (
                    <motion.button key={cat} whileTap={{scale:0.96}} onClick={()=>toggleCat(cat)}
                      style={{...ss.btn, background:active?`linear-gradient(135deg,${sportColor}22,${sportColor}08)`:"var(--bg-elev-2)", color:active?sportColor:"var(--text-2)", border:`1px solid ${active?sportColor+"55":"var(--border-soft)"}`, fontSize:"12px", padding:"8px 14px", boxShadow:active?`0 0 12px ${sportColor}22`:"none"}}>
                      {active?"✅ ":""}{cat}
                    </motion.button>
                  );
                })}
              </div>
              {invCats.length > 0 && <div style={{...ss.muted,fontSize:"11px",marginTop:"6px"}}>Tendrá acceso a: <strong style={{color:sportColor}}>{invCats.join(", ")}</strong>.</div>}
            </>
          )}
        </div>

        {/* Paso 3: generar */}
        <motion.button whileHover={{scale:1.03,y:-1}} whileTap={{scale:0.97}} onClick={generateLink}
          style={{...ss.btn, background:canGenerate()?`linear-gradient(135deg,${sportColor},${sportColor}cc)`:"var(--bg-elev-2)", color:canGenerate()?"#fff":"var(--text-3)", fontSize:"13px", padding:"11px 24px", boxShadow:canGenerate()?`0 6px 20px ${sportColor}44`:"none", fontWeight:700, marginBottom:"14px", cursor:canGenerate()?"pointer":"not-allowed"}}>
          🔗 Generar link de invitación
        </motion.button>

        {invLink && (
          <motion.div initial={{opacity:0,y:8}} animate={{opacity:1,y:0}} style={{background:"var(--bg-elev-1)",borderRadius:"var(--r-md)",padding:"14px",border:"1px solid var(--border-soft)"}}>
            <div style={ss.label}>Link de invitación generado</div>
            <div style={{display:"flex",gap:"8px",alignItems:"center",marginTop:"6px",flexWrap:"wrap"}}>
              <div style={{flex:1,fontSize:"11px",color:"#22C55E",fontFamily:"monospace",wordBreak:"break-all",padding:"8px 12px",background:"rgba(34,197,94,0.08)",borderRadius:"var(--r-sm)",border:"1px solid rgba(34,197,94,0.2)"}}>
                {invLink}
              </div>
              <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={copyLink}
                  style={{...ss.btn, background:copied?"rgba(34,197,94,0.2)":"var(--bg-elev-2)", color:copied?"#22C55E":"var(--text-1)", border:`1px solid ${copied?"rgba(34,197,94,0.4)":"var(--border-soft)"}`, fontSize:"12px", padding:"9px 14px", fontWeight:copied?700:400}}>
                  {copied ? "✅ Copiado" : "📋 Copiar"}
                </motion.button>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={sendWhatsApp}
                  style={{...ss.btn, background:"rgba(37,211,102,0.15)", color:"#25D366", border:"1px solid rgba(37,211,102,0.3)", fontSize:"12px", padding:"9px 14px", fontWeight:700}}>
                  WhatsApp
                </motion.button>
              </div>
            </div>
            <div style={{...ss.muted,fontSize:"11px",marginTop:"8px"}}>
              El invitado se registrará directamente como <strong style={{color:sportColor}}>{ROL_OPTS.find(r=>r.id===invRol)?.label}</strong> en {club.name} y quedará vinculado al club automáticamente.
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* ── Miembros del club ── */}
      <motion.div {...fadeUp} transition={{delay:0.3}} style={{...ss.card, marginTop:"20px"}}>
        <div style={{fontWeight:700,fontSize:"14px",marginBottom:"16px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span>👥 Miembros del club</span>
          <span style={{fontSize:"11px",color:"var(--text-3)",fontWeight:400}}>{members.length > 0 ? members.length : players.length} miembros</span>
        </div>
        {(members.length > 0 ? members : [
          {id:1, nombre:"Admin Toros",      rol:"admin"},
          {id:2, nombre:"Eduardo Ramírez",  rol:"entrenador"},
          {id:3, nombre:"Preparador Díaz",  rol:"preparador"},
          {id:4, nombre:"Andrés Castro",    rol:"jugador"},
          {id:5, nombre:"Pablo Rodríguez",  rol:"jugador"},
        ]).map((m,i) => {
          const ROL_COLORS = {admin:"#3B82F6",entrenador:"#C98408",preparador:"#C0392B",jugador:"#1FA04A",superadmin:"#8040CC"};
          const ROL_ICONS  = {admin:"🏢",entrenador:"📋",preparador:"💪",jugador:"👤",superadmin:"⚡"};
          const ROL_LABELS = {admin:"Admin",entrenador:"Entrenador",preparador:"Preparador",jugador:"Jugador",superadmin:"Super Admin"};
          const c = ROL_COLORS[m.rol]||"#6B5A5A";
          return (
            <motion.div key={m.id||i} initial={{opacity:0,x:-8}} animate={{opacity:1,x:0}} transition={{delay:i*0.05}}
              style={{display:"flex",alignItems:"center",gap:"12px",padding:"10px 0",borderBottom:"1px solid var(--border-soft)"}}>
              <div style={{width:"34px",height:"34px",borderRadius:"50%",background:`${c}18`,border:`1.5px solid ${c}44`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"14px",flexShrink:0}}>
                {ROL_ICONS[m.rol]||"👤"}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600,fontSize:"13px"}}>{m.nombre||"—"}</div>
              </div>
              <span style={{fontSize:"10px",padding:"2px 9px",borderRadius:"99px",background:`${c}15`,color:c,border:`1px solid ${c}33`,fontWeight:700}}>
                {ROL_LABELS[m.rol]||m.rol}
              </span>
            </motion.div>
          );
        })}
      </motion.div>

      {/* ── Plan actual ── */}
      {(() => {
        const plan = PLANS[userPlan] || PLANS.free;
        return (
          <motion.div {...fadeUp} transition={{delay:0.35}} style={{...ss.card,marginTop:"20px",border:`1px solid ${plan.color}33`,background:`${plan.color}06`,display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:"12px"}}>
            <div>
              <div style={{fontWeight:700,fontSize:"14px",marginBottom:"3px"}}>{plan.icon} Plan {plan.label} activo</div>
              <div style={{fontSize:"11px",color:"var(--text-3)"}}>
                Por ahora todas las funciones están disponibles en cualquier plan.
              </div>
            </div>
            {userPlan !== "elite" && (
              <motion.button whileHover={{scale:1.04}} whileTap={{scale:0.96}}
                style={{...ss.btn,background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,color:"#fff",fontSize:"12px",padding:"9px 18px",fontWeight:700,boxShadow:`0 4px 14px ${plan.color}44`,flexShrink:0}}>
                {userPlan==="free"?"Subir a Pro — $29/mes":"Subir a Elite — $59/mes"}
              </motion.button>
            )}
          </motion.div>
        );
      })()}
    </div>
  );

  if(module==="jugadores") {
    const filtered = players.filter(p => !playerSearch || p.name?.toLowerCase().includes(playerSearch.toLowerCase()));

    const savePlayer = async () => {
      if (!playerForm?.name?.trim()) { showToast("El nombre es obligatorio","warning"); return; }
      setPlayerSaving(true);
      try {
        // playerForm usa keys cortas (cat/med/cuota) para el form; la tabla
        // real usa category/med_status/cuota_status — mapear antes de guardar.
        const { cat, med, cuota, id, ...rest } = playerForm;
        const dbPlayer = {
          ...rest,
          category: cat || null,
          med_status: med || "verde",
          cuota_status: cuota || "ok",
          number: playerForm.number ? Number(playerForm.number) : null,
          age: playerForm.age ? Number(playerForm.age) : null,
        };
        if (id) {
          await updatePlayer(id, dbPlayer);
          showToast("Jugador actualizado ✅","success");
        } else {
          await addPlayer(dbPlayer);
          showToast("Jugador agregado ✅","success");
        }
        setPlayerForm(null);
      } catch(e) { showToast("Error al guardar: "+e.message,"error"); }
      finally { setPlayerSaving(false); }
    };

    const startDelete = (player) => {
      // Borra optimistamente y muestra toast con undo 5 seg
      const tid = setTimeout(async () => {
        try { await removePlayer(player.id); }
        catch(e) { showToast("Error al eliminar: "+e.message,"error"); }
        setPendingDelete(null);
      }, 5000);
      setPendingDelete({id:player.id, name:player.name, timeoutId:tid});
      showToast(`${player.name} eliminado`, "warning",
        () => { clearTimeout(tid); setPendingDelete(null); showToast("Eliminación cancelada ✓","success"); }
      );
    };

    const pendingCount = joinRequests.filter(r => r.status === "pendiente").length;

    return (
      <div>
        <SectionTitle
          title={`Plantel — ${sp.name} · ${players.length} jugadores`}
          action={
            <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
              onClick={()=>setPlayerForm({...EMPTY_PLAYER})}
              style={{...ss.btn,background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,color:"#fff",fontSize:"12px",boxShadow:`0 4px 14px ${sportColor}44`}}>
              + Agregar jugador
            </motion.button>
          }
        />

        {/* Tabs: Plantel | Solicitudes */}
        <div style={{display:"flex",gap:"6px",marginBottom:"20px"}}>
          {[
            { id:"plantel",      label:`👥 Plantel (${players.length})` },
            { id:"solicitudes",  label:`📩 Solicitudes${pendingCount>0?` (${pendingCount})`:""}` },
            { id:"importar",     label:`📥 Importar Excel` },
          ].map(t=>(
            <motion.button key={t.id} whileTap={{scale:0.97}} onClick={()=>setJugTab(t.id)}
              style={{...ss.btn, fontSize:"12px", padding:"8px 16px",
                background:jugTab===t.id?`${sportColor}22`:"var(--bg-elev-2)",
                color:jugTab===t.id?sportColor:"var(--text-2)",
                border:`1px solid ${jugTab===t.id?sportColor+"55":"var(--border-soft)"}`,
                fontWeight:jugTab===t.id?700:400,
                boxShadow:jugTab===t.id&&pendingCount>0&&t.id==="solicitudes"?`0 0 12px ${sportColor}44`:"none"}}>
              {t.label}
              {t.id==="solicitudes"&&pendingCount>0&&(
                <span style={{marginLeft:"4px",padding:"1px 6px",borderRadius:"99px",background:sportColor,color:"#fff",fontSize:"10px",fontWeight:800}}>
                  {pendingCount}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        {/* ── Vista: Solicitudes ── */}
        {jugTab === "solicitudes" && (
          <div>
            {pendingCount === 0 ? (
              <EmptyState icon="📩" title="Sin solicitudes pendientes"
                desc="Cuando un jugador use el código del club, su solicitud aparecerá aquí para que la apruebes o rechaces."
                color={sportColor}/>
            ) : (
              joinRequests.filter(r => r.status === "pendiente").map(req => (
                <motion.div key={req.id} initial={{opacity:0,y:8}} animate={{opacity:1,y:0}}
                  style={{...ss.card, marginBottom:"10px", border:"1px solid rgba(59,130,246,0.2)"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"12px",flexWrap:"wrap"}}>
                    <div style={{width:44,height:44,borderRadius:"50%",background:`${sportColor}18`,
                      border:`1.5px solid ${sportColor}44`,display:"flex",alignItems:"center",
                      justifyContent:"center",fontSize:"18px",flexShrink:0}}>👤</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:700,fontSize:"13px"}}>{req.nombre}</div>
                      <div style={{fontSize:"11px",color:"var(--text-3)"}}>{req.email}</div>
                      <div style={{display:"flex",gap:"6px",marginTop:"5px",flexWrap:"wrap"}}>
                        {req.posicion && <span style={{fontSize:"10px",padding:"2px 8px",borderRadius:"99px",background:"var(--bg-elev-2)",color:"var(--text-2)",border:"1px solid var(--border-soft)"}}>{req.posicion}</span>}
                        {req.categoria && <span style={{fontSize:"10px",padding:"2px 8px",borderRadius:"99px",background:`${sportColor}15`,color:sportColor,border:`1px solid ${sportColor}33`,fontWeight:600}}>{req.categoria}</span>}
                      </div>
                    </div>
                    <div style={{display:"flex",gap:"6px",flexShrink:0}}>
                      <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                        onClick={()=>approveRequest(req)}
                        style={{...ss.btn,background:"rgba(34,197,94,0.15)",color:"#22C55E",border:"1px solid rgba(34,197,94,0.3)",fontSize:"12px",padding:"8px 14px",fontWeight:700}}>
                        ✅ Aprobar
                      </motion.button>
                      <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                        onClick={()=>rejectRequest(req)}
                        style={{...ss.btn,background:"rgba(239,68,68,0.1)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.25)",fontSize:"12px",padding:"8px 14px"}}>
                        ✕ Rechazar
                      </motion.button>
                    </div>
                  </div>
                  <div style={{fontSize:"10px",color:"var(--text-4)",marginTop:"8px"}}>
                    Solicitó el {new Date(req.created_at).toLocaleDateString("es-CL",{day:"numeric",month:"long"})} a las {new Date(req.created_at).toLocaleTimeString("es-CL",{hour:"2-digit",minute:"2-digit"})}
                  </div>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── Vista: Importar Excel ── */}
        {jugTab === "importar" && (
          <div style={{...ss.card, maxWidth:"560px"}}>
            <div style={{fontWeight:700,fontSize:"14px",marginBottom:"6px"}}>📥 Importar / actualizar plantel desde Excel</div>
            <div style={{fontSize:"12px",color:"var(--text-3)",lineHeight:1.7,marginBottom:"16px"}}>
              Sube la nómina de tu club tal como la tengas — detectamos automáticamente nombre,
              RUT, edad/fecha de nacimiento, teléfono, email, posición y otros datos, sin importar
              el orden ni los títulos exactos de las columnas. Puedes volver a subirla cuando
              quieras: a los jugadores que ya existen (por RUT o nombre) se les actualiza su info,
              y los nuevos se agregan.
            </div>

            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}}
              onClick={downloadTemplate}
              style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-1)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"10px 18px",fontWeight:600,marginBottom:"18px"}}>
              ⬇️ Descargar plantilla de ejemplo (.xlsx)
            </motion.button>

            <div style={{marginBottom:"10px"}}>
              <div style={ss.label}>Subir Excel de tu club</div>
              <input type="file" accept=".xlsx,.xls,.csv"
                disabled={importBusy}
                onChange={e => handleImportFile(e.target.files?.[0])}
                style={{...ss.input, padding:"8px", cursor:importBusy?"not-allowed":"pointer"}}/>
            </div>

            {importBusy && (
              <div style={{fontSize:"12px",color:"var(--text-3)"}}>⏳ Leyendo archivo...</div>
            )}
            {importError && (
              <div style={{fontSize:"12px",color:"#EF4444",marginTop:"8px",padding:"10px 12px",borderRadius:"var(--r-sm)",background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.25)"}}>
                ⚠️ {importError}
              </div>
            )}
          </div>
        )}

        {/* ── Vista: Plantel ── */}
        {jugTab === "plantel" && (<>

        {/* Formulario agregar/editar */}
        {playerForm && (
          <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} style={{...ss.card,marginBottom:"20px",border:`1px solid ${sportColor}44`,background:`linear-gradient(135deg,${sportColor}08,transparent)`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
              <div style={{fontWeight:700,fontSize:"14px"}}>{playerForm.id ? "✏️ Editar jugador" : "➕ Nuevo jugador"}</div>
              <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={()=>setPlayerForm(null)}
                style={{...ss.btn,background:"transparent",color:"var(--text-3)",padding:"2px 8px",fontSize:"16px"}}>✕</motion.button>
            </div>
            {/* Foto del jugador */}
            <div style={{display:"flex",alignItems:"center",gap:"16px",marginBottom:"16px"}}>
              <div style={{position:"relative",flexShrink:0}}>
                {playerForm.avatar_url
                  ? <img src={playerForm.avatar_url} alt="foto" style={{width:64,height:64,borderRadius:"50%",objectFit:"cover",border:`2px solid ${sportColor}55`}}/>
                  : <div style={{width:64,height:64,borderRadius:"50%",background:`linear-gradient(135deg,${sportColor}33,${sportColor}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"20px",fontWeight:800,color:sportColor,border:`2px solid ${sportColor}55`}}>{(playerForm.name||"?").split(" ").map(n=>n[0]).join("").slice(0,2)||"?"}</div>
                }
                <label htmlFor="avatar-upload" style={{position:"absolute",bottom:0,right:0,width:"22px",height:"22px",borderRadius:"50%",background:sportColor,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",border:"2px solid var(--bg-glass)",fontSize:"11px",lineHeight:1}}>📷</label>
                <input id="avatar-upload" type="file" accept="image/*" style={{display:"none"}} onChange={async (e)=>{
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setPlayerSaving(true);
                  const ext = file.name.split(".").pop();
                  const path = `players/${Date.now()}.${ext}`;
                  const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
                  if (error) { showToast("Error al subir foto","error"); setPlayerSaving(false); return; }
                  const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
                  setPlayerForm(p=>({...p, avatar_url: publicUrl}));
                  setPlayerSaving(false);
                  showToast("Foto actualizada ✅","success");
                }}/>
              </div>
              <div style={{flex:1}}>
                <div style={ss.label}>Foto del jugador</div>
                <div style={{fontSize:"11px",color:"var(--text-3)",marginTop:"4px"}}>Toca 📷 para subir desde tu dispositivo.</div>
              </div>
            </div>
            <div className="player-form-grid" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"12px",marginBottom:"12px"}}>
              <div>
                <div style={ss.label}>Nombre completo *</div>
                <input value={playerForm.name||""} onChange={e=>setPlayerForm(p=>({...p,name:e.target.value}))} placeholder="Ej: Carlos Rodríguez" style={ss.input}/>
              </div>
              <div>
                <div style={ss.label}>Número</div>
                <input type="number" min="1" max="99" value={playerForm.number||""} onChange={e=>setPlayerForm(p=>({...p,number:e.target.value}))} placeholder="Ej: 10" style={ss.input}/>
              </div>
              <div>
                <div style={ss.label}>Categoría</div>
                <select value={playerForm.cat||""} onChange={e=>setPlayerForm(p=>({...p,cat:e.target.value}))} style={{...ss.input,cursor:"pointer"}}>
                  <option value="">Sin categoría</option>
                  {sp.categories.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={ss.label}>Posición</div>
                <select value={playerForm.position||""} onChange={e=>setPlayerForm(p=>({...p,position:e.target.value}))} style={{...ss.input,cursor:"pointer"}}>
                  <option value="">Sin posición</option>
                  {(sp.positions||[]).map(pos=><option key={pos} value={pos}>{pos}</option>)}
                </select>
              </div>
              <div>
                <div style={ss.label}>Edad</div>
                <input type="number" min="10" max="60" value={playerForm.age||""} onChange={e=>setPlayerForm(p=>({...p,age:e.target.value}))} placeholder="Ej: 24" style={ss.input}/>
              </div>
              <div>
                <div style={ss.label}>Estado médico</div>
                <select value={playerForm.med||"verde"} onChange={e=>setPlayerForm(p=>({...p,med:e.target.value}))} style={{...ss.input,cursor:"pointer"}}>
                  <option value="verde">🟢 Apto</option>
                  <option value="amarillo">🟡 Alerta</option>
                  <option value="rojo">🔴 No apto</option>
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:"10px",justifyContent:"flex-end"}}>
              <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={()=>setPlayerForm(null)}
                style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-2)",border:"1px solid var(--border-soft)"}}>
                Cancelar
              </motion.button>
              <motion.button disabled={playerSaving} whileHover={{scale:1.02}} whileTap={{scale:0.98}} onClick={savePlayer}
                style={{...ss.btn,background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,color:"#fff",boxShadow:`0 4px 14px ${sportColor}44`,opacity:playerSaving?0.6:1}}>
                {playerSaving ? "Guardando..." : (playerForm.id ? "Guardar cambios" : "Agregar al plantel")}
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* (undo toast manejado desde App.jsx via showToast) */}

        {/* Buscador */}
        <div style={{marginBottom:"14px"}}>
          <input value={playerSearch} onChange={e=>setPlayerSearch(e.target.value)} placeholder="🔍 Buscar jugador..." style={{...ss.input,width:"100%"}}/>
        </div>

        {/* Tabla de jugadores */}
        <motion.div {...fadeUp} className="table-scroll" style={{...ss.card,padding:0,overflow:"hidden"}}>
          <table style={{width:"100%",fontSize:"12px",borderCollapse:"collapse"}}>
            <thead><tr>{["Jugador","Cat.","Pos.","Salud","Cuota","Edad",""].map(h=><th key={h} style={{textAlign:"left",color:"var(--text-3)",padding:"14px 12px",fontWeight:600,borderBottom:"1px solid var(--border-soft)",textTransform:"uppercase",letterSpacing:"0.05em",fontSize:"10px"}}>{h}</th>)}</tr></thead>
            <tbody>{filtered.map((p,i)=>(
              <motion.tr key={p.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:i*0.03}} whileHover={{background:"var(--bg-elev-2)"}} style={{borderBottom:"1px solid var(--border-soft)"}}>
                <td style={{padding:"12px"}}>
                  <div style={{display:"flex",alignItems:"center",gap:"10px"}}>
                    {p.avatar_url
                      ? <img src={p.avatar_url} alt={p.name} style={{width:32,height:32,borderRadius:"50%",objectFit:"cover",border:`1.5px solid ${sportColor}55`,flexShrink:0}}/>
                      : <div style={{width:"32px",height:"32px",borderRadius:"50%",background:`linear-gradient(135deg,${sportColor}33,${sportColor}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"11px",fontWeight:800,color:sportColor,border:`1.5px solid ${sportColor}55`,flexShrink:0}}>{(p.name||"?").split(" ").map(n=>n[0]).join("").slice(0,2)}</div>
                    }
                    <div>
                      <div style={{fontWeight:600}}>{p.name}</div>
                      {p.number && <div style={{fontSize:"10px",color:"var(--text-3)"}}>#{p.number}</div>}
                    </div>
                  </div>
                </td>
                <td style={{color:"var(--text-2)"}}>{p.category||"—"}</td>
                <td style={{color:"var(--text-2)",fontSize:"11px"}}>{p.position||"—"}</td>
                <td><Semaforo status={p.med_status}/></td>
                <td><Badge color={p.cuota_status==="ok"?"#22C55E":"#EF4444"}>{p.cuota_status==="ok"?"Al día":"Vencida"}</Badge></td>
                <td style={{color:"var(--text-2)"}}>{p.age||"—"}</td>
                <td style={{padding:"12px"}}>
                  <div style={{display:"flex",gap:"6px"}}>
                    <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
                      onClick={()=>setPlayerForm({...p, cat: p.category, med: p.med_status, cuota: p.cuota_status})}
                      style={{...ss.btn,background:"transparent",color:sportColor,border:`1px solid ${sportColor}44`,padding:"4px 10px",fontSize:"11px"}}>✏️</motion.button>
                    <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
                      onClick={async ()=>{
                        const base = window.location.origin;
                        const exp = Date.now() + 48*60*60*1000;
                        const token = Math.random().toString(36).slice(2,8).toUpperCase() + Math.random().toString(36).slice(2,8).toUpperCase();
                        const { error: invErr } = await supabase.from("invitations").insert({
                          token, club_id: clubId, rol: "jugador", cats: p.category || "", player_id: p.id,
                          created_by: currentUser?.id || null, expires_at: new Date(exp).toISOString(),
                        });
                        if (invErr) { showToast("Error al generar el link","warning"); return; }
                        const inviterParam = currentUser?.id ? `&inviter=${currentUser.id}` : "";
                        const link = `${base}/?token=${token}&rol=jugador&club=${clubId||""}&name=${encodeURIComponent(club?.name||"")}&sport=${sport}&cats=${encodeURIComponent(p.category||"")}&pid=${p.id}${inviterParam}&exp=${exp}`;
                        navigator.clipboard.writeText(link);
                        showToast(`Link para ${p.name} copiado ✅`,"success");
                      }}
                      title="Copiar link de invitación para este jugador"
                      style={{...ss.btn,background:"transparent",color:"#3B82F6",border:"1px solid #3B82F644",padding:"4px 10px",fontSize:"11px"}}>🔗</motion.button>
                    <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}}
                      onClick={()=>startDelete(p)}
                      style={{...ss.btn,background:"transparent",color:"#EF4444",border:"1px solid #EF444444",padding:"4px 10px",fontSize:"11px"}}>🗑️</motion.button>
                  </div>
                </td>
              </motion.tr>
            ))}</tbody>
          </table>
          {filtered.length === 0 && (
            playerSearch
              ? <EmptyState icon="🔍" title={`Sin resultados para "${playerSearch}"`} desc="Intenta con otro nombre o número." color={sportColor}/>
              : <EmptyState icon="👥" title="No hay jugadores aún" desc="Agrega tu primer jugador para empezar a gestionar el plantel." color={sportColor} action={()=>setPlayerForm({...EMPTY_PLAYER})} actionLabel="+ Agregar primer jugador"/>
          )}
        </motion.div>
        </>)}

        {/* ── Modal: solicitud aprobada ── */}
        {approvedReq && (
          <div style={{position:"fixed",inset:0,zIndex:999,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:"24px"}}
            onClick={()=>setApprovedReq(null)}>
            <motion.div initial={{scale:0.9,opacity:0}} animate={{scale:1,opacity:1}}
              onClick={e=>e.stopPropagation()}
              style={{...ss.card,maxWidth:"500px",width:"100%",padding:"28px"}}>
              <div style={{fontWeight:800,fontSize:"16px",marginBottom:"6px"}}>✅ Solicitud aprobada</div>
              <div style={{fontSize:"13px",color:"var(--text-2)",marginBottom:"16px"}}>
                Envíale este link a <strong>{approvedReq.request.nombre}</strong> ({approvedReq.request.email}) para que cree su cuenta en SportOS.
              </div>
              <div style={{fontFamily:"monospace",fontSize:"11px",color:"#22C55E",padding:"10px 12px",background:"rgba(34,197,94,0.08)",borderRadius:"var(--r-sm)",border:"1px solid rgba(34,197,94,0.2)",wordBreak:"break-all",marginBottom:"14px"}}>
                {approvedReq.invLink}
              </div>
              <div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                  onClick={()=>{ navigator.clipboard.writeText(approvedReq.invLink); showToast("Link copiado ✅","success"); }}
                  style={{...ss.btn,background:"rgba(34,197,94,0.15)",color:"#22C55E",border:"1px solid rgba(34,197,94,0.3)",fontSize:"12px",padding:"9px 16px",fontWeight:700}}>
                  📋 Copiar link
                </motion.button>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
                  onClick={()=>{
                    const msg = encodeURIComponent(`¡Hola ${approvedReq.request.nombre}! Tu solicitud para unirte al club fue aprobada en SportOS 🎉\n\nEntra aquí para crear tu cuenta:\n${approvedReq.invLink}`);
                    window.open(`https://wa.me/?text=${msg}`,"_blank");
                  }}
                  style={{...ss.btn,background:"rgba(37,211,102,0.15)",color:"#25D366",border:"1px solid rgba(37,211,102,0.3)",fontSize:"12px",padding:"9px 16px",fontWeight:700}}>
                  WhatsApp
                </motion.button>
                <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setApprovedReq(null)}
                  style={{...ss.btn,background:"var(--bg-elev-2)",color:"var(--text-2)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"9px 16px"}}>
                  Cerrar
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    );
  }

  if(module==="finanzas") {
    return <FinanzasView countryData={countryData} payments={payments} sportColor={sportColor} showToast={showToast} clubId={clubId}/>;
  }

  return null;
}
