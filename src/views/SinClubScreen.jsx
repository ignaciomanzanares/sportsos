import { motion } from "framer-motion";
import AuroraBg from "../components/AuroraBg";
import { ss } from "../styles/tokens";

/**
 * Cuenta real que quedó sin club_id.
 *
 * Antes estos usuarios entraban igual a la app y veían la vitrina de demo
 * (club TOROS RC, 16 jugadores inventados, finanzas falsas) como si fueran
 * sus datos. Preferimos decirles la verdad y ofrecerles la salida según su
 * rol: el admin crea su club, el resto pide unirse con el código.
 */
export default function SinClubScreen({ usuario, esAdmin, onCrearClub, onUnirme, onSalir }) {
  return (
    <div style={{ position:"relative", minHeight:"100vh", display:"flex", alignItems:"center",
      justifyContent:"center", padding:"24px 16px" }}>
      <AuroraBg/>
      <motion.div initial={{ opacity:0, y:24 }} animate={{ opacity:1, y:0 }}
        style={{ position:"relative", zIndex:2, width:"100%", maxWidth:"420px" }}>

        <div style={{ textAlign:"center", marginBottom:"24px" }}>
          <div style={{ fontSize:"52px", marginBottom:"12px" }}>🏟️</div>
          <div style={{ fontWeight:900, fontSize:"24px", letterSpacing:"-0.03em", marginBottom:"8px" }}>
            Tu cuenta todavía no tiene club
          </div>
          <div style={{ fontSize:"13px", color:"var(--text-3)" }}>
            {usuario?.email ? `Entraste como ${usuario.email}. ` : ""}
            No hay ningún club asociado a esta cuenta, así que no tenemos datos que mostrarte.
          </div>
        </div>

        <div style={ss.card}>
          {esAdmin ? (
            <>
              <div style={{ fontSize:"13px", color:"var(--text-2)", marginBottom:"16px", lineHeight:1.5 }}>
                Crea tu club para empezar. Vas a partir con el plantel vacío: agregas
                a tus jugadores y desde ahí funcionan las invitaciones, las cuotas y
                las estadísticas.
              </div>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                onClick={onCrearClub}
                style={{ ...ss.btn, width:"100%", padding:"14px", fontWeight:700, fontSize:"14px",
                  background:"linear-gradient(135deg,#3B82F6,#2563EB)", color:"#fff",
                  boxShadow:"0 6px 20px rgba(59,130,246,0.4)" }}>
                Crear mi club →
              </motion.button>
            </>
          ) : (
            <>
              <div style={{ fontSize:"13px", color:"var(--text-2)", marginBottom:"16px", lineHeight:1.5 }}>
                Pídele el código a tu administrador o entrenador y únete a tu club.
                Si ya mandaste la solicitud, espera a que la aprueben.
              </div>
              <motion.button whileHover={{ scale:1.02 }} whileTap={{ scale:0.98 }}
                onClick={onUnirme}
                style={{ ...ss.btn, width:"100%", padding:"14px", fontWeight:700, fontSize:"14px",
                  background:"linear-gradient(135deg,#3B82F6,#2563EB)", color:"#fff",
                  boxShadow:"0 6px 20px rgba(59,130,246,0.4)" }}>
                Unirme con un código →
              </motion.button>
            </>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:"14px" }}>
          <button onClick={onSalir}
            style={{ background:"none", border:"none", color:"var(--text-4)", fontSize:"12px",
              cursor:"pointer", textDecoration:"underline" }}>
            Cerrar sesión
          </button>
        </div>
      </motion.div>
    </div>
  );
}
