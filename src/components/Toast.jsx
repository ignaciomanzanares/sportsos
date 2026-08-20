import { useEffect, useState } from "react";
import { m as motion } from "framer-motion";

// Toast normal
export default function Toast({msg, type, onClose, onUndo, undoLabel="Deshacer"}) {
  const [progress, setProgress] = useState(100);
  const duration = onUndo ? 5000 : 3200;

  useEffect(() => {
    const t = setTimeout(onClose, duration);
    // barra de progreso
    const start = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      setProgress(Math.max(0, 100 - (elapsed / duration) * 100));
    }, 50);
    return () => { clearTimeout(t); clearInterval(interval); };
  }, []);

  const colors = {
    success: "linear-gradient(135deg,#22C55E,#16A34A)",
    warning: "linear-gradient(135deg,#F59E0B,#D97706)",
    error:   "linear-gradient(135deg,#EF4444,#DC2626)",
    info:    "linear-gradient(135deg,#3B82F6,#2563EB)",
  };
  const icons = {success:"✓", warning:"⚠", error:"✕", info:"ℹ"};

  return (
    <motion.div
      initial={{opacity:0, x:120, scale:0.9}}
      animate={{opacity:1, x:0, scale:1}}
      exit={{opacity:0, x:120, scale:0.9}}
      transition={{type:"spring", stiffness:300, damping:28}}
      style={{position:"fixed",top:"80px",right:"20px",background:colors[type]||colors.success,color:"#fff",borderRadius:"var(--r-md)",zIndex:9999,boxShadow:"var(--shadow-lg)",maxWidth:"340px",border:"1px solid rgba(255,255,255,0.15)",overflow:"hidden",minWidth:"240px"}}>
      <div style={{padding:"12px 14px",display:"flex",alignItems:"center",gap:"10px"}}>
        <span style={{width:"22px",height:"22px",borderRadius:"50%",background:"rgba(255,255,255,0.25)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"12px",flexShrink:0,fontWeight:800}}>
          {icons[type]||icons.info}
        </span>
        <span style={{fontWeight:600,fontSize:"13px",lineHeight:1.35,flex:1}}>{msg}</span>
        {onUndo && (
          <motion.button whileHover={{scale:1.05}} whileTap={{scale:0.95}}
            onClick={()=>{ onUndo(); onClose(); }}
            style={{background:"rgba(255,255,255,0.25)",border:"1px solid rgba(255,255,255,0.35)",color:"#fff",borderRadius:"6px",padding:"4px 10px",fontSize:"11px",fontWeight:700,cursor:"pointer",flexShrink:0}}>
            {undoLabel}
          </motion.button>
        )}
        <motion.button whileHover={{scale:1.1}} whileTap={{scale:0.9}} onClick={onClose}
          style={{background:"transparent",border:"none",color:"rgba(255,255,255,0.7)",cursor:"pointer",fontSize:"14px",flexShrink:0,padding:"0 2px",lineHeight:1}}>
          ✕
        </motion.button>
      </div>
      {/* Barra de progreso */}
      <div style={{height:"3px",background:"rgba(255,255,255,0.15)"}}>
        <motion.div style={{height:"100%",background:"rgba(255,255,255,0.5)",width:`${progress}%`,transition:"width 0.05s linear"}}/>
      </div>
    </motion.div>
  );
}
