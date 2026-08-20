import { useState, useEffect } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { fadeUp, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";
import { FORMATIONS, equiposDeCategoria, terminoAnotacion } from "../data/sports";
import { usePosts } from "../lib/usePosts";
import { useAttendance, useAttendanceStats, useAsistenciaPrevia, fechasDeEntrenamiento, DIAS_ENTRENAMIENTO } from "../lib/useAttendance";
import { vieneDeArusa } from "../lib/statsArusa";
import { coincide } from "../lib/buscarNombre";
import { useComments } from "../lib/useComments";
import { getLineups, saveLineup, saveMatch, matchToPartido, saveNotification, getMatches } from "../lib/db";
import SectionTitle from "../components/SectionTitle";
import Badge from "../components/Badge";
import EmptyState from "../components/EmptyState";
import PanelLesiones from "../components/PanelLesiones";
import TorneoARUSA from "../components/TorneoARUSA";
import Semaforo from "../components/Semaforo";
import ProgressBar from "../components/ProgressBar";
import MedalBadge from "../components/MedalBadge";
import Cancha from "../components/Cancha";
import WhatsAppModal from "../components/WhatsAppModal";

/* ── NominaDND ─────────────────────────────────────────────── */
function NominaDND({sport, sp, club, players, sportColor, showToast, clubId, currentCategory}) {
  const forms = FORMATIONS[sport];
  const [fKey, setFKey] = useState(forms[0].key);
  // Los equipos dependen de la categoría elegida arriba: en rugby, Adulta
  // presenta Primera, Intermedia y Pre-Intermedia. "Primer Equipo / Reserva /
  // Sub-20" era un listado inventado que no existe en ningún club chileno.
  const equipos = equiposDeCategoria(sp, currentCategory);
  const [teamId, setTeamId] = useState(equipos[0].id);
  useEffect(() => { setTeamId(equipos[0].id); }, [currentCategory]); // eslint-disable-line react-hooks/exhaustive-deps
  const equipoActual = equipos.find(t => t.id === teamId) || equipos[0];
  const [store, setStore] = useState({});
  const [benchStore, setBenchStore] = useState({});
  const [dragged, setDragged] = useState(null);
  const [wa, setWa] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(()=>{setFKey(FORMATIONS[sport][0].key);},[sport]);

  // Cargar nómina guardada desde Supabase al cambiar equipo o formación
  useEffect(() => {
    if (!clubId || !teamId) return;
    getLineups(clubId, teamId).then(saved => {
      if (!saved) return;
      const sk = `${sport}|${teamId}|${saved.formation}`;
      const bk = `${sport}|${teamId}`;
      // Reconstruir objetos de jugador a partir de IDs guardados
      const slots = (saved.slots || []).map(id => players.find(p => p.id === id) || null);
      const bench  = (saved.bench  || []).map(id => players.find(p => p.id === id)).filter(Boolean);
      setFKey(saved.formation);
      setStore(s => ({ ...s, [sk]: slots }));
      setBenchStore(s => ({ ...s, [bk]: bench }));
    }).catch(() => {});
  }, [clubId, teamId, sport, players]);

  const formation = forms.find(f=>f.key===fKey)||forms[0];
  const size = formation.positions.length;
  const sk = `${sport}|${teamId}|${fKey}`;
  const bk = `${sport}|${teamId}`;
  const lineup = store[sk]||Array(size).fill(null);
  const bench  = benchStore[bk]||[];
  const setLineup = (nl)=>setStore(p=>({...p,[sk]:nl}));
  const setBench  = (nb)=>setBenchStore(p=>({...p,[bk]:nb}));

  const blockReason = (p) => {
    if(p.med_status==="rojo") return p.hia_reason?`no apto: ${p.hia_reason}`:"no apto médicamente";
    if(p.cuota_status==="vencida") return "cuota vencida";
    return null;
  };
  const placeInSlot = (idx,p) => {
    if(!p) return;
    const r = blockReason(p);
    if(r){showToast(`${p.name} ${r}`,"warning");return;}
    const nl = lineup.map(x=>x&&x.id===p.id?null:x);
    nl[idx]=p; setLineup(nl);
    setBench(bench.filter(x=>x.id!==p.id));
    if(p.med_status==="amarillo") showToast(`⚠️ ${p.name} agregado con alerta médica`,"warning");
  };
  const addToBench = (p) => {
    const r = blockReason(p);
    if(r){showToast(`${p.name} ${r}`,"warning");return;}
    if(bench.find(x=>x.id===p.id)||lineup.find(x=>x&&x.id===p.id)) return;
    setBench([...bench,p]);
  };
  const tapPlayer = (p) => {
    if(lineup.find(x=>x&&x.id===p.id)){setLineup(lineup.map(x=>x&&x.id===p.id?null:x));return;}
    if(bench.find(x=>x.id===p.id)){setBench(bench.filter(x=>x.id!==p.id));return;}
    const empty = lineup.findIndex(x=>!x);
    if(empty===-1){addToBench(p);return;}
    placeInSlot(empty,p);
  };
  const clearSlot = (idx)=>{const nl=[...lineup];nl[idx]=null;setLineup(nl);};
  const starters = lineup.map((p,i)=>p?{name:p.name,pos:formation.positions[i]}:null).filter(Boolean);
  const assignedIds = new Set([...lineup.filter(Boolean).map(p=>p.id),...bench.map(p=>p.id)]);

  return (
    <div onDragEnd={()=>setDragged(null)}>
      <SectionTitle title={`Nómina — ${sp.name}`} sub={`${equipoActual.name} · arrastra o toca jugadores`}
        action={<div style={{display:"flex",gap:"8px"}}>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
            disabled={saving}
            onClick={async () => {
              if (!starters.length) { showToast("Agrega al menos un titular","warning"); return; }
              setSaving(true);
              try {
                // Guardar nómina con IDs de jugadores
                await saveLineup({ clubId, teamId, formation: fKey, slots: lineup.map(p=>p?.id??null), bench: bench.map(p=>p.id) });
                // Crear notificación real en BD
                await saveNotification({ clubId, type:"nomina", title:"Nómina publicada", body:`${starters.length} titulares convocados para el próximo partido`, data:{ starters: starters.map(s=>s.name), bench: bench.map(b=>b.name) } });
                showToast("✅ Nómina guardada y notificación enviada al plantel","success");
              } catch { showToast("Error al guardar","error"); }
              setSaving(false);
            }}
            style={{...ss.btn,background:"linear-gradient(135deg,#3B82F6,#2563EB)",color:"#fff",fontSize:"12px",boxShadow:"0 4px 12px rgba(59,130,246,0.35)",opacity:saving?0.7:1}}>
            {saving ? "⏳ Guardando..." : "🔔 Guardar y notificar"}
          </motion.button>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>{if(starters.length>0)setWa(true);else showToast("Agrega al menos un titular","warning");}} style={{...ss.btn,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",fontSize:"12px",boxShadow:"0 4px 12px rgba(37,211,102,0.35)"}}>📱 WhatsApp</motion.button>
        </div>}
      />
      <div style={{display:"flex",gap:"10px",marginBottom:"16px",flexWrap:"wrap",alignItems:"flex-end"}}>
        <div>
          <div style={ss.label}>Equipo del club</div>
          <select value={teamId} onChange={e=>setTeamId(e.target.value)} style={{...ss.input,width:"180px",cursor:"pointer"}}>
            {equipos.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        {forms.length>1&&<div style={{flex:1}}>
          <div style={ss.label}>Formación ({forms.length} disponibles)</div>
          <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
            {forms.map(f=><motion.button key={f.key} whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setFKey(f.key)} style={{...ss.btn,background:fKey===f.key?`linear-gradient(135deg,${sportColor}33,${sportColor}11)`:"var(--bg-elev-2)",color:fKey===f.key?sportColor:"var(--text-2)",border:`1px solid ${fKey===f.key?sportColor+"55":"var(--border-soft)"}`,fontSize:"12px",padding:"8px 14px",boxShadow:fKey===f.key?`0 0 16px ${sportColor}33`:"none"}}>{f.key}</motion.button>)}
          </div>
        </div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:"16px",alignItems:"start"}}>
        <div>
          <Cancha type={sport} formation={formation} lineup={lineup} sportColor={sportColor} dragging={!!dragged} onDrop={(i)=>{if(dragged)placeInSlot(i,dragged);}} onSlotClick={(i)=>{if(lineup[i])clearSlot(i);}}/>
          <motion.div {...fadeUp}
            onDragOver={e=>e.preventDefault()} onDrop={()=>{if(dragged)addToBench(dragged);}}
            animate={dragged?{borderColor:sportColor,boxShadow:`0 0 20px ${sportColor}44`}:{borderColor:"var(--border-soft)"}}
            style={{...ss.card,marginTop:"12px",minHeight:"60px",border:`1px dashed ${dragged?sportColor:"var(--border-soft)"}`,borderStyle:"dashed"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <div style={{...ss.label,marginBottom:0}}>🪑 Banco / Suplentes</div>
              <Badge color={sportColor}>{bench.length}</Badge>
            </div>
            <div style={{display:"flex",gap:"6px",flexWrap:"wrap"}}>
              {bench.length===0&&<span style={{...ss.muted,fontSize:"11px"}}>Arrastra jugadores aquí o se agregan al llenar los titulares</span>}
              {bench.map(p=><motion.div key={p.id} initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}} whileHover={{scale:1.05}} onClick={()=>setBench(bench.filter(x=>x.id!==p.id))} style={{display:"flex",alignItems:"center",gap:"6px",background:"var(--bg-elev-2)",borderRadius:"99px",padding:"5px 10px",cursor:"pointer",fontSize:"11px",border:"1px solid var(--border-soft)"}}>
                <Semaforo status={p.med_status}/>{p.name.split(" ").slice(-1)[0]} <span style={{color:"#EF4444",fontWeight:700}}>✕</span>
              </motion.div>)}
            </div>
          </motion.div>
        </div>
        <motion.div {...fadeUp} style={ss.card}>
          <div style={{fontWeight:600,fontSize:"13px",marginBottom:"10px",color:"var(--text-2)",textTransform:"uppercase",letterSpacing:"0.08em"}}>📋 Plantilla ({players.length})</div>
          {players.map((p,i)=>{
            const inUse = assignedIds.has(p.id);
            const blocked = !!blockReason(p);
            return <motion.div key={p.id} draggable={!blocked} onDragStart={()=>setDragged(p)} onClick={()=>tapPlayer(p)}
              initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.25,delay:i*0.02}}
              whileHover={!blocked?{x:3}:{}}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",borderRadius:"var(--r-sm)",marginBottom:"3px",cursor:blocked?"not-allowed":"grab",opacity:blocked?0.4:1,background:inUse?`${sportColor}15`:"transparent",border:`1px solid ${inUse?sportColor+"44":"transparent"}`,transition:"all 0.15s"}}>
              <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
                <Semaforo status={p.med_status}/>
                <span style={{fontSize:"12px",color:inUse?sportColor:"var(--text-1)",fontWeight:inUse?600:400}}>{p.name}</span>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:"6px"}}>
                {p.cuota_status==="vencida"&&<span style={{color:"#EF4444",fontSize:"10px",fontWeight:700}}>$</span>}
                {inUse?<span style={{color:sportColor,fontSize:"12px",fontWeight:700}}>✓</span>:<span style={{color:"var(--text-4)",fontSize:"12px"}}>⠿</span>}
              </div>
            </motion.div>;
          })}
          <div style={{...ss.muted,fontSize:"10px",marginTop:"10px",lineHeight:1.5}}>💡 Arrastra a una posición de la cancha, o toca para autoubicar.</div>
        </motion.div>
      </div>
      {wa&&<WhatsAppModal onClose={()=>setWa(false)} team={`${club.name} · ${equipoActual.name}`} rival={club.next.rival} date={club.next.dia} hora={club.next.hora} lugar={club.next.lugar} starters={starters} bench={bench}/>}
    </div>
  );
}

/* ── Constantes del Muro ─────────────────────────────────────── */
const REACTIONS = ["🔥","💪","👏","😅","❤️","🏆"];
const POST_TYPES = [
  {id:"general",   icon:"💬", label:"Mensaje",  color:"#6B7896"},
  {id:"resultado", icon:"🏆", label:"Resultado", color:"#22C55E"},
  {id:"insignia",  icon:"🎖️", label:"Insignia",  color:"#F59E0B"},
  {id:"reto",      icon:"⚡", label:"Reto",      color:"#A855F7"},
  {id:"admin",     icon:"📢", label:"Aviso",     color:"#3B82F6"},
];

/* ── MuroInput ─────────────────────────────────────────── */
function MuroInput({sportColor, onPublish, players=[]}) {
  const [text, setText]       = useState("");
  const [type, setType]       = useState("general");
  const [expanded, setExpanded] = useState(false);
  // campos extra según tipo
  const [honorado, setHonorado] = useState(""); // para insignia
  const [meta, setMeta]         = useState("");  // para reto
  const [busy, setBusy]         = useState(false);

  const pt = POST_TYPES.find(p=>p.id===type);

  const submit = async () => {
    if (!text.trim()) return;
    let fullText = text.trim();
    if (type==="insignia" && honorado) fullText = `🎖️ ${honorado}: ${fullText}`;
    if (type==="reto" && meta) fullText = `⚡ META: ${meta} — ${fullText}`;
    setBusy(true);
    await onPublish(fullText, type);
    setText(""); setHonorado(""); setMeta(""); setExpanded(false);
    setBusy(false);
  };

  return (
    <motion.div {...fadeUp} style={{...ss.card,marginBottom:"16px",border:`1px solid ${pt.color}33`,background:`linear-gradient(135deg,${pt.color}06,var(--bg-glass))`}}>
      {/* Selector de tipo */}
      <div style={{display:"flex",gap:"6px",marginBottom:"12px",flexWrap:"wrap"}}>
        {POST_TYPES.map(p=>(
          <motion.button key={p.id} whileTap={{scale:0.93}} onClick={()=>setType(p.id)}
            style={{padding:"4px 10px",borderRadius:"99px",border:`1px solid ${type===p.id?p.color+"66":"var(--border-soft)"}`,background:type===p.id?`${p.color}18`:"transparent",color:type===p.id?p.color:"var(--text-3)",fontSize:"11px",fontWeight:type===p.id?700:400,cursor:"pointer",display:"flex",alignItems:"center",gap:"4px",transition:"all 0.15s"}}>
            {p.icon} {p.label}
          </motion.button>
        ))}
      </div>

      <div style={{display:"flex",gap:"10px",alignItems:"flex-start"}}>
        <div style={{width:"36px",height:"36px",borderRadius:"50%",background:`linear-gradient(135deg,${pt.color}44,${pt.color}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"16px",flexShrink:0,border:`1.5px solid ${pt.color}55`}}>{pt.icon}</div>
        <div style={{flex:1,display:"flex",flexDirection:"column",gap:"8px"}}>
          {/* Campo jugador para insignia */}
          {type==="insignia" && (
            <select value={honorado} onChange={e=>setHonorado(e.target.value)} style={{...ss.input,fontSize:"12px"}}>
              <option value="">¿A quién le das la insignia?</option>
              {players.map(p=><option key={p.id} value={p.name}>{p.name}</option>)}
            </select>
          )}
          {/* Meta para reto */}
          {type==="reto" && (
            <input value={meta} onChange={e=>setMeta(e.target.value)} placeholder="Meta del reto (ej: 100kg press banca)" style={{...ss.input,fontSize:"12px"}}/>
          )}
          <input value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>e.key==="Enter"&&submit()}
            placeholder={{general:"Escribe un mensaje al equipo...",resultado:"Cuenta cómo salió el partido...",insignia:"Describe por qué merece esta insignia...",reto:"Describe el reto...",admin:"Aviso importante para el club..."}[type]}
            style={{...ss.input}}/>
        </div>
        <motion.button disabled={busy||!text.trim()} whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={submit}
          style={{...ss.btn,background:`linear-gradient(135deg,${pt.color},${pt.color}cc)`,color:"#fff",boxShadow:`0 4px 12px ${pt.color}44`,opacity:busy||!text.trim()?0.5:1,flexShrink:0}}>
          {busy?"...":"Publicar"}
        </motion.button>
      </div>
    </motion.div>
  );
}

/* ── PostCard ─────────────────────────────────────────── */
function PostCard({post, sportColor, onReact, reactions={}, liked=false, onToggleLike=()=>{}, clubId=null, currentUserId=null, authorName="Yo", showToast=()=>{}}) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment]     = useState("");
  const { comments, addComment: saveComment } = useComments(post.id, clubId);

  const postColors = {"resultado":"#22C55E","médico":"#3B82F6","admin":"#3B82F6","advertencia":"#EF4444","insignia":"#F59E0B","reto":"#A855F7","general":"#6B7896"};
  const color = postColors[post.type] || "#6B7280";

  const addComment = async () => {
    if (!newComment.trim()) return;
    setNewComment("");
    const result = await saveComment({ authorName, text: newComment.trim(), authorId: currentUserId });
    if (result?.ok) showToast("Comentario publicado", "success");
    else if (result?.ok === false && result?.error) showToast("Error al publicar comentario", "error");
  };

  const myReactions = reactions[post.id] || {};
  const totalLikes  = post.likes || 0;

  // Detectar si es insignia o reto para render especial
  const isInsignia = post.type==="insignia";
  const isReto     = post.type==="reto";

  return (
    <motion.div {...fadeUp} whileHover={{y:-2}} style={{...ss.card,marginBottom:"12px",borderLeft:`3px solid ${color}`,overflow:"visible"}}>
      {/* Header */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"10px"}}>
        <div style={{display:"flex",alignItems:"center",gap:"8px"}}>
          <div style={{width:"30px",height:"30px",borderRadius:"50%",background:`linear-gradient(135deg,${color}44,${color}11)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:800,color,border:`1.5px solid ${color}44`}}>
            {(post.author||"?")[0].toUpperCase()}
          </div>
          <div>
            <span style={{fontWeight:600,fontSize:"13px"}}>{post.author}</span>
            <div style={{display:"flex",alignItems:"center",gap:"6px",marginTop:"2px"}}>
              <span style={{fontSize:"10px",padding:"2px 7px",borderRadius:"99px",background:`${color}18`,color,fontWeight:600,border:`1px solid ${color}33`}}>
                {POST_TYPES.find(p=>p.id===post.type)?.icon} {POST_TYPES.find(p=>p.id===post.type)?.label||post.type}
              </span>
            </div>
          </div>
        </div>
        <span style={{fontSize:"11px",color:"var(--text-3)"}}>{post.time}</span>
      </div>

      {/* Contenido especial: insignia */}
      {isInsignia && (
        <motion.div initial={{scale:0.9}} animate={{scale:1}} style={{textAlign:"center",padding:"16px",marginBottom:"10px",borderRadius:"var(--r-md)",background:"linear-gradient(135deg,rgba(245,158,11,0.12),transparent)",border:"1px solid rgba(245,158,11,0.3)"}}>
          <div style={{fontSize:"36px",marginBottom:"6px"}}>🎖️</div>
          <div style={{fontWeight:700,fontSize:"14px",color:"#F59E0B"}}>{post.text.split(":")[0].replace("🎖️","").trim()}</div>
          {post.text.includes(":") && <div style={{fontSize:"13px",color:"var(--text-2)",marginTop:"4px"}}>{post.text.split(":").slice(1).join(":").trim()}</div>}
        </motion.div>
      )}

      {/* Contenido especial: reto */}
      {isReto && (
        <motion.div style={{padding:"14px",marginBottom:"10px",borderRadius:"var(--r-md)",background:"linear-gradient(135deg,rgba(168,85,247,0.1),transparent)",border:"1px solid rgba(168,85,247,0.3)"}}>
          {post.text.includes("META:") ? (
            <>
              <div style={{fontSize:"11px",color:"#A855F7",fontWeight:700,letterSpacing:"0.08em",marginBottom:"4px"}}>⚡ RETO</div>
              <div style={{fontWeight:700,fontSize:"14px",color:"var(--text-1)",marginBottom:"4px"}}>{post.text.split("—")[0].replace("⚡ META:","").trim()}</div>
              {post.text.includes("—") && <div style={{fontSize:"13px",color:"var(--text-2)"}}>{post.text.split("—").slice(1).join("—").trim()}</div>}
            </>
          ) : <p style={{margin:0,fontSize:"13px",lineHeight:1.6}}>{post.text}</p>}
        </motion.div>
      )}

      {/* Texto normal */}
      {!isInsignia && !isReto && (
        <p style={{margin:"0 0 12px",fontSize:"13px",lineHeight:1.6,color:"var(--text-1)"}}>{post.text}</p>
      )}

      {/* Reacciones */}
      <div style={{display:"flex",gap:"6px",flexWrap:"wrap",marginBottom:"10px"}}>
        {REACTIONS.map(emoji=>{
          const count = myReactions[emoji]||0;
          return (
            <motion.button key={emoji} whileHover={{scale:1.15}} whileTap={{scale:0.85}}
              onClick={()=>onReact(post.id, emoji)}
              style={{padding:"4px 9px",borderRadius:"99px",border:`1px solid ${count>0?sportColor+"55":"var(--border-soft)"}`,background:count>0?`${sportColor}18`:"transparent",cursor:"pointer",fontSize:"13px",display:"flex",alignItems:"center",gap:"4px",transition:"all 0.15s",color:count>0?sportColor:"var(--text-2)"}}>
              {emoji}{count>0&&<span style={{fontSize:"10px",fontWeight:700}}>{count}</span>}
            </motion.button>
          );
        })}
        <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.9}}
          onClick={()=>onToggleLike(post.id)}
          style={{...ss.btn,background:liked?"rgba(239,68,68,0.12)":"transparent",color:liked?"#EF4444":"var(--text-2)",fontSize:"11px",padding:"4px 10px",border:`1px solid ${liked?"rgba(239,68,68,0.35)":"var(--border-soft)"}`,marginLeft:"auto"}}>
          {liked?"❤️":"🤍"} {totalLikes}
        </motion.button>
      </div>

      {/* Botón comentarios */}
      <div style={{borderTop:"1px solid var(--border-soft)",paddingTop:"10px"}}>
        <motion.button whileTap={{scale:0.97}} onClick={()=>setShowComments(p=>!p)}
          style={{...ss.btn,background:"transparent",color:"var(--text-3)",fontSize:"12px",padding:"4px 8px",gap:"6px"}}>
          💬 {comments.length>0?`${comments.length} comentario${comments.length>1?"s":""}`:"Comentar"}
        </motion.button>

        <AnimatePresence>
        {showComments && (
          <motion.div initial={{opacity:0,height:0}} animate={{opacity:1,height:"auto"}} exit={{opacity:0,height:0}} style={{overflow:"hidden"}}>
            <div style={{marginTop:"10px",display:"flex",flexDirection:"column",gap:"8px"}}>
              {comments.map(c=>(
                <div key={c.id} style={{display:"flex",gap:"8px",alignItems:"flex-start"}}>
                  <div style={{width:"24px",height:"24px",borderRadius:"50%",background:`${sportColor}22`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"10px",fontWeight:700,color:sportColor,flexShrink:0}}>{c.author[0]}</div>
                  <div style={{background:"var(--bg-elev-2)",borderRadius:"var(--r-sm)",padding:"7px 10px",flex:1}}>
                    <span style={{fontSize:"11px",fontWeight:700,color:sportColor}}>{c.author} </span>
                    <span style={{fontSize:"12px",color:"var(--text-1)"}}>{c.text}</span>
                  </div>
                </div>
              ))}
              <div style={{display:"flex",gap:"8px",marginTop:"4px"}}>
                <input value={newComment} onChange={e=>setNewComment(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&addComment()}
                  placeholder="Escribe un comentario..." style={{...ss.input,fontSize:"12px",padding:"7px 10px"}}/>
                <motion.button disabled={!newComment.trim()} whileTap={{scale:0.95}} onClick={addComment}
                  style={{...ss.btn,background:`${sportColor}22`,color:sportColor,border:`1px solid ${sportColor}44`,padding:"7px 14px",opacity:!newComment.trim()?0.4:1}}>
                  →
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

/* ── AsistenciaGrid ───────────────────────────────────────────
   Antes: un campo de fecha libre (365 días para tres entrenamientos por
   semana), 124 tarjetas en el orden de importación y un clic por jugador sin
   forma de buscar a nadie. Ahora la fecha se elige entre los días que el club
   entrena, hay buscador, marcado masivo, y los que más han venido salen
   primero — apenas haya asistencia registrada de dónde sacarlo. ─────────── */
function AsistenciaGrid({players, sportColor, showToast, present={}, saving={}, onToggle, onMarcarVarios, fecha, setFecha, hoy, conteo={}, previos=null}) {
  const toggle = onToggle || (() => {});
  const [busca, setBusca]   = useState("");
  const [ventana, setVentana] = useState(0); // cuántos bloques de fechas hacia atrás

  const tope = ventana === 0 ? hoy : fechasDeEntrenamiento(hoy, 6 * ventana + 1)[0];
  const fechas = fechasDeEntrenamiento(tope, 6);
  const count = Object.values(present).filter(Boolean).length;
  const diaLargo = fecha
    ? new Date(fecha+"T12:00:00").toLocaleDateString("es-CL",{weekday:"long",day:"numeric",month:"long"})
    : null;

  const hayHistorial = Object.keys(conteo).length > 0;
  // El orden: primero los que estuvieron el entrenamiento anterior (pasar
  // lista pasa a ser confirmar una lista), después los que más entrenan, y al
  // final alfabético. El orden de importación no significa nada para quien
  // mira la lista.
  const vino = (p) => previos?.has(p.id) ? 0 : 1;
  const visibles = players
    .filter(p => coincide(p.name, busca))
    .sort((a,b) =>
      (previos ? vino(a) - vino(b) : 0) ||
      (hayHistorial ? (conteo[b.id]||0) - (conteo[a.id]||0) : 0) ||
      a.name.localeCompare(b.name));

  const idsVisibles = visibles.map(p => p.id);
  const todosMarcados = idsVisibles.length > 0 && idsVisibles.every(id => present[id]);

  const chip = (activo) => ({
    ...ss.btn, flexDirection:"column", gap:"2px", padding:"8px 12px", minWidth:"62px",
    fontSize:"11px", lineHeight:1.2, cursor:"pointer",
    background: activo ? `${sportColor}22` : "var(--bg-elev-2)",
    color:      activo ? sportColor : "var(--text-3)",
    border: `1px solid ${activo ? sportColor : "var(--border-soft)"}`,
  });

  return (
    <div>
      {fecha && (
        <motion.div {...fadeUp} style={{...ss.card,marginBottom:"12px"}}>
          <div style={{display:"flex",alignItems:"center",gap:"10px",flexWrap:"wrap",marginBottom:"12px"}}>
            <span style={{fontSize:"14px",fontWeight:700,textTransform:"capitalize"}}>{diaLargo}</span>
            {fecha === hoy && <Badge color={sportColor}>Hoy</Badge>}
            <div style={{flex:1}}/>
            <span style={{...ss.muted,fontSize:"11px"}}>El club entrena lunes, martes y jueves</span>
          </div>
          <div style={{display:"flex",gap:"6px",alignItems:"center",flexWrap:"wrap"}}>
            <button onClick={()=>setVentana(v=>v+1)} title="Semanas anteriores"
              style={{...ss.btn,padding:"8px 10px",fontSize:"12px",background:"var(--bg-elev-2)",color:"var(--text-3)",border:"1px solid var(--border-soft)"}}>←</button>
            {fechas.map(f => {
              const d = new Date(f+"T12:00:00");
              return (
                <button key={f} onClick={()=>setFecha(f)} style={chip(f===fecha)}>
                  <span style={{textTransform:"capitalize",fontWeight:700}}>
                    {d.toLocaleDateString("es-CL",{weekday:"short"}).replace(".","")}
                  </span>
                  <span style={{opacity:0.75}}>{f.slice(8,10)}/{f.slice(5,7)}</span>
                </button>
              );
            })}
            {ventana > 0 && (
              <button onClick={()=>{setVentana(0);setFecha(hoy);}}
                style={{...ss.btn,padding:"8px 10px",fontSize:"11px",background:"var(--bg-elev-2)",color:"var(--text-3)",border:"1px solid var(--border-soft)"}}>
                Volver a hoy
              </button>
            )}
          </div>
        </motion.div>
      )}

      <motion.div {...fadeUp} style={{...ss.card,marginBottom:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:"10px",alignItems:"center"}}>
          <span style={{fontSize:"13px",fontWeight:600}}>Asistencia: {count}/{players.length}</span>
          <span style={{color:sportColor,fontSize:"15px",fontWeight:800,filter:`drop-shadow(0 0 8px ${sportColor}88)`}}>{players.length>0?Math.round(count/players.length*100):0}%</span>
        </div>
        <ProgressBar value={count} max={players.length} color={sportColor} height={8}/>
        <div style={{display:"flex",gap:"8px",marginTop:"14px",flexWrap:"wrap",alignItems:"center"}}>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Buscar jugador…"
            style={{...ss.input,flex:1,minWidth:"180px",fontSize:"12px",padding:"8px 12px"}}/>
          {onMarcarVarios && (
            <button onClick={()=>onMarcarVarios(idsVisibles, !todosMarcados)}
              style={{...ss.btn,fontSize:"11px",padding:"8px 12px",background:"var(--bg-elev-2)",color:"var(--text-3)",border:"1px solid var(--border-soft)"}}>
              {todosMarcados ? "Desmarcar" : "Marcar"} {busca ? `los ${idsVisibles.length}` : "todos"}
            </button>
          )}
        </div>
      </motion.div>

      {visibles.length === 0 && (
        <div style={{...ss.card,...ss.muted,fontSize:"12px"}}>Nadie coincide con "{busca}".</div>
      )}

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:"8px"}}>
        {visibles.map((p,i)=>{
          const marcado = !!present[p.id];
          return (
            <motion.div key={p.id} initial={{opacity:0,scale:0.96}} animate={{opacity:1,scale:1}}
              transition={{duration:0.2,delay:Math.min(i,20)*0.015}}
              whileHover={{y:-2}} whileTap={{scale:0.97}}
              onClick={()=>{toggle(p.id);if(!marcado)showToast(`${p.name} presente`,"success");}}
              style={{...ss.card,padding:"12px 14px",cursor:"pointer",opacity:saving[p.id]?0.6:1,
                border:`1px solid ${marcado?sportColor+"66":"var(--border-soft)"}`,
                background:marcado?`linear-gradient(135deg,${sportColor}22,${sportColor}05)`:"var(--bg-glass)",
                display:"flex",alignItems:"center",gap:"10px",
                boxShadow:marcado?`0 0 16px ${sportColor}33`:"none"}}>
              <span style={{fontSize:"18px",flexShrink:0}}>{marcado?"✅":"⬜"}</span>
              <div style={{minWidth:0,flex:1}}>
                {/* El nombre completo: "Manzanares" aparecía dos veces en el
                    plantel y no había cómo saber cuál era cuál. */}
                <div style={{fontSize:"12.5px",fontWeight:600,color:marcado?sportColor:"var(--text-1)",
                  overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                {(hayHistorial || previos) && (
                  <div style={{...ss.muted,fontSize:"10px",marginTop:"1px"}}>
                    {previos?.has(p.id) && <span style={{color:sportColor}}>vino la vez pasada · </span>}
                    {conteo[p.id]||0} entrenamiento{(conteo[p.id]||0)===1?"":"s"}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/* ── MuroModule — antes vivía como un bloque if(module==="muro"){...} con
   4 useState() llamados condicionalmente dentro del cuerpo de
   EntrenadorView, violando las Rules of Hooks: al navegar entre módulos
   (ej. Muro → Calendario → Muro) React contaba un número distinto de hooks
   entre renders y tiraba abajo el árbol de React (pantalla en blanco o
   congelada). Ahora es su propio componente, como el resto de los módulos
   de esta vista. ─────────────────────────────────────────────────────── */
function MuroModule({ sp, currentCategory, catsBanner, sportColor, sportCards, players, visiblePlayers, isDemo, userCats, clubId, setPartidos, showToast, posts, createPost, reactions, handleReact, likedByMe, toggleLike, currentUserId }) {
  const [showResultForm, setShowResultForm] = useState(false);
  const [resForm, setResForm] = useState({rival:"", golesLocal:"", golesVisita:"", lugar:"Local", resumen:"", destacados:""});
  const [tarjetas, setTarjetas] = useState([]);          // [{playerId, playerName, tipo, suspende}]
  const [tarjetaForm, setTarjetaForm] = useState({playerId:"", tipo: sportCards[0]?.id||"amarilla"});
  const myCats = isDemo ? sp.categories : userCats;

  const addTarjeta = () => {
    if (!tarjetaForm.playerId) return;
    const player = players.find(p => String(p.id||p.number) === tarjetaForm.playerId);
    const card   = sportCards.find(c => c.id === tarjetaForm.tipo);
    if (!player || !card) return;
    setTarjetas(prev => [...prev, { playerId: tarjetaForm.playerId, playerName: player.name, tipo: card.id, label: card.label, color: card.color, suspende: card.suspende, desc: card.desc }]);
    setTarjetaForm(p => ({ ...p, playerId: "" }));
  };

  const removeTarjeta = (i) => setTarjetas(prev => prev.filter((_,j) => j !== i));

  const publishResultado = async () => {
    if(!resForm.rival || resForm.golesLocal==="" || resForm.golesVisita==="") {
      showToast("Completa rival y marcador antes de publicar","warning"); return;
    }
    const local = Number(resForm.golesLocal), visita = Number(resForm.golesVisita);
    const resultado = local > visita ? "victoria" : local < visita ? "derrota" : "empate";
    const suspendidos = tarjetas.filter(t => t.suspende > 0);
    const nuevo = {
      id: Date.now(),
      cat: myCats[0] || currentCategory,
      equipo: "A",
      rival: resForm.rival,
      fecha: new Date().toISOString().split("T")[0],
      hora: "00:00",
      lugar: resForm.lugar,
      estado: "jugado",
      golesLocal: local,
      golesVisita: visita,
      resultado,
      autor: "Entrenador",
      resumen: resForm.resumen || "Resultado registrado por el cuerpo técnico.",
      destacados: resForm.destacados ? resForm.destacados.split(",").map(d=>d.trim()).filter(Boolean) : [],
      tarjetas,
      videoUrl: null, aiAnalysis: null, aiStatus: null,
    };
    // Guardar en Supabase si hay club real
    let partidoGuardado = nuevo;
    if (clubId) {
      try {
        partidoGuardado = matchToPartido(await saveMatch(clubId, nuevo));
        const resLabel = resultado==="victoria"?"Victoria":resultado==="derrota"?"Derrota":"Empate";
        await saveNotification({ clubId, type:"partido", title:"Resultado publicado",
          body:`${resLabel} ${local}-${visita} vs ${resForm.rival}` }).catch(()=>{});
      } catch (e) {
        showToast("Error al guardar el resultado: " + e.message, "error");
        return;
      }
    }
    setPartidos(prev=>[partidoGuardado,...prev]);
    setResForm({rival:"",golesLocal:"",golesVisita:"",lugar:"Local",resumen:"",destacados:""});
    setTarjetas([]);
    setShowResultForm(false);
    // Toast principal
    showToast(`Resultado publicado — ${resultado.toUpperCase()} ✅`, resultado==="victoria"?"success":"warning");
    // Suspensiones si hay
    if (suspendidos.length > 0) {
      setTimeout(() => showToast(`⚠️ ${suspendidos.length} jugador${suspendidos.length>1?"es":""} con tarjeta roja — revisa las suspensiones`,"warning"), 1200);
    }
  };

  return (
    <div>
      <SectionTitle title={`El Muro — ${sp.name} ${currentCategory}`}/>
      {catsBanner}

      {/* Publicar resultado de partido */}
      <motion.div {...fadeUp} style={{...ss.card, marginBottom:"16px", border:`1px solid ${sportColor}33`, background:`linear-gradient(135deg,${sportColor}08,transparent)`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom: showResultForm?"14px":"0"}}>
          <div style={{fontWeight:600,fontSize:"13px",display:"flex",alignItems:"center",gap:"8px"}}>🏆 Cargar resultado de partido</div>
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setShowResultForm(p=>!p)}
            style={{...ss.btn, background:showResultForm?"rgba(239,68,68,0.12)":`linear-gradient(135deg,${sportColor},${sportColor}cc)`, color:showResultForm?"#EF4444":"#fff", fontSize:"12px", padding:"7px 16px", boxShadow:showResultForm?"none":`0 4px 14px ${sportColor}44`}}>
            {showResultForm ? "✕ Cancelar" : "+ Nuevo resultado"}
          </motion.button>
        </div>

        <AnimatePresence>
        {showResultForm && (
          <motion.div initial={{opacity:0,y:-8}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-8}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"10px",marginBottom:"10px"}}>
              <div>
                <div style={ss.label}>Rival</div>
                <input value={resForm.rival} onChange={e=>setResForm(p=>({...p,rival:e.target.value}))} placeholder="Ej: Universitario RC" style={ss.input}/>
              </div>
              <div>
                <div style={ss.label}>Lugar</div>
                <select value={resForm.lugar} onChange={e=>setResForm(p=>({...p,lugar:e.target.value}))} style={{...ss.input,cursor:"pointer"}}>
                  <option>Local</option><option>Visita</option>
                </select>
              </div>
              <div>
                <div style={ss.label}>{terminoAnotacion(sp).marcador} — Nosotros</div>
                <input type="number" min="0" value={resForm.golesLocal} onChange={e=>setResForm(p=>({...p,golesLocal:e.target.value}))} placeholder="0" style={ss.input}/>
              </div>
              <div>
                <div style={ss.label}>{terminoAnotacion(sp).marcador} — {resForm.rival||"Rival"}</div>
                <input type="number" min="0" value={resForm.golesVisita} onChange={e=>setResForm(p=>({...p,golesVisita:e.target.value}))} placeholder="0" style={ss.input}/>
              </div>
            </div>
            <div style={{marginBottom:"10px"}}>
              <div style={ss.label}>Resumen del partido</div>
              <input value={resForm.resumen} onChange={e=>setResForm(p=>({...p,resumen:e.target.value}))} placeholder="Breve comentario del partido..." style={ss.input}/>
            </div>
            <div style={{marginBottom:"14px"}}>
              <div style={ss.label}>Jugadores destacados <span style={{color:"var(--text-3)",fontWeight:400}}>(separados por coma)</span></div>
              <input value={resForm.destacados} onChange={e=>setResForm(p=>({...p,destacados:e.target.value}))} placeholder="Ej: Andrés Castro, Felipe Morales" style={ss.input}/>
            </div>

            {/* ── Tarjetas del partido ── */}
            <div style={{borderTop:"1px solid var(--border-soft)",paddingTop:"14px",marginBottom:"14px"}}>
              <div style={{fontWeight:700,fontSize:"12px",color:"var(--text-2)",marginBottom:"10px",display:"flex",alignItems:"center",gap:"6px"}}>
                🃏 Tarjetas del partido
                {tarjetas.length > 0 && <span style={{fontSize:"10px",padding:"1px 7px",borderRadius:"99px",background:"rgba(192,57,43,0.15)",color:"#C0392B",fontWeight:800}}>{tarjetas.length}</span>}
              </div>

              {/* Agregar tarjeta */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr auto",gap:"8px",marginBottom:"10px",alignItems:"flex-end"}}>
                <div>
                  <div style={ss.label}>Jugador</div>
                  <select value={tarjetaForm.playerId} onChange={e=>setTarjetaForm(p=>({...p,playerId:e.target.value}))}
                    style={{...ss.input,cursor:"pointer"}}>
                    <option value="">— seleccionar —</option>
                    {players.map(p=><option key={p.id||p.number} value={String(p.id||p.number)}>#{p.number} {p.name}</option>)}
                  </select>
                </div>
                <div>
                  <div style={ss.label}>Tipo</div>
                  <select value={tarjetaForm.tipo} onChange={e=>setTarjetaForm(p=>({...p,tipo:e.target.value}))}
                    style={{...ss.input,cursor:"pointer"}}>
                    {sportCards.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
                <motion.button whileHover={{scale:1.06}} whileTap={{scale:0.94}} onClick={addTarjeta}
                  style={{...ss.btn,background:"var(--bg-elev-3)",color:"var(--text-1)",border:"1px solid var(--border-mid)",padding:"9px 14px",fontSize:"13px",height:"38px",alignSelf:"flex-end"}}>
                  + Agregar
                </motion.button>
              </div>

              {/* Info de la tarjeta seleccionada */}
              {tarjetaForm.tipo && (()=>{const c=sportCards.find(x=>x.id===tarjetaForm.tipo);return c?(<div style={{fontSize:"10px",color:c.color,marginBottom:"10px",padding:"4px 10px",borderRadius:"var(--r-sm)",background:`${c.color}10`,border:`1px solid ${c.color}22`,display:"inline-block"}}>{c.desc} · {c.suspende>0?`${c.suspende} partido${c.suspende>1?"s":""} suspendido${c.suspende>1?"s":""}`:c.suspende===0?"Sin suspensión automática":""}</div>):null;})()}

              {/* Lista de tarjetas agregadas */}
              {tarjetas.length > 0 && (
                <div style={{display:"flex",flexDirection:"column",gap:"6px"}}>
                  {tarjetas.map((t,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:"8px",padding:"8px 10px",borderRadius:"var(--r-sm)",background:`${t.color}0A`,border:`1px solid ${t.color}33`}}>
                      <span style={{fontSize:"14px"}}>{t.label.split(" ")[1]}</span>
                      <div style={{flex:1}}>
                        <span style={{fontWeight:700,fontSize:"12px",color:t.color}}>{t.label.split(" ")[0]}</span>
                        <span style={{fontSize:"12px",color:"var(--text-2)"}}> — {t.playerName}</span>
                        {t.suspende > 0 && <span style={{fontSize:"10px",color:t.color,fontWeight:700,marginLeft:"6px"}}>⚠️ {t.suspende} partido{t.suspende>1?"s":""} suspendido{t.suspende>1?"s":""}</span>}
                      </div>
                      <button onClick={()=>removeTarjeta(i)} style={{background:"transparent",border:"none",cursor:"pointer",color:"var(--text-4)",fontSize:"14px",padding:"0 4px",lineHeight:1}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              {tarjetas.length === 0 && (
                <div style={{fontSize:"11px",color:"var(--text-4)",textAlign:"center",padding:"8px 0"}}>Sin tarjetas registradas</div>
              )}
            </div>

            {/* Placeholder subida de video */}
            <div style={{padding:"12px 14px",borderRadius:"var(--r-md)",background:"rgba(168,85,247,0.06)",border:"1px dashed rgba(168,85,247,0.3)",marginBottom:"14px",display:"flex",alignItems:"center",gap:"10px"}}>
              <span style={{fontSize:"20px"}}>🎬</span>
              <div>
                <div style={{fontSize:"12px",fontWeight:600,color:"#C084FC"}}>Video del partido — próximamente</div>
                <div style={{fontSize:"11px",color:"var(--text-3)",marginTop:"2px"}}>Podrás subir el video y un agente de IA extraerá estadísticas automáticamente.</div>
              </div>
            </div>

            <motion.button whileHover={{scale:1.02,y:-1}} whileTap={{scale:0.98}} onClick={publishResultado}
              style={{...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`, color:"#fff", width:"100%", padding:"13px", fontSize:"13px", fontWeight:700, boxShadow:`0 6px 20px ${sportColor}44`}}>
              🏆 Publicar resultado {tarjetas.length>0?`· ${tarjetas.length} tarjeta${tarjetas.length>1?"s":""}`:""} {tarjetas.filter(t=>t.suspende>0).length>0?`· ⚠️ ${tarjetas.filter(t=>t.suspende>0).length} suspensión${tarjetas.filter(t=>t.suspende>0).length>1?"es":""}` : ""}
            </motion.button>
          </motion.div>
        )}
        </AnimatePresence>
      </motion.div>

      {/* Feed de posts */}
      <MuroInput sportColor={sportColor} players={visiblePlayers} onPublish={async (text, type="general") => {
        try {
          await createPost({ authorId: currentUserId, text, type });
          showToast("Post publicado", "success");
        } catch { showToast("Error al publicar","error"); }
      }}/>
      {posts.length===0 && (
        <EmptyState icon="💬" title="El Muro está vacío" desc="Sé el primero en publicar. Comparte un resultado, da una insignia o lanza un reto al equipo." color={sportColor}/>
      )}
      {posts.map((post,i)=>(
        <PostCard key={post.id} post={post} sportColor={sportColor}
          reactions={reactions} onReact={handleReact}
          liked={!!likedByMe[post.id]} onToggleLike={toggleLike}
          clubId={clubId} currentUserId={currentUserId} showToast={showToast}/>
      ))}
    </div>
  );
}

/* ── CalendarioModule — mismo problema que MuroModule: useState() llamados
   condicionalmente dentro de if(module==="calendario"){...}. Extraído a su
   propio componente por la misma razón (Rules of Hooks). ──────────────── */
function CalendarioModule({ sp, isDemo, userCats, club, sportColor, clubId, setPartidos, showToast, partidos, currentCategory }) {
  const hoy = new Date().toISOString().split("T")[0];
  const myCats = isDemo ? sp.categories : userCats;
  // Equipos que aparecen de verdad en los partidos de esta categoría.
  const equiposConPartidos = [...new Set(partidos.map(p=>p.cat).filter(Boolean))].sort();
  const resColors = {victoria:"#22C55E", empate:"#F59E0B", derrota:"#EF4444"};

  // filtros
  const [filtroCat,  setFiltroCat]  = useState("todos");
  const [filtroEst,  setFiltroEst]  = useState("todos"); // todos | programado | jugado

  // nuevo partido (fila vacía)
  const partidoVacio = () => ({_key:Date.now(), cat:myCats[0]||"Primer Equipo", equipo:"A", rival:"", fecha:"", hora:"", lugar:"Local", estado:"programado", golesLocal:"", golesVisita:"", resumen:"", destacados:""});
  const [nuevos, setNuevos] = useState([]);

  const addFila = () => setNuevos(prev=>[...prev, partidoVacio()]);
  const updateFila = (key, field, val) => setNuevos(prev=>prev.map(p=>p._key===key?{...p,[field]:val}:p));
  const removeFila = (key) => setNuevos(prev=>prev.filter(p=>p._key!==key));

  const guardarTodos = async () => {
    const validos = nuevos.filter(p=>p.rival.trim() && p.fecha);
    if(!validos.length){ showToast("Completa al menos rival y fecha","warning"); return; }
    const preparados = validos.map(p=>({
      cat: p.cat, equipo: p.equipo, rival: p.rival.trim(),
      fecha: p.fecha, hora: p.hora||"00:00", lugar: p.lugar, estado: p.estado,
      golesLocal: p.estado==="jugado"&&p.golesLocal!==""?Number(p.golesLocal):null,
      golesVisita: p.estado==="jugado"&&p.golesVisita!==""?Number(p.golesVisita):null,
      resultado: p.estado==="jugado"?(Number(p.golesLocal)>Number(p.golesVisita)?"victoria":Number(p.golesLocal)<Number(p.golesVisita)?"derrota":"empate"):null,
      autor:"Entrenador", resumen:p.resumen||null,
      destacados: p.destacados?p.destacados.split(",").map(d=>d.trim()).filter(Boolean):[],
      videoUrl:null, aiAnalysis:null, aiStatus:null,
    }));
    let guardados;
    if (clubId) {
      try {
        guardados = await Promise.all(preparados.map(p => saveMatch(clubId, p).then(row => matchToPartido(row))));
      } catch (e) {
        showToast("Error al guardar en BD: " + e.message, "error");
        return;
      }
    } else {
      guardados = preparados.map(p => ({ ...p, id: Date.now() + Math.random() }));
    }
    setPartidos(prev=>[...guardados,...prev]);
    setNuevos([]);
    showToast(`${guardados.length} partido${guardados.length>1?"s":""} guardado${guardados.length>1?"s":""} ✅`,"success");
  };

  const partidosFiltrados = partidos
    // myCats sale de profiles.cats, que en usuarios reales viene vacío: este
    // filtro descartaba absolutamente todos los partidos, siempre. Un usuario
    // sin categorías asignadas no está restringido a ninguna — las ve todas.
    .filter(p=> myCats.length === 0 || myCats.includes(p.cat))
    .filter(p=> filtroCat==="todos" || p.cat===filtroCat)
    .filter(p=> filtroEst==="todos" || p.estado===filtroEst)
    .sort((a,b)=>a.fecha.localeCompare(b.fecha));

  const proximosCount = partidosFiltrados.filter(p=>p.estado==="programado"&&p.fecha>=hoy).length;
  const jugadosCount  = partidosFiltrados.filter(p=>p.estado==="jugado").length;
  const victorias     = partidosFiltrados.filter(p=>p.resultado==="victoria").length;

  return (
    <div>
      <SectionTitle title="Calendario de Temporada" sub={`${club.name} · ${sp.name}`}
        action={
          <motion.button whileHover={{scale:1.05,y:-1}} whileTap={{scale:0.95}} onClick={addFila}
            style={{...ss.btn, background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`, color:"#fff", fontSize:"12px", padding:"8px 18px", boxShadow:`0 4px 14px ${sportColor}44`, fontWeight:700}}>
            + Agregar partido
          </motion.button>
        }
      />

      {/* Stats rápidos */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:"12px",marginBottom:"20px"}}>
        <div style={{...ss.card,textAlign:"center"}}><div style={{fontSize:"26px",fontWeight:800,color:sportColor}}>{proximosCount}</div><div style={ss.muted}>Próximos</div></div>
        <div style={{...ss.card,textAlign:"center"}}><div style={{fontSize:"26px",fontWeight:800,color:"var(--text-1)"}}>{jugadosCount}</div><div style={ss.muted}>Jugados</div></div>
        <div style={{...ss.card,textAlign:"center"}}><div style={{fontSize:"26px",fontWeight:800,color:"#22C55E"}}>{victorias}</div><div style={ss.muted}>Victorias</div></div>
      </div>

      {/* Formulario carga múltiple */}
      <AnimatePresence>
      {nuevos.length>0 && (
        <motion.div initial={{opacity:0,y:-10}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-10}} style={{...ss.card, marginBottom:"20px", border:`1px solid ${sportColor}33`, background:`linear-gradient(135deg,${sportColor}08,transparent)`}}>
          <div style={{fontWeight:700,fontSize:"14px",marginBottom:"14px",display:"flex",justify:"space-between",alignItems:"center",gap:"8px"}}>
            📅 Nuevos partidos <span style={{fontSize:"11px",color:"var(--text-3)",fontWeight:400}}>— completa y guarda todos juntos</span>
          </div>

          {nuevos.map((p,i)=>(
            <motion.div key={p._key} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{delay:i*0.04}}
              style={{borderTop:i>0?"1px solid var(--border-soft)":"none", paddingTop:i>0?"14px":"0", marginBottom:"14px"}}>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))",gap:"8px",alignItems:"end"}}>
                {/* Rival */}
                <div>
                  {i===0&&<div style={ss.label}>Rival</div>}
                  <input value={p.rival} onChange={e=>updateFila(p._key,"rival",e.target.value)} placeholder="Nombre rival" style={ss.input}/>
                </div>
                {/* Fecha */}
                <div>
                  {i===0&&<div style={ss.label}>Fecha</div>}
                  <input type="date" value={p.fecha} onChange={e=>updateFila(p._key,"fecha",e.target.value)} style={ss.input}/>
                </div>
                {/* Hora */}
                <div>
                  {i===0&&<div style={ss.label}>Hora</div>}
                  <input type="time" value={p.hora} onChange={e=>updateFila(p._key,"hora",e.target.value)} style={ss.input}/>
                </div>
                {/* Categoría */}
                <div>
                  {i===0&&<div style={ss.label}>Categoría</div>}
                  <select value={p.cat} onChange={e=>updateFila(p._key,"cat",e.target.value)} style={{...ss.input,cursor:"pointer"}}>
                    {myCats.map(c=><option key={c}>{c}</option>)}
                  </select>
                </div>
                {/* Equipo */}
                <div>
                  {i===0&&<div style={ss.label}>Equipo</div>}
                  <select value={p.cat} onChange={e=>updateFila(p._key,"cat",e.target.value)} style={{...ss.input,cursor:"pointer"}}>
                    {equiposDeCategoria(sp, currentCategory).map(t=><option key={t.id} value={t.name}>{t.name}</option>)}
                  </select>
                </div>
                {/* Lugar */}
                <div>
                  {i===0&&<div style={ss.label}>Lugar</div>}
                  <select value={p.lugar} onChange={e=>updateFila(p._key,"lugar",e.target.value)} style={{...ss.input,cursor:"pointer"}}>
                    <option>Local</option><option>Visita</option>
                  </select>
                </div>
                {/* Eliminar fila */}
                <div style={{paddingTop:i===0?"18px":"0"}}>
                  <motion.button whileTap={{scale:0.9}} onClick={()=>removeFila(p._key)}
                    style={{...ss.btn,background:"rgba(239,68,68,0.1)",color:"#EF4444",border:"1px solid rgba(239,68,68,0.25)",padding:"8px 10px",fontSize:"12px"}}>✕</motion.button>
                </div>
              </div>
              {/* Resultado inline si ya se jugó */}
              <div style={{display:"flex",alignItems:"center",gap:"8px",marginTop:"8px",flexWrap:"wrap"}}>
                <label style={{display:"flex",alignItems:"center",gap:"6px",cursor:"pointer",fontSize:"12px",color:"var(--text-2)"}}>
                  <input type="checkbox" checked={p.estado==="jugado"} onChange={e=>updateFila(p._key,"estado",e.target.checked?"jugado":"programado")} style={{accentColor:sportColor}}/>
                  Ya se jugó
                </label>
                {p.estado==="jugado" && <>
                  <input type="number" min="0" value={p.golesLocal} onChange={e=>updateFila(p._key,"golesLocal",e.target.value)} placeholder="Nos." style={{...ss.input,width:"60px",textAlign:"center"}}/>
                  <span style={{color:"var(--text-3)"}}>:</span>
                  <input type="number" min="0" value={p.golesVisita} onChange={e=>updateFila(p._key,"golesVisita",e.target.value)} placeholder="Rival" style={{...ss.input,width:"60px",textAlign:"center"}}/>
                  <input value={p.resumen} onChange={e=>updateFila(p._key,"resumen",e.target.value)} placeholder="Resumen breve..." style={{...ss.input,flex:1,minWidth:"140px"}}/>
                </>}
              </div>
            </motion.div>
          ))}

          <div style={{display:"flex",gap:"8px",borderTop:"1px solid var(--border-soft)",paddingTop:"14px",flexWrap:"wrap"}}>
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={addFila}
              style={{...ss.btn,background:"transparent",color:sportColor,border:`1px dashed ${sportColor}55`,fontSize:"12px",padding:"9px 16px"}}>
              + Otro partido
            </motion.button>
            <motion.button whileHover={{scale:1.02,y:-1}} whileTap={{scale:0.97}} onClick={guardarTodos}
              style={{...ss.btn,background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,color:"#fff",fontSize:"13px",padding:"9px 22px",fontWeight:700,boxShadow:`0 6px 18px ${sportColor}44`}}>
              💾 Guardar {nuevos.length} partido{nuevos.length!==1?"s":""}
            </motion.button>
            <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.97}} onClick={()=>setNuevos([])}
              style={{...ss.btn,background:"transparent",color:"var(--text-3)",border:"1px solid var(--border-soft)",fontSize:"12px",padding:"9px 14px"}}>
              Cancelar
            </motion.button>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Filtros */}
      <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginBottom:"16px",alignItems:"center"}}>
        <div style={{display:"flex",gap:"4px"}}>
          {["todos","programado","jugado"].map(e=>(
            <motion.button key={e} whileTap={{scale:0.96}} onClick={()=>setFiltroEst(e)}
              style={{...ss.btn,fontSize:"11px",padding:"5px 12px",background:filtroEst===e?`${sportColor}22`:"var(--bg-elev-2)",color:filtroEst===e?sportColor:"var(--text-2)",border:`1px solid ${filtroEst===e?sportColor+"44":"var(--border-soft)"}`,fontWeight:filtroEst===e?700:400}}>
              {e==="todos"?"Todos":e==="programado"?"📅 Próximos":"✅ Jugados"}
            </motion.button>
          ))}
        </div>
        {/* "Eq. A / B / C" no existe en ningún club: los equipos son los que
            declara el deporte (en rugby, Primera / Intermedia / Pre-Intermedia)
            y se sacan de los partidos que realmente hay. El filtro por
            categoría se fue: los partidos ya llegan filtrados por la categoría
            elegida arriba, así que era un segundo filtro sobre lo mismo. */}
        <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
          {["todos",...equiposConPartidos].map(eq=>(
            <motion.button key={eq} whileTap={{scale:0.96}} onClick={()=>setFiltroCat(eq)}
              style={{...ss.btn,fontSize:"11px",padding:"5px 12px",background:filtroCat===eq?`${sportColor}22`:"var(--bg-elev-2)",color:filtroCat===eq?sportColor:"var(--text-2)",border:`1px solid ${filtroCat===eq?sportColor+"44":"var(--border-soft)"}`,fontWeight:filtroCat===eq?700:400}}>
              {eq==="todos"?"Todos los equipos":eq}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Tabla de partidos */}
      <motion.div {...fadeUp} style={{...ss.card,padding:0,overflow:"hidden"}}>
        {partidosFiltrados.length===0 && (
          <EmptyState
            icon="📅"
            title={partidos.length===0 ? "Sin partidos este año" : "Sin partidos para este filtro"}
            desc={partidos.length===0 ? "Agrega el primer partido para llevar el historial de la temporada." : "Prueba cambiando los filtros de arriba."}
            color={sportColor}
            action={partidos.length===0 ? addFila : null}
            actionLabel="+ Agregar primer partido"
          />
        )}
        {partidosFiltrados.map((p,i)=>{
          const esHoy = p.fecha===hoy;
          const esPasado = p.fecha<hoy;
          return (
            <motion.div key={p.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} transition={{delay:i*0.03}}
              style={{display:"flex",alignItems:"center",gap:"12px",padding:"12px 16px",borderBottom:i<partidosFiltrados.length-1?"1px solid var(--border-soft)":"none",background:esHoy?`${sportColor}08`:"transparent",flexWrap:"wrap"}}>

              {/* Fecha y hora */}
              <div style={{minWidth:"72px",flexShrink:0}}>
                <div style={{fontSize:"12px",fontWeight:700,color:esHoy?sportColor:"var(--text-1)"}}>{p.fecha.slice(5).replace("-","/")}</div>
                <div style={{fontSize:"10px",color:"var(--text-3)",marginTop:"1px"}}>{p.hora}</div>
              </div>

              {/* Cat + Equipo */}
              <div style={{display:"flex",gap:"4px",flexShrink:0}}>
                <span style={{fontSize:"10px",padding:"2px 7px",borderRadius:"99px",background:`${sportColor}15`,color:sportColor,border:`1px solid ${sportColor}33`,fontWeight:600}}>{p.cat}</span>
                {/* Decía "Eq.A" — una letra que no significa nada para nadie.
                    El equipo real ya se muestra en la etiqueta de la izquierda. */}
              </div>

              {/* Rival */}
              <div style={{flex:1,minWidth:"120px"}}>
                <div style={{fontSize:"13px",fontWeight:600}}>vs {p.rival}</div>
                <div style={{fontSize:"10px",color:"var(--text-3)",marginTop:"1px"}}>{p.lugar}{esHoy?" · HOY":""}</div>
              </div>

              {/* Resultado o estado */}
              {p.estado==="jugado" && p.resultado ? (
                <div style={{display:"flex",alignItems:"center",gap:"8px",flexShrink:0}}>
                  <span style={{fontSize:"17px",fontWeight:900,letterSpacing:"-0.02em",color:resColors[p.resultado]}}>{p.golesLocal}:{p.golesVisita}</span>
                  <span style={{fontSize:"10px",padding:"2px 8px",borderRadius:"99px",background:`${resColors[p.resultado]}18`,color:resColors[p.resultado],border:`1px solid ${resColors[p.resultado]}44`,fontWeight:700,textTransform:"uppercase"}}>{p.resultado.slice(0,3)}</span>
                </div>
              ) : (
                <span style={{fontSize:"10px",padding:"2px 9px",borderRadius:"99px",background:esPasado?"rgba(239,68,68,0.1)":"rgba(59,130,246,0.1)",color:esPasado?"#EF4444":"#60A5FA",border:`1px solid ${esPasado?"rgba(239,68,68,0.25)":"rgba(59,130,246,0.25)"}`,fontWeight:600,flexShrink:0}}>
                  {esPasado?"Sin resultado":"Programado"}
                </span>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

/* ── EntrenadorView ─────────────────────────────────────────── */
export default function EntrenadorView({module, sport, sp, club, players, showToast, sportColor, currentCategory, hiaModal, setHiaModal, userCats=[], isDemo=true, partidos=[], setPartidos=()=>{}, clubId=null, currentUserId=null}) {
  const postColors = {"resultado":"#22C55E","médico":"#3B82F6","admin":"#3B82F6","advertencia":"#EF4444","insignia":"#F59E0B","reto":"#A855F7"};
  // Sin tabla de estadísticas por jugador todavía — no inventar un número
  // cuando no hay dato real (antes generaba uno "consistente" por fórmula,
  // que además daba NaN con ids uuid reales).
  // Las estadísticas del torneo ya vienen pegadas al plantel desde App.jsx
  // (statsArusa), así que acá solo se lee. Antes el cruce se hacía en esta
  // pantalla y solo en esta: el resto de la app mostraba cero para el mismo
  // jugador.
  const sv = (p,k)=> p.stats?.[k] ?? null;
  const [reactions, setReactions] = useState({});
  const handleReact = (postId, emoji) => {
    setReactions(prev=>{
      const cur = prev[postId]||{};
      return {...prev,[postId]:{...cur,[emoji]:(cur[emoji]||0)+1}};
    });
  };

  // Datos reales desde Supabase (con fallback a mock)
  const { posts, createPost, toggleLike, likedByMe } = usePosts(clubId, currentUserId);
  // La asistencia siempre se guardó con fecha, pero la pantalla no la mostraba
  // ni dejaba cambiarla: marcabas cruces sin saber de qué día eran y no había
  // forma de mirar el entrenamiento del martes pasado.
  const today = new Date().toISOString().split("T")[0];
  // Si hoy no se entrena (un miércoles, un sábado), abre en el último día que
  // sí — que es el que el entrenador viene a corregir.
  const [fechaAsistencia, setFechaAsistencia] = useState(
    () => DIAS_ENTRENAMIENTO.includes(new Date(today+"T12:00:00").getDay())
      ? today
      : fechasDeEntrenamiento(today, 1)[0],
  );
  const { present: attendancePresent, saving: attendanceSaving, toggle: attendanceToggle, marcarVarios: attendanceMarcarVarios, load: loadAttendance } = useAttendance(clubId, fechaAsistencia);
  const attendanceConteo = useAttendanceStats(clubId);
  const attendancePrevios = useAsistenciaPrevia(clubId, fechaAsistencia);

  // Cargar asistencia del día al montar y cuando cambia la fecha/club
  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  // Cargar partidos desde Supabase si hay club real
  useEffect(() => {
    if (!clubId) return;
    getMatches(clubId).then(rows => {
      if (rows && rows.length > 0) setPartidos(rows.map(matchToPartido));
    }).catch(() => {});
  }, [clubId]);

  // En modo real filtra jugadores por las categorías asignadas al entrenador
  const visiblePlayers = isDemo || userCats.length === 0 ? players : players.filter(p => userCats.includes(p.category));

  const catsBanner = !isDemo && userCats.length > 0 ? (
    <motion.div {...fadeUp} style={{...ss.card, marginBottom:"14px", padding:"10px 14px", background:"linear-gradient(135deg,rgba(59,130,246,0.08),transparent)", border:"1px solid rgba(59,130,246,0.25)", display:"flex", alignItems:"center", gap:"10px", flexWrap:"wrap"}}>
      <span style={{fontSize:"11px",color:"var(--text-2)"}}>📋 Tus categorías:</span>
      {userCats.map(c=><span key={c} style={{fontSize:"11px",padding:"2px 10px",borderRadius:"99px",background:"rgba(59,130,246,0.15)",color:"#60A5FA",border:"1px solid rgba(59,130,246,0.3)",fontWeight:600}}>{c}</span>)}
    </motion.div>
  ) : null;

  // Reglas de suspensión por deporte (en partidos)
  const CARD_TYPES = {
    rugby:      [{ id:"amarilla", label:"Amarilla 🟡", color:"#C98408", suspende:0, desc:"10 min en cancha" }, { id:"roja", label:"Roja 🔴", color:"#C0392B", suspende:2, desc:"Mínimo 2 partidos" }],
    futbol:     [{ id:"amarilla", label:"Amarilla 🟡", color:"#C98408", suspende:0, desc:"Acumulable (5=1 partido)" }, { id:"roja", label:"Roja 🔴", color:"#C0392B", suspende:1, desc:"1 partido suspendido" }],
    handball:   [{ id:"amarilla", label:"Amarilla 🟡", color:"#C98408", suspende:0, desc:"Amonestación" }, { id:"roja", label:"Roja 🔴", color:"#C0392B", suspende:1, desc:"1 partido suspendido" }],
    basketball: [{ id:"tecnica", label:"Técnica ⚠️", color:"#C98408", suspende:0, desc:"2 técnicas = expulsión" }, { id:"directa", label:"Directa 🔴", color:"#C0392B", suspende:1, desc:"Revisión disciplinaria" }],
    hockey:     [{ id:"verde", label:"Verde 🟢", color:"#1FA04A", suspende:0, desc:"Amonestación 5 min" }, { id:"amarilla", label:"Amarilla 🟡", color:"#C98408", suspende:0, desc:"10 min exclusión" }, { id:"roja", label:"Roja 🔴", color:"#C0392B", suspende:1, desc:"1 partido suspendido" }],
  };
  const sportCards = CARD_TYPES[sport] || CARD_TYPES.rugby;

  if(module==="muro") return <MuroModule sp={sp} currentCategory={currentCategory} catsBanner={catsBanner}
    sportColor={sportColor} sportCards={sportCards} players={players} visiblePlayers={visiblePlayers}
    isDemo={isDemo} userCats={userCats} clubId={clubId} setPartidos={setPartidos} showToast={showToast}
    posts={posts} createPost={createPost} reactions={reactions} handleReact={handleReact}
    likedByMe={likedByMe} toggleLike={toggleLike} currentUserId={currentUserId}/>;


  if(module==="calendario") return <CalendarioModule sp={sp} isDemo={isDemo} userCats={userCats} club={club}
    sportColor={sportColor} clubId={clubId} setPartidos={setPartidos} showToast={showToast} partidos={partidos} currentCategory={currentCategory}/>;


  if(module==="matchcenter") return (
    <div>
      <SectionTitle title={`Match Center — ${sp.name}`} sub={`Duración: ${sp.matchDuration}`}/>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"16px",marginBottom:"20px"}}>
        <motion.div {...fadeUp} whileHover={{y:-3}} style={{...ss.card,textAlign:"center",border:`1px solid ${club.prev.res==="Victoria"?"#22C55E55":club.prev.res==="Derrota"?"#EF444455":"#F59E0B55"}`,background:club.prev.res==="Victoria"?"linear-gradient(135deg,rgba(34,197,94,0.08),transparent)":club.prev.res==="Derrota"?"linear-gradient(135deg,rgba(239,68,68,0.08),transparent)":"linear-gradient(135deg,rgba(245,158,11,0.08),transparent)"}}>
          <div style={{...ss.muted,fontSize:"11px",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Último partido</div>
          {club.prev.rival ? <>
            <div style={{fontSize:"40px",fontWeight:800,color:club.prev.res==="Victoria"?"#22C55E":club.prev.res==="Derrota"?"#EF4444":"#F59E0B",letterSpacing:"-0.02em"}}>{club.prev.score}</div>
            <div style={{fontSize:"13px",marginTop:"6px",color:"var(--text-2)"}}>vs {club.prev.rival}</div>
            {/* Cuál de los tres equipos de adulta: sin esto el marcador de
                Pre-Intermedia se leía como el del club. */}
            {club.prev.equipo && <div style={{...ss.muted,fontSize:"11px",marginTop:"3px"}}>{club.prev.equipo}</div>}
            <div style={{marginTop:"10px"}}><Badge color={club.prev.res==="Victoria"?"#22C55E":club.prev.res==="Derrota"?"#EF4444":"#F59E0B"} glow>{club.prev.res}</Badge></div>
          </> : (
            <div style={{...ss.muted,fontSize:"13px",padding:"14px 0"}}>Todavía no hay partidos jugados en esta categoría.</div>
          )}
        </motion.div>
        <motion.div {...fadeUp} transition={{duration:0.4,delay:0.1}} whileHover={{y:-3}} style={{...ss.card,textAlign:"center",border:"1px solid rgba(59,130,246,0.35)",background:"linear-gradient(135deg,rgba(59,130,246,0.08),transparent)"}}>
          <div style={{...ss.muted,fontSize:"11px",marginBottom:"8px",textTransform:"uppercase",letterSpacing:"0.08em"}}>Próximo partido</div>
          {club.next.rival ? <>
            <div style={{fontSize:"22px",fontWeight:800,color:"#3B82F6",letterSpacing:"-0.02em",marginBottom:"8px",filter:"drop-shadow(0 0 12px rgba(59,130,246,0.4))"}}>vs {club.next.rival}</div>
            <div style={{fontSize:"15px",fontWeight:700,letterSpacing:"-0.01em",textTransform:"capitalize"}}>{club.next.dia}</div>
            {/* Antes acá decía "Temporada 2026", que no es información: la hora
                y la cancha sí lo son. */}
            <div style={{...ss.muted,fontSize:"12px",marginTop:"4px"}}>
              {[club.next.equipo, club.next.hora && club.next.hora !== "00:00" ? club.next.hora+" hrs" : null, club.next.lugar].filter(Boolean).join(" · ") || "Hora y lugar por confirmar"}
            </div>
          </> : (
            <div style={{...ss.muted,fontSize:"13px",padding:"14px 0"}}>No hay próximo partido programado en esta categoría.</div>
          )}
        </motion.div>
      </div>
      <motion.div {...fadeUp} style={ss.card}>
        <div style={{fontWeight:600,marginBottom:"10px",fontSize:"14px"}}>📊 Stats de temporada</div>
        {/* La posición en el torneo es un dato real y ya lo tenemos; el resto
            (racha, posesión) no lo carga nadie todavía y no se inventa. */}
        <div style={{...ss.muted,fontSize:"12px"}}>
          Racha y posesión todavía no se cargan en el sistema. La posición en el
          torneo está en Estadísticas.
        </div>
      </motion.div>
    </div>
  );

  if(module==="nomina") return <div>{catsBanner}<NominaDND sport={sport} sp={sp} club={club} players={visiblePlayers} sportColor={sportColor} showToast={showToast} clubId={clubId} currentCategory={currentCategory}/></div>;

  if(module==="estadisticas") return (
    <div>
      {catsBanner}
      <SectionTitle title={`Estadísticas — ${sp.name} ${currentCategory}`}/>
      {/* Datos oficiales del torneo. Van arriba porque son la fuente: los
          bloques de abajo (tries, conversiones, penales) se llenan con esto
          mismo, cruzado con el plantel por arusa_player_id. */}
      {/* El torneo solo publica las tres divisiones adultas. Con una de menores
          o juveniles
          elegida, mostrar igual la tabla de Primera sería contestar otra
          pregunta: el usuario pidió M12 y le respondemos con adultos. */}
      {sport==="rugby" && clubId && (
        sp.teamsByCategory?.[currentCategory]
          ? <TorneoARUSA clubName={club?.name} sportColor={sportColor} equipos={sp.teamsByCategory[currentCategory]}/>
          : <div style={{...ss.card, ...ss.muted, fontSize:"12px", marginTop:"16px"}}>
              El torneo de ARUSA solo publica las divisiones adultas. Para {currentCategory} no
              hay tabla ni estadísticas oficiales — elige <strong>Adulta</strong> arriba para verlas.
            </div>
      )}
      {sp.stats.map((stat,si)=>{
        const conDato = visiblePlayers.filter(p=>sv(p,stat.key)!=null);
        const sorted = [...conDato].sort((a,b)=>sv(b,stat.key)-sv(a,stat.key));
        if (sorted.length===0) return (
          <motion.div key={stat.key} {...fadeUp} transition={{duration:0.4,delay:si*0.1}} style={{...ss.card,marginBottom:"16px"}}>
            <div style={{fontWeight:600,marginBottom:"14px",fontSize:"13px",display:"flex",alignItems:"center",gap:"8px"}}>{stat.icon} {stat.label}</div>
            <div style={{...ss.muted,fontSize:"12px"}}>
              {["tries","conversiones","penales"].includes(stat.key)
                ? `Nadie del plantel figura con ${stat.label.toLowerCase()} en el torneo todavía. Si faltan jugadores por vincular con ARUSA, se hace en Mi Club.`
                : `"${stat.label}" no lo publica el torneo y todavía no se carga a mano para este plantel.`}
            </div>
          </motion.div>
        );
        const max = sv(sorted[0],stat.key)||1;
        return (
          <motion.div key={stat.key} {...fadeUp} transition={{duration:0.4,delay:si*0.1}} style={{...ss.card,marginBottom:"16px"}}>
            <div style={{fontWeight:600,marginBottom:"14px",fontSize:"13px",display:"flex",alignItems:"center",gap:"8px"}}>
              {stat.icon} {stat.label}
              {sorted.some(p => vieneDeArusa(p, stat.key)) && (
                <span style={{...ss.muted,fontSize:"10px",fontWeight:400}}>· datos de ARUSA</span>
              )}
            </div>
            {sorted.slice(0,6).map((p,i)=>(
              <motion.div key={p.id} initial={{opacity:0,x:-10}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:si*0.05+i*0.05}} style={{display:"flex",alignItems:"center",gap:"12px",marginBottom:"10px"}}>
                <MedalBadge rank={i+1}/>
                <span style={{fontSize:"12px",minWidth:"130px",color:i<3?sportColor:"var(--text-1)",fontWeight:i<3?600:400}}>{p.name}</span>
                <div style={{flex:1}}><ProgressBar value={sv(p,stat.key)} max={max} color={i===0?sportColor:i===1?"#94A3B8":i===2?"#CD7F32":"#4A5568"}/></div>
                <span style={{fontSize:"13px",fontWeight:700,minWidth:"32px",textAlign:"right",color:i===0?sportColor:"var(--text-1)"}}>{sv(p,stat.key)}</span>
              </motion.div>
            ))}
          </motion.div>
        );
      })}
    </div>
  );

  if(module==="asistencia") return <div>{catsBanner}<SectionTitle title="Control de Asistencia"/><AsistenciaGrid players={visiblePlayers} sportColor={sportColor} showToast={showToast} present={attendancePresent} saving={attendanceSaving} onToggle={(id)=>{attendanceToggle(id);}} onMarcarVarios={attendanceMarcarVarios} fecha={fechaAsistencia} setFecha={setFechaAsistencia} hoy={today} conteo={attendanceConteo} previos={attendancePrevios}/></div>;

  if(module==="salud") return (
    <div>
      <SectionTitle title="Panel de Salud" sub={`${sp.name} · Temporada ${new Date().getFullYear()}`} action={sp.hasHIA&&<motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}} onClick={()=>setHiaModal(true)} style={{...ss.btn,background:"rgba(239,68,68,0.15)",color:"#EF4444",border:"1px solid #EF444455",fontSize:"12px",boxShadow:"0 0 16px rgba(239,68,68,0.25)"}}>⚠️ Protocolo HIA</motion.button>}/>
      {hiaModal&&sp.hasHIA&&(
        <motion.div {...scaleIn} style={{...ss.card,marginBottom:"20px",border:"2px solid #EF444455",background:"linear-gradient(135deg,rgba(239,68,68,0.08),transparent)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"14px"}}>
            <h3 style={{margin:0,color:"#EF4444",fontSize:"15px",display:"flex",alignItems:"center",gap:"8px"}}>🚨 Protocolo HIA</h3>
            <motion.button whileHover={{scale:1.1,rotate:90}} whileTap={{scale:0.9}} onClick={()=>setHiaModal(false)} style={{...ss.btn,background:"transparent",color:"var(--text-2)",padding:"2px 8px"}}>✕</motion.button>
          </div>
          <div style={{...ss.muted,fontSize:"11px",marginBottom:"10px"}}>Pasos a seguir cuando un jugador sale por sospecha de conmoción — todavía no hay seguimiento por jugador guardado en el sistema, es solo la referencia del protocolo.</div>
          {[{step:1,label:"Evaluación inicial en cancha",status:"pendiente",color:"#4A5568"},{step:2,label:"Evaluación médica post-partido",status:"pendiente",color:"#4A5568"},{step:3,label:"Clearance médico para volver",status:"pendiente",color:"#4A5568"}].map((s,i)=>(
            <motion.div key={s.step} initial={{opacity:0,x:-20}} animate={{opacity:1,x:0}} transition={{duration:0.3,delay:i*0.1}} style={{display:"flex",gap:"12px",alignItems:"center",padding:"12px",borderRadius:"var(--r-sm)",marginBottom:"8px",background:"var(--bg-elev-2)"}}>
              <div style={{width:"30px",height:"30px",borderRadius:"50%",background:`linear-gradient(135deg,${s.color},${s.color}dd)`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"13px",fontWeight:800,color:"#fff",boxShadow:`0 0 12px ${s.color}88`}}>{s.step}</div>
              <div style={{flex:1,fontSize:"13px"}}>{s.label}</div>
              <Badge color={s.color}>{s.status}</Badge>
            </motion.div>
          ))}
          <div style={{...ss.muted,fontSize:"11px",marginTop:"10px"}}>🔒 Jugador bloqueado de nóminas hasta completar paso 3</div>
        </motion.div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(110px,1fr))",gap:"12px",marginBottom:"20px"}}>
        {[["verde","Aptos","#22C55E"],["amarillo","Alerta","#F59E0B"],["rojo","No aptos","#EF4444"]].map(([k,l,c],i)=>(
          <div key={k} style={{...ss.card,cursor:"default"}}>
            <div style={ss.muted}>{l}</div>
            <div style={{fontSize:"26px",fontWeight:800,color:c,letterSpacing:"-0.02em",lineHeight:1.1}}>{players.filter(p=>p.med_status===k).length}</div>
            <div style={{...ss.muted,fontSize:"11px",marginTop:"4px"}}>{players.length?Math.round(players.filter(p=>p.med_status===k).length/players.length*100):0}% del plantel</div>
          </div>
        ))}
      </div>
      {players.filter(p=>p.med_status && p.med_status!=="verde").map((p,i)=>(
        <motion.div key={p.id} {...fadeUp} transition={{duration:0.3,delay:i*0.05}} style={{...ss.card,marginBottom:"10px",display:"flex",alignItems:"center",gap:"12px",border:`1px solid ${p.med_status==="rojo"?"rgba(239,68,68,0.3)":"rgba(245,158,11,0.3)"}`}}>
          <Semaforo status={p.med_status}/>
          <div style={{flex:1}}><div style={{fontSize:"13px",fontWeight:500}}>{p.name}</div><div style={{...ss.muted,fontSize:"11px"}}>{p.hia_reason||(p.med_status==="amarillo"?"Seguimiento preventivo":"No apto")}</div></div>
          <Badge color={p.med_status==="rojo"?"#EF4444":"#F59E0B"}>{p.med_status==="rojo"?"Bloqueado":"Alerta"}</Badge>
        </motion.div>
      ))}
      {/* El conteo de arriba dice cómo está el plantel hoy; el historial dice
          cómo llegó hasta acá, que es lo que anticipa una lesión. */}
      <PanelLesiones clubId={clubId} players={players} currentUserId={currentUserId} showToast={showToast}/>
    </div>
  );

  return null;
}
