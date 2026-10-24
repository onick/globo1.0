# Alertas y geocercas

Globo calcula sus propias alertas a partir de las posiciones que recibe de Traccar. No usa los eventos de Traccar: en las pruebas no detectó la entrada a una geocerca y procesó posiciones fuera de orden, y además obligaría a replicar en Traccar los clientes, geocercas y límites.

## Flujo

```
Rastreador → Traccar → WebSocket → puente (src/lib/websocket.ts)
                                      ├─ Redis: última posición (mapa en vivo)
                                      └─ motor de alertas (src/lib/alert-processor.ts)
                                           └─ tabla alerts → /alerts y campana del encabezado
```

- El puente arranca con el servidor (`src/instrumentation.ts`). `TRACCAR_BRIDGE=off` lo desactiva.
- Las posiciones de cada vehículo se evalúan en orden de hora de GPS. El estado por vehículo (geocercas en las que está, si va con exceso) vive en Redis (`alert:state:<traccarId>`), así que sobrevive a reinicios.
- Geocercas y límites se recargan cada 30 s: un cambio se aplica, como mucho, 30 s después.

## Reglas (`src/lib/alert-engine.ts`)

| Alerta | Cuándo |
|---|---|
| Entrada a geocerca | La posición queda a ≤ radio del centro y la anterior estaba fuera |
| Salida de geocerca | Estaba dentro y la posición queda a más de radio + 25 m |
| Exceso de velocidad | Supera el límite del vehículo (80 km/h si no tiene uno). Una alerta por episodio: hace falta bajar a límite − 5 km/h para que pueda saltar otra |

Casos especiales:

- **Primera posición de un vehículo:** solo registra dónde está; no genera alertas (no se sabe de dónde venía).
- **Geocerca nueva con el vehículo dentro:** no da "entrada" (no cruzó el borde); sí dará "salida" cuando se vaya.
- **Geocerca borrada:** desaparece del estado sin generar "salida". Las alertas pasadas se conservan, sin el enlace a la geocerca.
- **Posiciones antiguas o repetidas** (Traccar puede entregarlas desordenadas): se ignoran. Una misma posición nunca genera la misma alerta dos veces (`dedupKey`).
- Los márgenes de 25 m y 5 km/h evitan alertas en cadena por el error del GPS en el borde de la geocerca o al circular justo en el límite.

## Verificación

Recorrido simulado de 8,1 km por calles reales de Santo Domingo (OSRM local), una posición cada 10 s enviada en orden como un rastreador, con tres geocercas y límite de 70 km/h. Un script independiente calculó las alertas esperadas con las mismas reglas: Globo generó exactamente las mismas 5 (hora, tipo y geocerca). Después, una posición antigua y una repetida no generaron nada, y una posición nueva fuera del destino generó solo su salida.

## Pendiente

- Avisos fuera de la app (correo, WhatsApp, push).
- Geocercas poligonales.
- Reporte de visitas a geocercas (entradas/salidas con tiempo dentro).
- En producción, el puente debería correr como proceso aparte de la web para escalar y no duplicarse con varias réplicas.
