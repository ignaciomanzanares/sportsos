import { m as motion } from "framer-motion";

export default function BackButton({ onClick, label = "Volver", style = {} }) {
  return (
    <motion.button
      whileHover={{ x: -3, scale: 1.04 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      style={{
        display: "inline-flex", alignItems: "center", gap: "6px",
        background: "rgba(255,255,255,0.05)", border: "1px solid var(--border-soft)",
        color: "var(--text-3)", borderRadius: "99px",
        padding: "6px 14px", fontSize: "12px", fontWeight: 600,
        cursor: "pointer", backdropFilter: "blur(8px)",
        transition: "all 0.2s", ...style,
      }}>
      ← {label}
    </motion.button>
  );
}
