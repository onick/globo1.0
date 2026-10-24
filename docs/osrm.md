# OSRM: rutas ajustadas a las calles

Un rastreador manda una posición cada cierto tiempo (10–60 s). Si el historial une esas posiciones con líneas rectas, la ruta corta esquinas, cruza manzanas y mide menos de lo recorrido. Globo GPS ajusta la ruta a la red de calles con el servicio `match` de [OSRM](https://project-osrm.org), que corre en el servicio `osrm` de `docker-compose.yml`.

Sin OSRM (`OSRM_URL` vacío) el historial sigue funcionando: muestra la línea entre posiciones GPS y avisa de que puede cortar esquinas.

## Puesta en marcha

1. Preparar el mapa (descarga el extracto de OpenStreetMap y lo procesa; requiere Docker):

   ```bash
   scripts/osrm-prepare.sh
   ```

   Por defecto descarga Haití + República Dominicana de Geofabrik (~90 MB; Geofabrik no tiene un extracto solo de RD), comprueba el MD5 y lo procesa en `docker/osrm/data/` (~575 MB, unos 30 s). Esa carpeta no va a git.

2. Levantar el servicio:

   ```bash
   docker compose up -d osrm
   ```

3. Configurar la app (`.env`):

   ```env
   OSRM_URL=http://localhost:5100
   OSRM_MATCH_MAX_POINTS=100
   ```

   Si la app corre dentro de la red de Docker, usar `http://osrm:5000`.

Comprobación rápida:

```bash
curl "http://localhost:5100/route/v1/driving/-69.94,18.473;-69.86,18.495?overview=false"
```

## Variables

| Variable | Por defecto | Uso |
|---|---|---|
| `OSRM_URL` | vacío | URL del servidor OSRM. Vacío: sin ajuste a calles |
| `OSRM_MATCH_MAX_POINTS` | `100` | Posiciones por petición. Debe ser ≤ `--max-matching-size` del servidor |
| `OSRM_PORT` | `5100` | Puerto del servicio en el host (el 5000 lo usa AirPlay en macOS) |
| `OSRM_DATA_DIR` | `./docker/osrm/data` | Carpeta con el mapa procesado |
| `OSRM_REGION` | `central-america/haiti-and-domrep` | Extracto de Geofabrik que descarga el script |

Para otro país, cambiar `OSRM_REGION` por su ruta en [download.geofabrik.de](https://download.geofabrik.de) y volver a ejecutar el script.

## Actualizar el mapa

OpenStreetMap cambia a diario. Para incorporar calles nuevas, volver a ejecutar el script (solo descarga si el extracto cambió) y reiniciar el servicio:

```bash
scripts/osrm-prepare.sh && docker compose restart osrm
```

Con una vez al mes basta.

## Cómo se ajusta una ruta

`src/lib/map-matching.ts`:

- Descarta posiciones a menos de 15 m de la anterior (vehículo parado): no aportan recorrido y confunden el ajuste.
- Envía las posiciones en bloques de `OSRM_MATCH_MAX_POINTS` con radio de búsqueda de 15 m y la hora de cada posición.
- Si un tramo no se puede ajustar (sin calles cerca, posiciones malas), conserva la línea GPS de ese tramo. Si OSRM no responde, el historial entero usa la línea GPS.
- La distancia del resumen sale de la ruta ajustada; la distancia entre posiciones GPS se muestra al lado para comparar.

El radio de 15 m se eligió midiendo contra un recorrido conocido: un camión simulado por calles reales de Santo Domingo (13,28 km, una posición cada 30 s):

| | Distancia | Separación de la calle real |
|---|---|---|
| Línea entre posiciones GPS | 12,20 km | media 10,1 m, máxima 91 m |
| Ajustada, radio 25 m | 12,53 km | 850 m del recorrido real sin cubrir (tomó calles paralelas) |
| **Ajustada, radio 15 m** | **12,82 km** | **máxima 0,1 m; solo falta el desvío descrito abajo (315 m)** |

## Límite: lo que pasa entre dos posiciones

El ajuste solo puede reconstruir lo que el rastreador registró. En la prueba, el camión entró y salió de una calle lateral (315 m) entre dos posiciones de 30 s; ninguna posición cayó dentro, así que ese desvío no aparece y la distancia ajustada es menor que la real.

Para más detalle, configurar los rastreadores para que reporten también al cambiar de rumbo (la mayoría lo permite, p. ej. cada 15–30°), no solo por tiempo.

## Producción

No usar el servidor público de demostración de OSRM (`router.project-osrm.org`): es solo para pruebas, limita el `match` a unas 10 posiciones por petición y no tiene garantía de servicio. El servicio `osrm` de este compose es el que debe correr en producción.
