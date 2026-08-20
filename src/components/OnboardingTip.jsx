import { useState, useEffect } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";

const TIPS_BY_ROLE = {
  admin: [
    { icon:"👋", title:"¡Bienvenido, Admin!", desc:"Gestiona tu club desde aquí. Te mostramos los módulos clave en 3 pasos." },
    { icon:"👥", title:"Primero: tu plantel", desc:"Ve a Jugadores → agrega los integrantes del club. Podrás invitarlos por link después.", module:"jugadores" },
    { icon:"💰", title:"Finanzas del club", desc:"En Finanzas verás quién pagó y quién no. Puedes cobrar la cuota masivamente con un click.", module:"finanzas" },
    { icon:"✉️", title:"Invita a tu equipo", desc:"En Mi Club → Invitaciones genera links únicos por rol: entrenador, preparador y jugador.", module:"miclub", last:true },
  ],
  entrenador: [
    { icon:"👋", title:"¡Hola, Entrenador!", desc:"Tu centro de operaciones está listo. 3 cosas para empezar." },
    { icon:"💬", title:"El Muro — empieza aquí", desc:"Publica resultados, da insignias y lanza retos al equipo. Los jugadores reaccionan en tiempo real.", module:"muro" },
    { icon:"✅", title:"Asistencia con un toque", desc:"Cada jugador es un botón. Tócalo para marcarlo presente. Se guarda automáticamente con la fecha.", module:"asistencia" },
    { icon:"🏆", title:"Match Center", desc:"Arma la nómina arrastrando jugadores a la cancha y compártela por WhatsApp antes del partido.", module:"matchcenter", last:true },
  ],
  preparador: [
    { icon:"👋", title:"¡Hola, Preparador!", desc:"Tu espacio para la preparación física. 2 módulos clave." },
    { icon:"📅", title:"Microciclo semanal", desc:"Publica el plan de entrenamiento de la semana. Los jugadores lo ven desde su celular.", module:"microciclo" },
    { icon:"💪", title:"Ranking de fuerza", desc:"Registra los pesos de cada jugador. El ranking se actualiza automáticamente y los motiva.", module:"rankingfuerza", last:true },
  ],
  jugador: [
    { icon:"👋", title:"¡Hola, Jugador!", desc:"Todo lo que necesitas en un lugar. 3 secciones importantes." },
    { icon:"📊", title:"Tu Dashboard", desc:"Ves tus estadísticas personales, tu estado de salud y si estás convocado para el próximo partido.", module:"midashboard" },
    { icon:"💳", title:"Tu cuota", desc:"Revisa si tu cuota está al día. Puedes pagar directamente desde la app.", module:"micuota" },
    { icon:"💪", title:"Mi Gym", desc:"El preparador publica el plan de entrenamiento aquí. Registra tus pesos y sube en el ranking.", module:"migym", last:true },
  ],
  superadmin: [
    { icon:"⚡", title:"Super Admin", desc:"Tienes visión global de todos los clubes. Revisa el dashboard de comisiones y la comparativa.", last:true },
  ],
};

export default function OnboardingTip({ sportColor="#22C55E", role="entrenador", userKey="demo", onboardingDone=false, userId=null, onNavigate }) {
  const [visible, setVisible] = useState(false);
  const [step, setStep]       = useState(0);

  const TIPS = TIPS_BY_ROLE[role] || TIPS_BY_ROLE.entrenador;

  useEffect(() => {
    setStep(0);
    // Solo mostrar para usuarios reales que nunca completaron el onboarding
    if (!userKey || userKey === "demo") return;
    if (onboardingDone) return;
    const localDone = localStorage.getItem(`sportos_onboarding_${userKey}`);
    if (localDone) return;
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, [userKey, onboardingDone]);

  const dismiss = async () => {
    setVisible(false);
    // Guardar en localStorage (respaldo instantáneo)
    localStorage.setItem(`sportos_onboarding_${userKey}`, "1");
    // Guardar en Supabase para que no vuelva a aparecer en ningún dispositivo.
    // Si falla no se avisa a propósito: el localStorage de arriba ya lo ocultó
    // en este equipo, y molestar con un error por un cartel de bienvenida es
    // peor que el problema. Queda en consola por si alguien lo persigue.
    if (userId) {
      const { error } = await supabase.from("profiles")
        .update({ onboarding_done: true }).eq("id", userId);
      if (error) console.warn("[onboarding] no se pudo marcar como visto:", error.message);
    }
  };

  const next = () => {
    const tip = TIPS[step];
    if (tip.module && onNavigate) onNavigate(tip.module);
    if (tip.last || step >= TIPS.length - 1) { dismiss(); return; }
    setStep(s => s + 1);
  };

  return (
    <AnimatePresence>
      {visible && (
        <>
          <motion.div initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
            style={{position:"fixed",inset:0,zIndex:180,pointerEvents:"none",background:"rgba(0,0,0,0.25)"}}/>

          <motion.div
            initial={{opacity:0,scale:0.85,y:20}}
            animate={{opacity:1,scale:1,y:0}}
            exit={{opacity:0,scale:0.85,y:20}}
            transition={{type:"spring",stiffness:260,damping:24}}
            style={{position:"fixed",bottom:"clamp(80px,12vh,120px)",right:"clamp(12px,4vw,32px)",zIndex:190,maxWidth:"300px",width:"calc(100vw - 24px)",background:"var(--bg-glass-strong)",backdropFilter:"blur(28px)",WebkitBackdropFilter:"blur(28px)",borderRadius:"var(--r-xl)",border:`1px solid ${sportColor}44`,boxShadow:`0 16px 40px rgba(0,0,0,0.5),0 0 0 1px ${sportColor}22`,overflow:"hidden"}}>

            {/* Barra de pasos */}
            <div style={{display:"flex",gap:"4px",padding:"12px 16px 0"}}>
              {TIPS.map((_,i)=>(
                <div key={i} style={{flex:1,height:"3px",borderRadius:"2px",background:i<=step?sportColor:"var(--bg-elev-3)",transition:"background 0.3s"}}/>
              ))}
            </div>

            <div style={{padding:"16px"}}>
              <AnimatePresence mode="wait">
                <motion.div key={step} initial={{opacity:0,x:16}} animate={{opacity:1,x:0}} exit={{opacity:0,x:-16}} transition={{duration:0.2}}>
                  <div style={{fontSize:"32px",marginBottom:"10px"}}>{TIPS[step].icon}</div>
                  <div style={{fontWeight:700,fontSize:"14px",marginBottom:"6px",color:"var(--text-1)"}}>{TIPS[step].title}</div>
                  <div style={{fontSize:"12px",color:"var(--text-2)",lineHeight:1.6,marginBottom:"16px"}}>{TIPS[step].desc}</div>
                  {TIPS[step].module && (
                    <div style={{fontSize:"10px",color:sportColor,fontWeight:600,marginBottom:"12px",display:"flex",alignItems:"center",gap:"4px"}}>
                      <span style={{width:"6px",height:"6px",borderRadius:"50%",background:sportColor,animation:"pulse-soft 2s infinite"}}/>
                      Ir al módulo →
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div style={{display:"flex",gap:"8px",alignItems:"center"}}>
                <button onClick={dismiss}
                  style={{background:"transparent",border:"none",color:"var(--text-4)",fontSize:"11px",cursor:"pointer",padding:"4px",flexShrink:0}}>
                  Saltar
                </button>
                <motion.button whileHover={{scale:1.03}} whileTap={{scale:0.97}} onClick={next}
                  style={{flex:1,padding:"9px 16px",borderRadius:"var(--r-sm)",background:`linear-gradient(135deg,${sportColor},${sportColor}cc)`,color:"#fff",border:"none",cursor:"pointer",fontSize:"12px",fontWeight:700,boxShadow:`0 4px 14px ${sportColor}44`}}>
                  {step < TIPS.length - 1 ? "Siguiente →" : "¡Empezar! ✓"}
                </motion.button>
              </div>

              {/* Contador de pasos */}
              <div style={{textAlign:"center",marginTop:"10px",fontSize:"10px",color:"var(--text-4)"}}>
                {step+1} de {TIPS.length}
              </div>
            </div>

            {/* Flecha decorativa */}
            <div style={{position:"absolute",bottom:"-8px",right:"28px",width:"16px",height:"16px",background:"var(--bg-glass-strong)",border:`1px solid ${sportColor}44`,borderTop:"none",borderLeft:"none",transform:"rotate(45deg)",borderRadius:"2px"}}/>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
