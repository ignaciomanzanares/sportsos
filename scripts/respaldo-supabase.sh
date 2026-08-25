#!/usr/bin/env bash
# Respaldo completo de la base del club.
#
# Los datos de Old Reds —142 fichas con fechas de nacimiento, teléfonos,
# contactos de emergencia y estado médico, más las cuotas y las cuentas—
# viven hoy en una cuenta de Supabase que no es del club. Esto se corre para
# que exista una copia propia, pase lo que pase con esa cuenta.
#
# La cadena de conexión NO se escribe acá ni queda en el historial: se pasa
# por variable de entorno en la misma línea del comando.
#
#   Dónde sacarla:
#     Supabase → Project Settings → Database → Connection string → URI
#     (usar el "Session pooler", puerto 5432)
#
#   Cómo correrlo, con un espacio adelante para que bash no lo guarde:
#      DB_URL='postgresql://...' ./scripts/respaldo-supabase.sh
#
set -euo pipefail

if [ -z "${DB_URL:-}" ]; then
  echo "Falta DB_URL. Ejemplo:"
  echo "   DB_URL='postgresql://postgres.xxx:CLAVE@aws-0-us-east-1.pooler.supabase.com:5432/postgres' $0"
  exit 1
fi

DEST="${DEST:-$HOME/respaldos-sportos}"
STAMP=$(date +%Y-%m-%d_%H%M)
mkdir -p "$DEST"

echo "→ respaldando en $DEST"

# Dos archivos a propósito. El .sql es legible y se puede inspeccionar o
# restaurar a mano; el .dump es comprimido y restaura más rápido con pg_restore.
# Solo el esquema 'public': los internos de Supabase (auth, storage) no son
# nuestros y no se pueden restaurar en otro proyecto de todos modos.
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges \
        --file="$DEST/sportos_${STAMP}.sql"
pg_dump "$DB_URL" --schema=public --no-owner --no-privileges -Fc \
        --file="$DEST/sportos_${STAMP}.dump"

# Las cuentas viven en el esquema auth, que pg_dump no toca por defecto. Sin
# esto se recuperarían los jugadores pero nadie podría entrar.
pg_dump "$DB_URL" --schema=auth --no-owner --no-privileges \
        --file="$DEST/sportos_auth_${STAMP}.sql" || \
  echo "  (aviso: no se pudo respaldar el esquema auth — suele necesitar la conexión directa, no el pooler)"

echo
ls -lh "$DEST" | tail -4
echo
echo "✓ listo. Para comprobar que sirve, sin restaurar nada:"
echo "    grep -c 'INSERT INTO' $DEST/sportos_${STAMP}.sql"
