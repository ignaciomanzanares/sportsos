// Recorrido automático de las pantallas públicas, con un navegador de verdad.
//
// Busca lo que un vistazo no encuentra: errores de consola que no rompen nada
// visible, peticiones que fallan calladas, y texto que se sale de la pantalla
// en un celular. Se corre contra producción o contra local:
//
//   node scripts/prueba-humo.mjs
//   node scripts/prueba-humo.mjs http://localhost:5173
//
// No inicia sesión ni escribe nada: es seguro correrlo contra producción.
import { chromium, devices } from "playwright";

const BASE = process.argv[2] || "https://sportos-app.vercel.app";
const problemas = [];
const anotar = (donde, qué) => problemas.push(`${donde}: ${qué}`);

// El navegador chilla por cosas que no son culpa nuestra —extensiones, avisos
// de React en desarrollo, el favicon— y si no se filtran, el ruido tapa lo que
// importa y se termina ignorando la lista entera.
const RUIDO = /favicon|Download the React DevTools|sourcemap|Autocomplete|preload/i;

async function pantalla(navegador, dispositivo, nombre) {
  const ctx = await navegador.newContext(dispositivo);
  const pagina = await ctx.newPage();
  const errores = [];
  pagina.on("console", m => {
    if (m.type() === "error" && !RUIDO.test(m.text())) errores.push(m.text());
  });
  pagina.on("pageerror", e => errores.push(`excepción: ${e.message}`));
  pagina.on("requestfailed", r => {
    if (!RUIDO.test(r.url())) errores.push(`petición fallida: ${r.url()}`);
  });
  pagina.on("response", r => {
    if (r.status() >= 400 && !RUIDO.test(r.url())) errores.push(`HTTP ${r.status()} ${r.url()}`);
  });

  const t0 = Date.now();
  await pagina.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
  const tardó = Date.now() - t0;

  // Que haya pintado algo. Una pantalla en blanco pasa cualquier otra prueba.
  const texto = (await pagina.locator("body").innerText()).trim();
  if (texto.length < 100) anotar(nombre, `la página quedó casi vacía (${texto.length} caracteres)`);

  // Desbordes horizontales: en el celular obligan a arrastrar la página de
  // lado, que es la señal más clara de "esto no está hecho para mi teléfono".
  const ancho = await pagina.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  if (ancho > 2) anotar(nombre, `se puede arrastrar ${ancho}px hacia el costado`);

  // El título y las etiquetas para compartir, servidas de verdad.
  const meta = await pagina.evaluate(() => ({
    titulo: document.title,
    og: document.querySelector('meta[property="og:image"]')?.content,
  }));
  if (/⚡/.test(meta.titulo)) anotar(nombre, "el título todavía trae el emoji");
  if (meta.og) {
    const r = await pagina.request.get(meta.og);
    if (!r.ok()) anotar(nombre, `og:image responde ${r.status()}`);
  } else anotar(nombre, "falta og:image");

  // Los botones de entrada tienen que estar y ser clickeables.
  for (const nombreBotón of ["Ingresar", "Tengo un código", "Crear club"]) {
    const b = pagina.getByRole("button", { name: new RegExp(nombreBotón, "i") }).first();
    if (await b.count() === 0) anotar(nombre, `no aparece el botón "${nombreBotón}"`);
  }

  for (const e of [...new Set(errores)]) anotar(nombre, e);
  console.log(`  ${nombre.padEnd(12)} ${tardó} ms · ${texto.length} caracteres`);
  await ctx.close();
}

// Un código que no existe tiene que dar un mensaje, no una pantalla rota.
async function códigoInválido(navegador) {
  const ctx = await navegador.newContext();
  const pagina = await ctx.newPage();
  const rotas = [];
  pagina.on("pageerror", e => rotas.push(e.message));
  await pagina.goto(`${BASE}/?unirme=CODIGO-QUE-NO-EXISTE`, { waitUntil: "networkidle" });
  await pagina.waitForTimeout(3000);
  const texto = (await pagina.locator("body").innerText()).trim();
  if (texto.length < 40) anotar("código malo", "la pantalla quedó vacía");
  else if (!/no|existe|inválid|incorrect|revis/i.test(texto))
    anotar("código malo", `no se explica el error. Dice: "${texto.slice(0, 120)}"`);
  else console.log(`  código malo   avisa bien: "${texto.split("\n").find(l => /no|inválid|revis/i.test(l))?.slice(0, 70)}"`);
  for (const r of rotas) anotar("código malo", `excepción: ${r}`);
  await ctx.close();
}

const navegador = await chromium.launch();
console.log(`\nProbando ${BASE}\n`);
await pantalla(navegador, {}, "escritorio");
await pantalla(navegador, devices["iPhone 13"], "iPhone");
await pantalla(navegador, devices["Pixel 5"], "Android");
await códigoInválido(navegador);
await navegador.close();

console.log(problemas.length ? `\n❌ ${problemas.length} problemas:\n` + problemas.map(p => `  · ${p}`).join("\n")
                             : "\n✅ Sin problemas.");
process.exit(problemas.length ? 1 : 0);
