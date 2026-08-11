import { motion } from "framer-motion";

/**
 * Nombres cortos para la cancha.
 *
 * El puesto completo no cabe bajo una ficha de 34px: "Outside Centre" salía
 * como "Outside Ce…" y "Blindside Flanker" como "Blindside F…", que no
 * distingue nada porque el otro flanker empieza igual. Los abreviados son los
 * que se usan al hablar.
 */
const CORTO = {
  "loosehead prop":"Pilar izq.", "tighthead prop":"Pilar der.", "hooker":"Hooker",
  "lock":"Segunda", "blindside flanker":"Ala ciego", "openside flanker":"Ala abierto",
  "number 8":"N.º 8", "scrum-half":"Medio scrum", "fly-half":"Apertura",
  "inside centre":"Centro 12", "outside centre":"Centro 13",
  "left wing":"Wing izq.", "right wing":"Wing der.", "fullback":"Fullback",
};

export default function Token({x, y, num, player, pos, color, onDrop, onClick, dragging, mine}) {
  const filled = !!player;
  const puesto = CORTO[String(pos||"").toLowerCase()] || pos;
  const etiqueta = player ? player.name.split(" ").slice(-1)[0] : puesto;
  const hasPhoto = filled && !!player.avatar_url;
  const borderEmpty = dragging ? `2px dashed ${color}` : "1.5px dashed rgba(255,255,255,0.35)";
  const circleBorder = filled ? (mine ? "2px solid #F59E0B" : `2px solid ${color}`) : borderEmpty;
  const circleShadow = filled
    ? (mine ? "0 0 0 2px #F59E0B66, 0 0 16px #F59E0B99, 0 4px 12px rgba(0,0,0,0.4)" : `0 0 0 1px ${color}33, 0 4px 12px ${color}55`)
    : "none";
  return (
    <motion.div
      initial={{scale:0,opacity:0}} animate={{scale:1,opacity:1}}
      transition={{type:"spring",stiffness:300,damping:18}}
      onDragOver={onDrop ? e=>e.preventDefault() : undefined}
      onDrop={onDrop ? e=>{e.preventDefault();onDrop();} : undefined}
      onClick={onClick}
      whileHover={onClick?{scale:1.12,transition:{duration:0.15}}:{}}
      whileTap={onClick?{scale:0.95}:{}}
      style={{position:"absolute",left:`${x}%`,top:`${y}%`,transform:"translate(-50%,-50%)",textAlign:"center",width:"66px",zIndex:mine?3:2,cursor:onClick?"pointer":"default"}}
    >
      <div style={{width:"34px",height:"34px",borderRadius:"50%",margin:"0 auto",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",fontWeight:700,background:hasPhoto?"transparent":(filled?(mine?"#F59E0B":color):(dragging?color+"33":"rgba(0,0,0,0.45)")),color:filled?"#fff":"rgba(255,255,255,0.85)",border:circleBorder,boxShadow:circleShadow,transition:"all 0.2s var(--ease-out)",overflow:"hidden",position:"relative"}}>
        {hasPhoto
          ? <img src={player.avatar_url} alt={etiqueta} style={{width:"100%",height:"100%",objectFit:"cover",borderRadius:"50%"}}/>
          : num
        }
      </div>
      {/* El puesto iba en var(--text-4) a 8px sobre el verde de la cancha: no
          se leía. Va sobre una pastilla oscura, que es lo único que funciona
          encima de un fondo con dibujo. */}
      <div style={{display:"inline-block",marginTop:"4px",maxWidth:"100%",padding:"1px 5px",borderRadius:"4px",
        background:"rgba(0,0,0,0.55)",
        fontSize:"9px",lineHeight:1.25,fontWeight:filled?700:500,
        color:filled?(mine?"#FBBF24":"#FFFFFF"):"rgba(255,255,255,0.78)",
        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
        textShadow:"0 1px 2px rgba(0,0,0,0.8)"}}>
        {etiqueta}{mine?" ⭐":""}
      </div>
    </motion.div>
  );
}
