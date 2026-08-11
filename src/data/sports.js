export const SPORTS_CONFIG = {
  rugby: { name:"Rugby",icon:"🏉",color:"#1FA04A",squadSize:23,teamSize:15,positions:["Loosehead Prop","Hooker","Tighthead Prop","Lock","Lock","Blindside Flanker","Openside Flanker","Number 8","Scrum-half","Fly-half","Left Wing","Inside Centre","Outside Centre","Right Wing","Fullback"],stats:[{key:"tries",label:"Tries",icon:"🏉"},{key:"conversiones",label:"Conv.",icon:"⚡"},{key:"penales",label:"Pen.",icon:"🎯"},{key:"minutos",label:"Min.",icon:"⏱"},{key:"tackles",label:"Tackles",icon:"💪"}],categories:["M6","M8","M10","M12","M13","M14","M16","M18","Adulta"],teamsByCategory:{Adulta:["Primera","Intermedia","Pre-Intermedia"]},
    // Así las nombra el club: menores hasta M12, juveniles de M13 a M18. No es
    // decoración del selector — es el vocabulario con el que se habla del
    // plantel, y "formativas" no lo usa nadie ahí.
    categoryGroups:[
      { label:"Menores",   cats:["M6","M8","M10","M12"] },
      { label:"Juveniles", cats:["M13","M14","M16","M18"] },
      { label:"Adulta",    cats:["Adulta"] },
    ],hasGym:true,hasHIA:true,matchDuration:"80 min" },
  futbol: { name:"Fútbol",icon:"⚽",color:"#0896B0",squadSize:18,teamSize:11,positions:["Portero","Lateral Izq.","Central","Central","Lateral Der.","Volante Izq.","Mediocampista","Mediocampista","Volante Der.","Delantero","Delantero"],stats:[{key:"goles",label:"Goles",icon:"⚽"},{key:"asistencias",label:"Asist.",icon:"🅰️"},{key:"paradas",label:"Atajadas",icon:"🧤"},{key:"minutos",label:"Min.",icon:"⏱"},{key:"tarjetas",label:"Tarjetas",icon:"🟨"}],categories:["Sub-10","Sub-13","Sub-15","Sub-17","Sub-20","Primera"],hasGym:true,hasHIA:false,matchDuration:"90 min" },
  handball: { name:"Handball",icon:"🤾",color:"#C98408",squadSize:14,teamSize:7,positions:["Portero","Lateral Izq.","Central","Lateral Der.","Extremo Izq.","Extremo Der.","Pivote"],stats:[{key:"goles",label:"Goles",icon:"🥅"},{key:"asistencias",label:"Asist.",icon:"👋"},{key:"paradas",label:"Paradas",icon:"🧤"},{key:"minutos",label:"Min.",icon:"⏱"},{key:"tarjetas",label:"Tarjetas",icon:"🟨"}],categories:["Infantil","Cadete","Juvenil","Junior","Senior"],hasGym:true,hasHIA:false,matchDuration:"60 min" },
  basketball: { name:"Basketball",icon:"🏀",color:"#C0392B",squadSize:12,teamSize:5,positions:["Base","Escolta","Alero","Ala-Pívot","Pívot"],stats:[{key:"puntos",label:"Puntos",icon:"🏀"},{key:"rebotes",label:"Reb.",icon:"↕️"},{key:"asistencias",label:"Asist.",icon:"🤝"},{key:"tapones",label:"Tap.",icon:"✋"},{key:"robos",label:"Robos",icon:"⚡"},{key:"minutos",label:"Min.",icon:"⏱"}],categories:["Mini","Infantil","Cadete","Junior","Senior","Masters"],hasGym:true,hasHIA:false,matchDuration:"40 min" },
  hockey: { name:"Hockey",icon:"🏑",color:"#8040CC",squadSize:16,teamSize:11,positions:["Arquero","Defensor","Defensor","Defensor","Mediocampista","Mediocampista","Mediocampista","Delantero","Delantero","Delantero","Delantero"],stats:[{key:"goles",label:"Goles",icon:"🏑"},{key:"asistencias",label:"Asist.",icon:"👆"},{key:"paradas",label:"Paradas",icon:"🧤"},{key:"minutos",label:"Min.",icon:"⏱"},{key:"tarjetas",label:"Tarjetas",icon:"🟨"}],categories:["Infantil","Cadete","Juvenil","Junior","Senior"],hasGym:true,hasHIA:false,matchDuration:"70 min" }
};

export const COUNTRIES = {
  CL:{name:"Chile",flag:"🇨🇱",currency:"CLP",symbol:"$",payments:["Khipu","Transbank","Transferencia"],tax:"Boleta SII"}
};

export const CLUBS = {
  rugby:{name:"Toros RC",country:"CL",cuota:45000,prev:{res:"Victoria",score:"24-17",rival:"Universitario"},next:{rival:"Cóndores Norte",dia:"Sábado"}},
  futbol:{name:"Andes FC",country:"CL",cuota:40000,prev:{res:"Victoria",score:"2-0",rival:"Colo-Colo B"},next:{rival:"U. de Chile B",dia:"Domingo"}},
  handball:{name:"Club Atlético",country:"CL",cuota:35000,prev:{res:"Derrota",score:"18-22",rival:"Defensores"},next:{rival:"Español",dia:"Jueves"}},
  basketball:{name:"Halcones BC",country:"CL",cuota:38000,prev:{res:"Victoria",score:"78-65",rival:"Panteras"},next:{rival:"Diablos",dia:"Viernes"}},
  hockey:{name:"Las Leonas",country:"CL",cuota:42000,prev:{res:"Empate",score:"2-2",rival:"Manquehue"},next:{rival:"Stade Français",dia:"Sábado"}}
};

// Equipos por defecto, para los deportes que no declaran los suyos. Rugby usa
// teamsByCategory (Primera / Intermedia / Pre-Intermedia), que son los de
// verdad y además coinciden con las divisiones del torneo.
export const TEAMS = [
  {id:"primer",name:"Primer Equipo"},
  {id:"reserva",name:"Reserva"},
  {id:"sub20",name:"Equipo Sub-20"}
];

/**
 * ¿Este partido corresponde a la categoría elegida?
 *
 * El campo `cat` de un partido guarda el equipo que jugó ("Primera",
 * "Intermedia", "Pre-Intermedia") o la categoría de edad ("M14"). Al elegir
 * Adulta hay que aceptar los tres equipos adultos; al elegir M14, solo M14.
 * Un partido sin categoría se muestra siempre: esconderlo sería peor que
 * mostrarlo donde quizá no corresponde.
 */
export function partidoEsDeCategoria(sportConfig, categoria, cat) {
  if (!cat || !categoria) return true;
  // Los partidos de menores y juveniles vienen etiquetados "Primera División M13", así que
  // buscar "Primera" dentro del texto los arrastraba a Adulta. Si el nombre
  // trae una marca de edad, la edad manda.
  const edad = /\bM\d+\b/i.exec(cat);
  const equipos = sportConfig?.teamsByCategory?.[categoria];
  if (equipos?.length) {
    if (edad) return false;
    return equipos.some(e => cat.toLowerCase().includes(e.toLowerCase()));
  }
  if (edad) return edad[0].toUpperCase() === categoria.toUpperCase();
  // Menores y juveniles: "M14" tiene que calzar como palabra, para que M1 no arrastre a M14/M16.
  return new RegExp(`\\b${categoria}\\b`, "i").test(cat);
}

/**
 * Cómo se llama anotar en este deporte.
 *
 * Estaba escrito "Goles" en toda la app, también en rugby, donde no existen:
 * hay tries y puntos. Cada deporte ya declara su estadística principal en
 * stats[0], así que se saca de ahí en vez de repetir la palabra a mano.
 */
export function terminoAnotacion(sportConfig) {
  const principal = sportConfig?.stats?.[0];
  const clave = principal?.key || "goles";
  return {
    clave,
    etiqueta: principal?.label || "Goles",
    // El marcador de un partido: en rugby son puntos, no tries.
    marcador: clave === "tries" ? "Puntos" : "Goles",
  };
}

/**
 * La categoría del deporte a la que pertenece un partido.
 *
 * `cat` guarda el equipo ("Primera") o la edad ("M13"); esto devuelve la
 * categoría con la que se navega ("Adulta", "M13").
 */
export function categoriaDePartido(sportConfig, cat) {
  if (!cat) return null;
  const edad = /\bM\d+\b/i.exec(cat);
  if (edad) {
    const c = edad[0].toUpperCase();
    return (sportConfig?.categories || []).includes(c) ? c : null;
  }
  for (const [categoria, equipos] of Object.entries(sportConfig?.teamsByCategory || {})) {
    if (equipos.some(e => cat.toLowerCase().includes(e.toLowerCase()))) return categoria;
  }
  return (sportConfig?.categories || []).includes(cat) ? cat : null;
}

/** Equipos que el club presenta en una categoría. */
export function equiposDeCategoria(sportConfig, categoria) {
  const propios = sportConfig?.teamsByCategory?.[categoria];
  if (propios?.length) return propios.map(n => ({ id: n.toLowerCase().replace(/\s+/g, "-"), name: n }));
  return TEAMS;
}

export const FORMATIONS = {
  rugby:[{key:"XV",label:"XV Clásico",positions:SPORTS_CONFIG.rugby.positions,coords:[
    {x:38,y:80},{x:50,y:82},{x:62,y:80},{x:43,y:70},{x:57,y:70},{x:30,y:64},{x:70,y:64},{x:50,y:60},
    {x:40,y:50},{x:55,y:44},{x:15,y:28},{x:45,y:38},{x:33,y:31},{x:80,y:30},{x:50,y:14}]}],
  handball:[{key:"3-2-1",label:"Ataque 3-2-1",positions:SPORTS_CONFIG.handball.positions,coords:[
    {x:50,y:88},{x:33,y:44},{x:50,y:48},{x:67,y:44},{x:13,y:32},{x:87,y:32},{x:50,y:25}]}],
  basketball:[{key:"quinteto",label:"Quinteto base",positions:SPORTS_CONFIG.basketball.positions,coords:[
    {x:50,y:70},{x:20,y:56},{x:80,y:56},{x:30,y:32},{x:62,y:26}]}],
  hockey:[
    {key:"3-3-4",label:"3-3-4 Ofensivo",positions:["Arquero","Defensor","Defensor","Defensor","Mediocampista","Mediocampista","Mediocampista","Delantero","Delantero","Delantero","Delantero"],coords:[
      {x:50,y:90},{x:27,y:72},{x:50,y:75},{x:73,y:72},{x:27,y:50},{x:50,y:52},{x:73,y:50},{x:17,y:27},{x:40,y:22},{x:60,y:22},{x:83,y:27}]},
    {key:"4-3-3",label:"4-3-3 Equilibrado",positions:["Arquero","Defensor","Defensor","Defensor","Defensor","Mediocampista","Mediocampista","Mediocampista","Delantero","Delantero","Delantero"],coords:[
      {x:50,y:90},{x:18,y:73},{x:40,y:75},{x:60,y:75},{x:82,y:73},{x:30,y:50},{x:50,y:53},{x:70,y:50},{x:18,y:24},{x:50,y:20},{x:82,y:24}]},
    {key:"3-4-3",label:"3-4-3 Presión",positions:["Arquero","Defensor","Defensor","Defensor","Mediocampista","Mediocampista","Mediocampista","Mediocampista","Delantero","Delantero","Delantero"],coords:[
      {x:50,y:90},{x:30,y:74},{x:50,y:76},{x:70,y:74},{x:16,y:50},{x:40,y:53},{x:60,y:53},{x:84,y:50},{x:18,y:24},{x:50,y:20},{x:82,y:24}]}
  ],
  futbol:[
    {key:"4-4-2",label:"4-4-2 Clásico",positions:["Portero","Lateral Izq.","Central","Central","Lateral Der.","Volante Izq.","Mediocampista","Mediocampista","Volante Der.","Delantero","Delantero"],coords:[
      {x:50,y:90},{x:18,y:72},{x:40,y:75},{x:60,y:75},{x:82,y:72},{x:18,y:48},{x:40,y:52},{x:60,y:52},{x:82,y:48},{x:38,y:22},{x:62,y:22}]},
    {key:"4-3-3",label:"4-3-3 Ofensivo",positions:["Portero","Lateral Izq.","Central","Central","Lateral Der.","Mediocampista","Mediocampista","Mediocampista","Extremo Izq.","Delantero","Extremo Der."],coords:[
      {x:50,y:90},{x:18,y:72},{x:40,y:75},{x:60,y:75},{x:82,y:72},{x:32,y:50},{x:50,y:54},{x:68,y:50},{x:16,y:24},{x:50,y:18},{x:84,y:24}]},
    {key:"3-5-2",label:"3-5-2 Carrileros",positions:["Portero","Central","Central","Central","Carrilero Izq.","Mediocampista","Mediocampista","Mediocampista","Carrilero Der.","Delantero","Delantero"],coords:[
      {x:50,y:90},{x:30,y:74},{x:50,y:76},{x:70,y:74},{x:12,y:50},{x:35,y:52},{x:50,y:55},{x:65,y:52},{x:88,y:50},{x:38,y:22},{x:62,y:22}]},
    {key:"3-4-3",label:"3-4-3 Presión",positions:["Portero","Central","Central","Central","Volante Izq.","Mediocampista","Mediocampista","Volante Der.","Extremo Izq.","Delantero","Extremo Der."],coords:[
      {x:50,y:90},{x:30,y:74},{x:50,y:76},{x:70,y:74},{x:16,y:50},{x:40,y:53},{x:60,y:53},{x:84,y:50},{x:18,y:18},{x:50,y:14},{x:82,y:18}]}
  ]
};
