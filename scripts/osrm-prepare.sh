#!/usr/bin/env bash
# Prepara el mapa de OSRM (DP-02, RNF-16): descarga el extracto de Andalucía de
# OpenStreetMap (Geofabrik, ~200 MB) y lo procesa para coche con el algoritmo
# MLD. Se ejecuta una vez desde la raíz del repositorio (y de nuevo para
# actualizar el mapa); después: docker compose --profile routing up -d
#
#   bash scripts/osrm-prepare.sh
set -euo pipefail

IMAGE="ghcr.io/project-osrm/osrm-backend:v26.10.0-debian"
MAP="andalucia-latest"
MAP_URL="https://download.geofabrik.de/europe/spain/${MAP}.osm.pbf"
DATA_DIR="osrm-data"

mkdir -p "${DATA_DIR}"

if [ ! -f "${DATA_DIR}/${MAP}.osm.pbf" ]; then
  echo "Descargando ${MAP_URL}"
  curl -fL -o "${DATA_DIR}/${MAP}.osm.pbf.part" "${MAP_URL}"
  mv "${DATA_DIR}/${MAP}.osm.pbf.part" "${DATA_DIR}/${MAP}.osm.pbf"
fi

# Ruta absoluta para Docker: en Git Bash (Windows), "pwd -W" la da en formato
# de Windows (C:/...), y MSYS_NO_PATHCONV evita que las rutas del contenedor
# (/data, /opt) se conviertan en rutas de Windows
HOST_DIR="$(pwd -W 2>/dev/null || pwd)/${DATA_DIR}"
run_osrm() {
  MSYS_NO_PATHCONV=1 docker run --rm -t -v "${HOST_DIR}:/data" "${IMAGE}" "$@"
}

echo "1/3 osrm-extract (perfil de coche)"
run_osrm osrm-extract -p /opt/car.lua "/data/${MAP}.osm.pbf"
echo "2/3 osrm-partition"
run_osrm osrm-partition "/data/${MAP}.osrm"
echo "3/3 osrm-customize"
run_osrm osrm-customize "/data/${MAP}.osrm"

echo "Mapa listo en osrm-data/. Arranca OSRM con:"
echo "  docker compose --profile routing up -d"
