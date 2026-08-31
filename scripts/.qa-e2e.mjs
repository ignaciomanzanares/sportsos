import { chromium, devices } from "playwright";
const BASE="https://sportos-app.vercel.app", LINK=`${BASE}/?unirme=RUGBY-6C7D`;
const MAIL="ignacio.manzanares00+prueba3@gmail.com", PASS="PruebaSportOS2026!";
const DIR="/tmp/claude-1000/-home-ignaciomanzanares/145c833d-1c70-452b-961b-50643a430db8/scratchpad/qa";
const RUIDO=/favicon|DevTools|sourcemap|preload/i;
const errores=[], hallazgos=[];
const b=await chromium.launch();
const ctx=await b.newContext(devices["iPhone 13"]);
const p=await ctx.newPage();
p.on("console",m=>{if(m.type()==="error"&&!RUIDO.test(m.text()))errores.push(m.text());});
p.on("pageerror",e=>errores.push("EXCEPCIÓN: "+e.message));
p.on("response",r=>{if(r.status()>=400&&!RUIDO.test(r.url()))errores.push(`HTTP ${r.status()} ${r.url().replace(/^.*rest\/v1\//,"").replace(/apikey=[^&]*/,"")}`);});
const txt=async()=>(await p.locator("body").innerText()).trim();

await p.goto(LINK,{waitUntil:"networkidle"}); await p.waitForTimeout(2500);
console.log("1) LINK →", (await txt()).slice(0,90).replace(/\n/g," | "));

// Registro desde cero, que es exactamente lo que va a hacer cada jugador.
await p.getByPlaceholder("Nombre y apellido").fill("Prueba Tres QA");
await p.getByPlaceholder("Tu correo").fill(MAIL);
await p.getByPlaceholder(/contraseña/i).fill(PASS);
await p.screenshot({path:`${DIR}/R1-form.png`});
await p.getByRole("button",{name:/Entrar al club/i}).click();
await p.waitForTimeout(10000);
let t=await txt();
console.log("2) LOGIN →", t.slice(0,220).replace(/\n/g," | "));
await p.screenshot({path:`${DIR}/L2-adentro.png`});
if(/Old Reds/i.test(t)) console.log("   ✅ entró a Old Reds");
else hallazgos.push("después del login no aparece Old Reds");

for(const m of ["Mi Dashboard","Mi Cuota","Nóminas Club","Mi Convocatoria","Noticias","Mi Gym","Mi Perfil"]){
  const antes=errores.length;
  const btn=p.getByRole("button",{name:new RegExp(m,"i")}).first();
  if(await btn.count()===0){hallazgos.push(`no está el módulo "${m}"`);continue;}
  await btn.click({timeout:5000}).catch(()=>{}); await p.waitForTimeout(2500);
  const c=await txt();
  console.log(`   ${m.padEnd(16)} ${String(c.length).padStart(5)} car.${c.length<150?"  ⚠️ VACÍO":""}${errores.length>antes?"  ⚠️ error":""}`);
  if(c.length<150) hallazgos.push(`"${m}" quedó casi vacío`);
  await p.screenshot({path:`${DIR}/M-${m.replace(/\s/g,"-")}.png`});
}
console.log("\nERRORES:", errores.length?[...new Set(errores)].join("\n  "):"ninguno");
console.log("HALLAZGOS:", hallazgos.length?hallazgos.join("\n  "):"ninguno");
await b.close();
