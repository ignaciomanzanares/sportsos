import { Component } from "react";

/**
 * Red de seguridad contra la pantalla en negro.
 *
 * Cuando un error de JavaScript escapa durante el render, React desmonta el
 * árbol entero y deja el <div id="root"> vacío: el usuario ve una pantalla
 * negra, sin texto, sin botón, sin forma de salir. Ya pasó dos veces en
 * producción (una variable fuera de alcance, un `const` leído antes de
 * declararse), y las dos veces el club quedó sin app hasta el siguiente
 * deploy.
 *
 * Esto no arregla el error — lo contiene. Muestra qué pasó, ofrece recargar
 * y deja el detalle a mano para poder copiarlo y mandarlo.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // Queda en la consola del navegador: es lo único que se puede pedir por
    // WhatsApp ("mandame una captura de la consola") sin tener un servicio
    // de reporte de errores contratado.
    console.error("[SportOS] error no controlado:", error, info?.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    const detalle = `${this.state.error?.message || this.state.error}`;
    return (
      <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
                   padding:"24px",background:"#040812",color:"#fff",
                   fontFamily:"Inter, system-ui, sans-serif"}}>
        <div style={{maxWidth:"420px",width:"100%",textAlign:"center"}}>
          <div style={{fontSize:"40px",marginBottom:"12px"}}>😵</div>
          <h1 style={{fontSize:"20px",fontWeight:800,margin:"0 0 8px"}}>Se nos cayó la pantalla</h1>
          <p style={{fontSize:"14px",lineHeight:1.5,color:"rgba(255,255,255,0.6)",margin:"0 0 20px"}}>
            No es tu conexión ni algo que hayas hecho mal. Recargá y debería volver;
            si sigue pasando, mandanos el detalle de acá abajo.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{width:"100%",padding:"13px",borderRadius:"12px",border:"none",
                    background:"#22C55E",color:"#04120A",fontSize:"15px",fontWeight:700,
                    cursor:"pointer",marginBottom:"10px"}}>
            Recargar la app
          </button>
          <button
            onClick={() => { try { window.location.href = "/"; } catch { /* nada que hacer */ } }}
            style={{width:"100%",padding:"13px",borderRadius:"12px",
                    border:"1px solid rgba(255,255,255,0.15)",background:"transparent",
                    color:"rgba(255,255,255,0.75)",fontSize:"14px",fontWeight:600,
                    cursor:"pointer"}}>
            Volver al inicio
          </button>
          <pre style={{marginTop:"20px",padding:"12px",borderRadius:"10px",
                       background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.45)",
                       fontSize:"11px",textAlign:"left",whiteSpace:"pre-wrap",
                       wordBreak:"break-word",maxHeight:"140px",overflow:"auto"}}>{detalle}</pre>
        </div>
      </div>
    );
  }
}
