import { m as motion, AnimatePresence } from "framer-motion";
import { ss } from "../styles/tokens";
import { PLANS, UPGRADE_TEXT } from "../lib/freemium";

const PLAN_FEATURES = {
  pro: [
    "Match Center — nómina táctica",
    "Wellness y Estado del plantel",
    "Microciclo semanal",
    "Ranking de fuerza",
    "Plantel ilimitado de jugadores",
    "Estadísticas y salud",
  ],
  elite: [
    "Todo lo del plan Pro",
    "Finanzas del club y cuotas",
    "Importar partido desde URL",
    "Próximamente: SportOS Cam (visión IA)",
    "Soporte prioritario",
  ],
};

export default function UpgradeModal({ requiredPlan, onClose }) {
  if (!requiredPlan) return null;
  const plan = PLANS[requiredPlan];
  const text = UPGRADE_TEXT[requiredPlan];
  const features = PLAN_FEATURES[requiredPlan] || [];

  return (
    <AnimatePresence>
      <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
        onClick={e=>e.target===e.currentTarget&&onClose()}
        style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"16px"}}>

        <motion.div initial={{opacity:0,y:28,scale:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:28,scale:0.95}}
          transition={{type:"spring",stiffness:280,damping:26}}
          style={{background:"var(--bg-glass-strong)",backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",border:`1px solid ${plan.color}44`,borderRadius:"var(--r-xl)",padding:"32px 28px",maxWidth:"420px",width:"100%",boxShadow:`var(--shadow-lg),0 0 0 1px ${plan.color}22`}}>

          {/* Header */}
          <div style={{textAlign:"center",marginBottom:"24px"}}>
            <div style={{width:"60px",height:"60px",borderRadius:"50%",background:`${plan.color}18`,border:`2px solid ${plan.color}55`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"26px",margin:"0 auto 14px",boxShadow:`0 0 28px ${plan.color}44`}}>
              {plan.icon}
            </div>
            <div style={{fontWeight:800,fontSize:"18px",marginBottom:"4px"}}>{text.title}</div>
            <div style={{fontSize:"12px",color:"var(--text-3)",lineHeight:1.6}}>{text.desc}</div>
          </div>

          {/* Precio */}
          <div style={{textAlign:"center",marginBottom:"20px",padding:"16px",borderRadius:"var(--r-lg)",background:`${plan.color}0A`,border:`1px solid ${plan.color}22`}}>
            <div style={{fontSize:"11px",color:"var(--text-3)",textTransform:"uppercase",letterSpacing:"0.08em",fontWeight:600,marginBottom:"4px"}}>Plan {plan.label}</div>
            <div style={{fontSize:"32px",fontWeight:900,color:plan.color,letterSpacing:"-0.02em"}}>
              ${plan.price} <span style={{fontSize:"13px",fontWeight:400,color:"var(--text-3)"}}>USD/mes</span>
            </div>
          </div>

          {/* Features incluidas */}
          <div style={{marginBottom:"24px"}}>
            <div style={{fontSize:"10px",color:"var(--text-3)",fontWeight:700,textTransform:"uppercase",letterSpacing:"0.08em",marginBottom:"10px"}}>Incluye</div>
            <div style={{display:"flex",flexDirection:"column",gap:"8px"}}>
              {features.map((f,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:"10px",fontSize:"12px",color:"var(--text-2)"}}>
                  <span style={{color:plan.color,flexShrink:0,fontSize:"14px"}}>✓</span>
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* CTAs */}
          <motion.button whileHover={{scale:1.02,y:-2}} whileTap={{scale:0.97}}
            style={{...ss.btn,width:"100%",padding:"14px",fontSize:"14px",fontWeight:700,background:`linear-gradient(135deg,${plan.color},${plan.color}cc)`,color:"#fff",marginBottom:"10px",boxShadow:`0 6px 20px ${plan.color}44`}}>
            {text.cta}
          </motion.button>
          <motion.button whileHover={{scale:1.01}} whileTap={{scale:0.98}} onClick={onClose}
            style={{...ss.btn,width:"100%",padding:"10px",fontSize:"12px",background:"transparent",color:"var(--text-3)",border:"1px solid var(--border-soft)"}}>
            Volver — seguir en Free
          </motion.button>

          <div style={{textAlign:"center",marginTop:"12px",fontSize:"10px",color:"var(--text-4)"}}>
            Cancela cuando quieras · Sin contratos
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
