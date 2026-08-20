import { m as motion } from "framer-motion";
import { fadeUp } from "../styles/motion";
import { ss } from "../styles/tokens";

export default function SectionTitle({title, sub, action}) {
  return (
    <motion.div {...fadeUp} style={ss.sectionTitle}>
      <div>
        <h2 style={{margin:0,fontSize:"22px",fontWeight:700,letterSpacing:"-0.02em"}}>{title}</h2>
        {sub&&<p style={{...ss.muted,margin:"6px 0 0",fontSize:"13px"}}>{sub}</p>}
      </div>
      {action}
    </motion.div>
  );
}
