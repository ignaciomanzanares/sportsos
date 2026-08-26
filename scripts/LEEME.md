# Scripts de caps

Los caps del primer equipo salen de arusa, partido por partido. Estos scripts
son la cadena completa, del scrape al informe que se manda al grupo.

## Cómo se rehace todo

```
node scripts/caps-partidos.mjs    # qué partidos jugó Titulares, por temporada
node scripts/caps-rivales.mjs     # nombre del rival de cada partido
node scripts/caps-arusa.mjs       # baja nómina + sustituciones (~15 min)
node scripts/caps-consolidar.mjs  # arma src/data/capsHistoricos.json (lo que lee la app)
```

`caps-arusa.mjs` guarda a cada partido y salta los que ya tiene, así que se
puede cortar y retomar. Después de una fecha nueva basta con volver a correrlo:
baja solo lo que falta.

## Informes

```
node scripts/caps-reporte.mjs        # caps-old-reds.md y .csv
node scripts/caps-whatsapp.mjs       # caps-old-reds-whatsapp.txt
node scripts/caps-por-confirmar.mjs  # los que hay que preguntarle a cada uno
node scripts/caps-pdf.mjs            # caps-old-reds.pdf, el que se reparte
node scripts/tries-reporte.mjs       # tries-old-reds.md
```

El PDF se arma con el mismo navegador headless del scraper, así que no hace
falta ninguna librería de PDF. Deja el HTML al lado por si hay que retocarlo.

No están versionados: se regeneran de los datos y versionarlos obliga a
acordarse de commitearlos cada vez que cambia un número.

## Tries

Salen de la misma tabla por partido, leyendo cada columna por su clase
(`colstyle-tries`, `colstyle-dorsal`) y no por su posición: el orden de las
columnas cambió entre temporadas y contar celdas se rompía solo.

**No coinciden con la tabla general de arusa, y está bien**: esa suma las tres
divisiones, así que un try en Intermedia figura como del primer equipo. Acá se
cuenta solo Titulares.

Validado por dos caminos independientes:

- Contra la API en vivo: los 32 jugadores de 2026 dan exactamente el mismo
  número de tries y conversiones por las dos vías.
- Contra el marcador real: sumando lo que anotó cada jugador, **90 de los 102
  partidos dan exacto**. En los otros 12 faltan 39 puntos (menos del 1% del
  total), casi siempre una conversión sin anotar. Se revisó el minuto a minuto
  de esos 12: no están ahí tampoco, y donde hay un evento de más viene sin
  jugador asociado. No se pueden atribuir a nadie.

## Lo que hay que saber del dato

**Las nóminas son firmes, los cambios no.** Arusa publica bien quién estaba
citado, pero los ingresos desde la banca los anota a mano quien hace la
planilla y se le pasa un tercio: de 749 lugares de banca hay 255 sin registrar,
y 11 partidos figuran con cero cambios, que en rugby no ocurre.

Por eso el número que muestra la app es un **mínimo**, y por eso existe
`caps-correcciones.json`: ahí va lo que confirma el propio jugador, que es
quien sabe si entró. Manda sobre lo que dice arusa y solo puede corregir a los
de banca — si estaba en la nómina de titulares, jugó.

Para sacarle la lista a alguien:

```
node scripts/caps-por-confirmar.mjs "Enrique Faúndez Saldaño"
```

**Faltan 6 de 104 partidos** que arusa nunca cargó (4 de 2021, 2 de 2024). Ahí
no hay ni titulares, y no se pueden recuperar.

## Por qué se navega con un navegador

Arusa devuelve una pantalla "Checking your browser" con código 429 a cualquier
cliente que no ejecute JavaScript. No lo pasan ni `curl` ni el proxy de
Cloudflare del proyecto rugby-chile, que reenvía la petición tal cual. Con
Playwright el desafío se resuelve una vez y la sesión sirve para todo el
recorrido.


---

# Respaldo de la base

`respaldo-supabase.sh` saca una copia completa del esquema `public` más las
cuentas de `auth`. Existe porque la base del club vive en una cuenta de
Supabase que no es del club: los 142 jugadores, con sus fechas de nacimiento,
teléfonos, contactos de emergencia y estado médico, más las cuotas.

```
 DB_URL='postgresql://...' ./scripts/respaldo-supabase.sh
```

El espacio antes del comando es a propósito: hace que bash no lo guarde en el
historial. La cadena sale de Supabase → Project Settings → Database →
Connection string → URI, usando el Session pooler (puerto 5432).

Los archivos van a `~/respaldos-sportos` y no al repo — un dump con datos
personales de menores no se versiona.
