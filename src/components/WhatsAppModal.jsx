import { useState } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { fadeIn, scaleIn } from "../styles/motion";
import { ss } from "../styles/tokens";

export default function WhatsAppModal({onClose, team, rival, date, hora, lugar, starters, bench}) {
  const cuando = [date, hora ? `⏰ ${hora}` : null, lugar ? `📍 ${lugar}` : null].filter(Boolean).join(" ");
  const msg = `✅ ${team} — Nómina vs ${rival}\n📅 ${cuando}\n\nTITULARES:\n${starters.map((p,i)=>`${i+1}. ${p.name} (${p.pos})`).join("\n")}\n\nBANCO:\n${bench.map((p,i)=>`${starters.length+i+1}. ${p.name}`).join("\n")}\n\n_Confirma tu presencia en SportOS_`;
  const [copied, setCopied] = useState(false);
  return (
    <AnimatePresence>
      <motion.div {...fadeIn} onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.7)",backdropFilter:"blur(8px)",WebkitBackdropFilter:"blur(8px)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
        <motion.div {...scaleIn} onClick={e=>e.stopPropagation()} style={{...ss.card,width:"100%",maxWidth:"420px",maxHeight:"80vh",overflow:"auto",boxShadow:"var(--shadow-lg)"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"16px"}}>
            <h3 style={{margin:0,fontSize:"15px",display:"flex",alignItems:"center",gap:"8px"}}>📱 Mensaje WhatsApp</h3>
            <motion.button whileHover={{scale:1.1,rotate:90}} whileTap={{scale:0.9}} onClick={onClose} style={{...ss.btn,background:"transparent",color:"var(--text-2)",padding:"4px 8px",fontSize:"16px"}}>✕</motion.button>
          </div>
          <pre style={{background:"var(--bg-elev-1)",padding:"14px",borderRadius:"var(--r-md)",fontSize:"12px",color:"var(--text-1)",whiteSpace:"pre-wrap",border:"1px solid var(--border-soft)",maxHeight:"320px",overflow:"auto",fontFamily:"inherit",lineHeight:1.6}}>{msg}</pre>
          <motion.button whileHover={{scale:1.02}} whileTap={{scale:0.98}}
            onClick={()=>{navigator.clipboard.writeText(msg).catch(()=>{});setCopied(true);setTimeout(()=>setCopied(false),2000);}}
            style={{...ss.btn,background:"linear-gradient(135deg,#25D366,#128C7E)",color:"#fff",width:"100%",marginTop:"14px",padding:"12px",fontSize:"13px",boxShadow:"0 4px 16px rgba(37,211,102,0.4)"}}>
            {copied?"✅ Copiado!":"📋 Copiar mensaje"}
          </motion.button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
