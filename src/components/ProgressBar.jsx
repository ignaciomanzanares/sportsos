import { m as motion } from "framer-motion";

export default function ProgressBar({value, max, color, height=6, animated=true}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div style={{background:"rgba(255,255,255,0.06)",borderRadius:"99px",height,overflow:"hidden",position:"relative"}}>
      <motion.div
        initial={{width:0}}
        animate={{width:`${pct}%`}}
        transition={{duration:animated?0.9:0,ease:[0.16,1,0.3,1]}}
        style={{height:"100%",background:`linear-gradient(90deg,${color},${color}dd)`,borderRadius:"99px",boxShadow:`0 0 12px ${color}88`,position:"relative"}}
      >
        <div style={{position:"absolute",inset:0,background:"linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent)",backgroundSize:"200% 100%",animation:"shimmer 2.5s linear infinite",borderRadius:"99px"}}/>
      </motion.div>
    </div>
  );
}
