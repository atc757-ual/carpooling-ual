#!/usr/bin/env bash
# Copia de seguridad de la base de datos (PostgreSQL + PostGIS del contenedor
# de docker compose) en formato de pg_dump comprimido, y borra las copias de
# más de BACKUP_KEEP_DAYS días. Se ejecuta desde la raíz del repositorio, a
# mano o cada noche con cron (docs/despliegue.md, sección 10):
#
#   bash scripts/backup-db.sh
#
# Variables (opcionales):
#   BACKUP_DIR        carpeta de las copias (por defecto backups/, fuera de Git)
#   BACKUP_KEEP_DAYS  días que se guarda cada copia (por defecto 14)
#   DB_CONTAINER      contenedor de PostgreSQL (por defecto carpooling-db)
# El usuario y la base de datos salen del .env (POSTGRES_USER, POSTGRES_DB).
#
# Las copias tienen datos personales: la carpeta solo la lee el usuario que
# las crea, y se guardan cifradas o en un sitio de acceso restringido
set -euo pipefail

if [ -f .env ]; then
  # Solo las variables de PostgreSQL, sin ejecutar el resto del fichero
  eval "$(grep -E '^POSTGRES_(USER|DB)=' .env | tr -d '\r' | sed 's/^/export /')"
fi
POSTGRES_USER="${POSTGRES_USER:-carpooling}"
POSTGRES_DB="${POSTGRES_DB:-carpooling}"
BACKUP_DIR="${BACKUP_DIR:-backups}"
BACKUP_KEEP_DAYS="${BACKUP_KEEP_DAYS:-14}"
DB_CONTAINER="${DB_CONTAINER:-carpooling-db}"

umask 077
mkdir -p "${BACKUP_DIR}"
FILE="${BACKUP_DIR}/carpooling-$(date -u +%Y%m%dT%H%M%SZ).dump"

# Se escribe en un fichero temporal y se renombra al terminar: una copia a
# medias nunca parece buena
docker exec "${DB_CONTAINER}" pg_dump -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" \
  --format=custom --no-owner > "${FILE}.partial"
mv "${FILE}.partial" "${FILE}"
echo "Copia creada: ${FILE} ($(du -h "${FILE}" | cut -f1))"

find "${BACKUP_DIR}" -name 'carpooling-*.dump' -mtime +"${BACKUP_KEEP_DAYS}" \
  -print -delete
