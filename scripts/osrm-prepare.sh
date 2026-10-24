#!/usr/bin/env bash
# Prepares the road data the osrm service uses to snap GPS routes to the streets.
#
# Downloads an OpenStreetMap extract from Geofabrik, checks it against Geofabrik's MD5
# and processes it for OSRM (car profile, MLD algorithm, needed by the match service).
# Re-run it to refresh the map; restart the osrm service afterwards.
#
# Usage: scripts/osrm-prepare.sh
#   OSRM_REGION    Geofabrik path of the extract (default: Haiti + Dominican Republic,
#                  Geofabrik has no Dominican Republic-only extract)
#   OSRM_DATA_DIR  where the processed files go (default: docker/osrm/data)
#   OSRM_IMAGE     OSRM image, must match the one in docker-compose.yml
set -euo pipefail

REGION="${OSRM_REGION:-central-america/haiti-and-domrep}"
IMAGE="${OSRM_IMAGE:-ghcr.io/project-osrm/osrm-backend:v6.0.0}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA_DIR="${OSRM_DATA_DIR:-$ROOT/docker/osrm/data}"
URL="https://download.geofabrik.de/${REGION}-latest.osm.pbf"
# osrm-routed loads /data/region.osrm, whatever the region is
PBF="$DATA_DIR/region.osm.pbf"

md5_of() {
  if command -v md5sum >/dev/null; then md5sum "$1" | cut -d' ' -f1; else md5 -q "$1"; fi
}

mkdir -p "$DATA_DIR"

echo "==> Checking $URL"
expected="$(curl -fsSL "$URL.md5" | cut -d' ' -f1)"

if [ -f "$PBF" ] && [ "$(md5_of "$PBF")" = "$expected" ]; then
  echo "    Already downloaded and up to date, skipping download"
else
  echo "==> Downloading the extract"
  curl -fL --progress-bar -o "$PBF.part" "$URL"
  actual="$(md5_of "$PBF.part")"
  if [ "$actual" != "$expected" ]; then
    rm -f "$PBF.part"
    echo "MD5 mismatch (expected $expected, got $actual). Try again later." >&2
    exit 1
  fi
  mv "$PBF.part" "$PBF"
fi
echo "    MD5 OK ($expected)"

run() { docker run --rm -v "$DATA_DIR:/data" "$IMAGE" "$@"; }

echo "==> Processing with $IMAGE"
run osrm-extract -p /opt/car.lua /data/region.osm.pbf
run osrm-partition /data/region.osrm
run osrm-customize /data/region.osrm

echo "==> Done: $(du -sh "$DATA_DIR" | cut -f1) in $DATA_DIR"
echo "    Start or restart the service: docker compose up -d osrm (or: docker compose restart osrm)"
