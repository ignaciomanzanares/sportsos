import { useState } from "react";
import { m as motion, AnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import AuroraBg from "../components/AuroraBg";
import { ss } from "../styles/tokens";
import { scaleIn } from "../styles/motion";

export default function NewPasswordScreen({ onSuccess }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [done, setDone]         = useState(false);

  const handleSubmit = async () => {
    if (!password)              { setError("Escribe tu nueva contraseña"); return; }
    if (password.length < 6)    { setError("La contraseña debe tener al menos 6 caracteres"); return; }
    if (password !== confirm)   { setError("Las contraseñas no coinciden"); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError("Error: " + err.message); return; }
    setDone(true);
    setTimeout(onSuccess, 2000);
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",position:"relative",padding:"16px"}}>
      <AuroraBg/>
      <motion.div {...scaleIn} style={{...ss.card,padding:"32px 28px",maxWidth:"400px",width:"100%",position:"relative",zIndex:1}}>
        {done ? (
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{fontSize:"40px",marginBottom:"12px"}}>✅</div>
            <div style={{fontWeight:800,fontSize:"18px",marginBottom:"8px"}}>¡Contraseña actualizada!</div>
            <div style={{fontSize:"12px",color:"var(--text-3)"}}>Redirigiendo al inicio de sesión...</div>
          </div>
        ) : (
          <>
            <div style={{textAlign:"center",marginBottom:"24px"}}>
              <div style={{fontSize:"36px",marginBottom:"8px"}}>🔑</div>
              <div style={{fontWeight:800,fontSize:"18px",marginBottom:"4px"}}>Nueva contraseña</div>
              <div style={{fontSize:"12px",color:"var(--text-3)"}}>Elige una contraseña segura para tu cuenta</div>
            </div>

            <div style={{marginBottom:"14px"}}>
              <div style={ss.label}>Nueva contraseña</div>
              <input type="password" value={password} onChange={e=>{setPassword(e.target.value);setError("");}}
                placeholder="Mínimo 6 caracteres" autoFocus
                onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}}
                style={{...ss.input,borderColor:error?"#C0392B":"var(--border-soft)"}}/>
            </div>

            <div style={{marginBottom:"20px"}}>
              <div style={ss.label}>Confirmar contraseña</div>
              <input type="password" value={confirm} onChange={e=>{setConfirm(e.target.value);setError("");}}
                placeholder="Repite tu contraseña"
                onKeyDown={e=>{if(e.key==="Enter")handleSubmit();}}
                style={{...ss.input,borderColor:error?"#C0392B":"var(--border-soft)"}}/>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div initial={{opacity:0,y:-6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                  style={{fontSize:"12px",color:"#C0392B",marginBottom:"14px",padding:"8px 12px",borderRadius:"var(--r-sm)",background:"rgba(192,57,43,0.08)",border:"1px solid rgba(192,57,43,0.25)"}}>
                  ⚠️ {error}
                </motion.div>
              )}
            </AnimatePresence>

            <motion.button whileHover={!loading?{scale:1.02,y:-2}:{}} whileTap={!loading?{scale:0.98}:{}}
              onClick={handleSubmit} disabled={loading}
              style={{...ss.btn,width:"100%",padding:"13px",fontSize:"14px",fontWeight:700,background:loading?"rgba(255,255,255,0.06)":"linear-gradient(135deg,#C0392B,#9B2335)",color:loading?"var(--text-3)":"#fff",boxShadow:loading?"none":"0 8px 24px rgba(192,57,43,0.4)",cursor:loading?"not-allowed":"pointer"}}>
              {loading?"⏳ Guardando...":"Guardar nueva contraseña →"}
            </motion.button>
          </>
        )}
      </motion.div>
    </div>
  );
}
