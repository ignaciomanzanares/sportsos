import { m as motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";

export default function Stat({label, value, sub, color, icon, delay=0}) {
  return (
    <motion.div {...fadeUp} transition={{duration:0.5,delay,ease:[0.16,1,0.3,1]}}
      whileHover={{y:-3,transition:{duration:0.2}}}
      style={{...ss.card,cursor:"default"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:"6px"}}>
        <div style={ss.muted}>{label}</div>
        {icon&&<div style={{fontSize:"18px",opacity:0.7}}>{icon}</div>}
      </div>
      <div style={{fontSize:"26px",fontWeight:800,color:color||"var(--text-1)",letterSpacing:"-0.02em",lineHeight:1.1}}>{value}</div>
      {sub&&<div style={{...ss.muted,fontSize:"11px",marginTop:"4px"}}>{sub}</div>}
      <div style={{position:"absolute",top:0,right:0,width:"80px",height:"80px",background:`radial-gradient(circle at top right, ${color||"#6E5BFF"}15, transparent 70%)`,pointerEvents:"none"}}/>
    </motion.div>
  );
}
