/**
 * Comprueba que la app abra sin conexión. Correr contra un build servido:
 *   npm run build && npx vite preview --port 4182
 *   BASE=http://localhost:4182 node scripts/probar-sin-conexion.mjs
 *
 * Existe porque el primer service worker pasaba todas las pruebas de escritorio
 * y en la práctica dejaba la pantalla en blanco: los archivos estaban en el
 * caché pero la cabecera Vary hacía que no se encontraran. Eso solo se ve
 * cortando la red de verdad.
 */
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:4182";
const b = await chromium.launch();
const ctx = await b.newContext();
const p = await ctx.newPage();
p.on("pageerror", e=>console.log("  PAGEERROR", e.message.slice(0,150)));
await p.goto(`${BASE}/`, { waitUntil:"networkidle" });
await p.evaluate(()=>navigator.serviceWorker.ready);
await p.waitForTimeout(2000);
const n = await p.evaluate(async()=>{
  const k=(await caches.keys()).find(x=>x.startsWith("sportos-app-"));
  return (await (await caches.open(k)).keys()).length;
});
console.log("archivos en caché:", n);
await ctx.setOffline(true);
await p.reload({ waitUntil:"domcontentloaded" }).catch(e=>console.log("  reload:", e.message.slice(0,70)));
await p.waitForTimeout(3000);
const txt=(await p.textContent("body")||"").replace(/\s+/g," ").trim();
console.log("\nSIN CONEXIÓN → ¿abre?", txt.length>300 ? "SÍ" : `NO (${txt.length})`);
console.log("  ", txt.slice(0,120));
await p.locator('button:has-text("Ingresar")').first().click().catch(()=>{}); await p.waitForTimeout(900);
await p.locator('button:has-text("Probar en modo demo")').first().click().catch(()=>{}); await p.waitForTimeout(2200);
const t2=(await p.textContent("body")||"").replace(/\s+/g," ").trim();
console.log("  navega offline:", t2.length>400?"sí":"no");
console.log("  cartel de aviso:", t2.includes("Sin conexión")?"SÍ":"no");
await b.close();
