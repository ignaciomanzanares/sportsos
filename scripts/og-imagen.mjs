// Genera public/og.png (1200×630), la imagen que se ve cuando alguien pega el
// link en WhatsApp, Twitter o LinkedIn.
//
// Se dibuja con el mismo navegador headless que usa caps-pdf.mjs, así no entra
// ninguna librería de imágenes al proyecto. Los colores y las tipografías son
// los de la landing, para que la tarjeta y la página no parezcan dos productos.
//
//   node scripts/og-imagen.mjs
//
// El PNG queda versionado a propósito: es un archivo estático que las redes
// piden por URL, no algo que el build pueda generar a tiempo.
import { chromium } from "playwright";
import path from "path";
import { fileURLToPath } from "url";

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

const HTML = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Inter:wght@400;600;700&display=swap">
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1200px; height:630px; background:#08080A; color:#F0EDE5;
         font-family:'Inter',sans-serif; overflow:hidden; position:relative; }
  /* El resplandor verde es el mismo acento de la landing (#C9F527). */
  .glow { position:absolute; border-radius:50%; filter:blur(120px); }
  .g1 { width:600px; height:600px; background:rgba(201,245,39,0.16); top:-180px; right:-120px; }
  .g2 { width:520px; height:520px; background:rgba(192,57,43,0.14); bottom:-220px; left:-140px; }
  .wrap { position:relative; padding:84px 90px; height:100%; display:flex;
          flex-direction:column; justify-content:space-between; }
  .marca { display:flex; align-items:center; gap:16px; }
  .marca .n { font-family:'Bebas Neue',sans-serif; font-size:58px; letter-spacing:2px; }
  .marca .p { width:14px; height:14px; border-radius:50%; background:#C9F527;
              box-shadow:0 0 24px #C9F527; }
  h1 { font-family:'Bebas Neue',sans-serif; font-size:104px; line-height:0.95;
       letter-spacing:1px; max-width:900px; }
  h1 em { font-style:normal; color:#C9F527; }
  p  { font-size:27px; color:#7A7770; margin-top:26px; max-width:820px; line-height:1.45; }
  .pie { display:flex; align-items:center; gap:14px; font-size:22px; color:#454340; }
  .pie span { padding:9px 18px; border:1px solid rgba(240,237,229,0.10);
              border-radius:100px; color:#7A7770; }
</style></head><body>
  <div class="glow g1"></div><div class="glow g2"></div>
  <div class="wrap">
    <div class="marca"><div class="p"></div><div class="n">SPORTOS</div></div>
    <div>
      <h1>Tu club entero,<br><em>en una sola app</em></h1>
      <p>Plantel, convocatorias, asistencia, cuotas, estadísticas y salud.
         Cada uno ve lo que le toca.</p>
    </div>
    <div class="pie"><span>🏉 Rugby</span><span>⚽ Fútbol</span><span>🏀 Básquetbol</span><span>🤾 Handball</span><span>🏑 Hockey</span></div>
  </div>
</body></html>`;

const navegador = await chromium.launch();
const pagina = await navegador.newPage({ viewport: { width: 1200, height: 630 } });
await pagina.setContent(HTML, { waitUntil: "networkidle" });
// Las fuentes llegan por red: sin esperarlas el PNG sale con la del sistema.
await pagina.evaluate(() => document.fonts.ready);
await pagina.screenshot({ path: path.join(raiz, "public", "og.png") });
await navegador.close();
console.log("✅ public/og.png");
