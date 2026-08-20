import { m as motion } from "framer-motion";
import { ss } from "../styles/tokens";

export default function EmptyState({ icon="📭", title, desc, action, actionLabel, color="#A855F7" }) {
  return (
    <motion.div
      initial={{opacity:0, y:16}} animate={{opacity:1, y:0}} transition={{duration:0.4}}
      style={{textAlign:"center", padding:"48px 24px", display:"flex", flexDirection:"column", alignItems:"center", gap:"12px"}}>
      <motion.div
        initial={{scale:0.5, opacity:0}} animate={{scale:1, opacity:1}} transition={{delay:0.1, type:"spring", stiffness:200}}
        style={{fontSize:"48px", lineHeight:1, filter:`drop-shadow(0 0 16px ${color}44)`}}>
        {icon}
      </motion.div>
      <div style={{fontWeight:700, fontSize:"16px", color:"var(--text-1)"}}>{title}</div>
      {desc && <div style={{fontSize:"13px", color:"var(--text-3)", maxWidth:"260px", lineHeight:1.6}}>{desc}</div>}
      {action && (
        <motion.button whileHover={{scale:1.05, y:-2}} whileTap={{scale:0.97}} onClick={action}
          style={{...ss.btn, marginTop:"8px", background:`linear-gradient(135deg,${color},${color}cc)`, color:"#fff", fontSize:"13px", padding:"10px 22px", boxShadow:`0 6px 20px ${color}33`, fontWeight:700}}>
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
