export const MOCK_POSTS = [
  {id:1,type:"resultado",author:"Entrenador Jefe",time:"Hace 2h",text:"¡Gran victoria! El equipo mostró una defensa sólida en los últimos 10 minutos. Próxima semana preparamos al rival.",likes:12},
  {id:2,type:"médico",author:"Dr. García",time:"Hace 5h",text:"Cristóbal Vega completó el protocolo paso 1. Evaluación mañana a las 10:00 para determinar disponibilidad.",likes:3},
  {id:3,type:"admin",author:"Admin Club",time:"Hace 1d",text:"Recordatorio: cuotas de este mes vencen el día 30. Matías Herrera y Marco Silva aún tienen cuota pendiente.",likes:1},
  {id:4,type:"advertencia",author:"Preparador Díaz",time:"Hace 2d",text:"Sesión de fuerza viernes 7:00 AM obligatoria para plantel principal. Planilla de asistencia activa.",likes:7},
];

// Modelo unificado de partidos: programados + jugados en la misma estructura.
// estado: "programado" | "jugado"
// equipo: "A" | "B" | "C" (dentro de cada categoría un plantel puede tener varios equipos)
// Campos aiAnalysis/videoUrl preparados para agente de IA que analizará video en el futuro.
export const MOCK_PARTIDOS = [
  // ── Jugados ──
  {
    id:1, cat:"Primer Equipo", equipo:"A", rival:"Universitario RC",
    fecha:"2025-06-07", hora:"15:30", lugar:"Local", estado:"jugado",
    golesLocal:3, golesVisita:1, resultado:"victoria",
    autor:"Eduardo Ramírez", resumen:"Partido dominado desde el inicio. Excelente defensa en el segundo tiempo.",
    destacados:["Andrés Castro","Felipe Morales"],
    videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  {
    id:2, cat:"Primer Equipo", equipo:"B", rival:"Santiago RC",
    fecha:"2025-06-07", hora:"13:00", lugar:"Visita", estado:"jugado",
    golesLocal:2, golesVisita:0, resultado:"victoria",
    autor:"Carlos Vidal", resumen:"Sólida actuación. Dos tries en los primeros 20 minutos.",
    destacados:["Diego Saavedra","Matías Herrera"],
    videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  {
    id:3, cat:"Reserva", equipo:"A", rival:"Cóndores RC",
    fecha:"2025-06-06", hora:"11:00", lugar:"Local", estado:"jugado",
    golesLocal:1, golesVisita:1, resultado:"empate",
    autor:"Rodrigo Muñoz", resumen:"Empate justo. El equipo creció en la segunda mitad.",
    destacados:["Pablo Rodríguez"],
    videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  {
    id:4, cat:"Primer Equipo", equipo:"A", rival:"Stade Français RC",
    fecha:"2025-05-31", hora:"16:00", lugar:"Local", estado:"jugado",
    golesLocal:2, golesVisita:4, resultado:"derrota",
    autor:"Eduardo Ramírez", resumen:"Resultado duro. Rival muy intenso en los rucks.",
    destacados:["Cristóbal Vega"],
    videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  // ── Programados ──
  {
    id:5, cat:"Primer Equipo", equipo:"A", rival:"Toros RC",
    fecha:"2025-06-14", hora:"15:30", lugar:"Visita", estado:"programado",
    golesLocal:null, golesVisita:null, resultado:null,
    autor:null, resumen:null, destacados:[], videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  {
    id:6, cat:"Primer Equipo", equipo:"B", rival:"Halcones RC",
    fecha:"2025-06-14", hora:"11:00", lugar:"Local", estado:"programado",
    golesLocal:null, golesVisita:null, resultado:null,
    autor:null, resumen:null, destacados:[], videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  {
    id:7, cat:"Reserva", equipo:"A", rival:"Andes RC",
    fecha:"2025-06-15", hora:"10:00", lugar:"Local", estado:"programado",
    golesLocal:null, golesVisita:null, resultado:null,
    autor:null, resumen:null, destacados:[], videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
  {
    id:8, cat:"Sub-20", equipo:"A", rival:"Cóndores Juvenil",
    fecha:"2025-06-21", hora:"09:30", lugar:"Visita", estado:"programado",
    golesLocal:null, golesVisita:null, resultado:null,
    autor:null, resumen:null, destacados:[], videoUrl:null, aiAnalysis:null, aiStatus:null,
  },
];

// Alias para retrocompatibilidad con código que use MOCK_RESULTADOS
export const MOCK_RESULTADOS = MOCK_PARTIDOS.filter(p=>p.estado==="jugado");

export const MOCK_PAYMENTS = [
  {id:1,playerId:6,playerName:"Pablo Rodríguez",amount:45000,method:"Khipu",date:"2025-05-28",status:"pagado"},
  {id:2,playerId:7,playerName:"Ignacio Pérez",amount:45000,method:"Transbank",date:"2025-05-27",status:"pagado"},
  {id:3,playerId:9,playerName:"Tomás López",amount:45000,method:"Transferencia",date:"2025-05-26",status:"pagado"},
  {id:4,playerId:11,playerName:"Carlos Contreras",amount:45000,method:"Khipu",date:"2025-05-25",status:"pagado"},
  {id:5,playerId:2,playerName:"Felipe Morales",amount:45000,method:"Transbank",date:"2025-05-24",status:"pagado"},
];
