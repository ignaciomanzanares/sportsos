import { m as motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";
import Badge from "./Badge";
import FieldMarkings from "./FieldMarkings";
import Token from "./Token";

export default function Cancha({type, formation, lineup, sportColor, onDrop, onSlotClick, dragging, highlightId}) {
  const filled = lineup.filter(Boolean).length;
  return (
    <motion.div {...fadeUp} style={ss.card}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"12px"}}>
        <div style={{fontWeight:600,fontSize:"13px",display:"flex",alignItems:"center",gap:"6px"}}>🏟️ {formation.label}</div>
        <Badge color={sportColor} glow>{filled}/{formation.positions.length}</Badge>
      </div>
      <div style={{display:"flex",justifyContent:"center"}}>
        <div style={{position:"relative",width:"100%",maxWidth:"380px",aspectRatio:"100 / 140"}}>
          <svg viewBox="0 0 100 140" preserveAspectRatio="none" style={{position:"absolute",inset:0,width:"100%",height:"100%",filter:`drop-shadow(0 0 24px ${sportColor}22)`}}>
            <FieldMarkings type={type} color={sportColor}/>
          </svg>
          {formation.coords.map((c,i)=>(
            <Token key={i} x={c.x} y={c.y} num={i+1} player={lineup[i]} pos={formation.positions[i]}
              color={sportColor} dragging={dragging}
              mine={highlightId && lineup[i] && lineup[i].id===highlightId}
              onDrop={()=>onDrop(i)} onClick={()=>onSlotClick(i)}/>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
