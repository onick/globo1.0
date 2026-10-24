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

## Avisos por correo y WhatsApp

Cada cliente define en **Settings** quién recibe avisos (correo o número de WhatsApp) y de qué tipos de alerta.

- **Cola de envíos (`notifications`):** al guardar una alerta se crea un envío pendiente por cada destinatario activo que quiere ese tipo. El despachador (`src/lib/notify/dispatcher.ts`, arranca con el servidor) envía los pendientes cada 5 s. Como el envío se guarda antes de mandarse, un reinicio no pierde avisos.
- **Reintentos:** si falla, se reintenta a los 30 s, 2 min, 10 min y 30 min; al quinto fallo queda `failed`. El último error se guarda y se ve en la columna **Sent** de `/alerts` (al pasar el ratón).
- Si el destinatario se borra o desactiva, sus envíos pendientes se descartan (`Recipient removed or deactivated`).
- Una posición repetida nunca genera la misma alerta ni el mismo aviso dos veces.
- Textos en español y hora local (`ALERT_TIMEZONE`, por defecto `America/Santo_Domingo`), con enlace al tramo en el mapa (`APP_URL`).

### Correo

```env
SMTP_URL=smtp://usuario:clave@smtp.proveedor.com:587
MAIL_FROM=Globo GPS <alertas@tu-dominio.com>
```

En local se puede usar [Mailpit](https://mailpit.axllent.org) (`SMTP_URL=smtp://localhost:1025`, bandeja en http://localhost:8025).

### WhatsApp (Cloud API de Meta)

Requisitos de Meta, fuera de Globo: portafolio comercial verificado, número de WhatsApp Business en la Cloud API y una **plantilla aprobada** (los mensajes que inicia una empresa deben usar plantilla). La plantilla debe tener 4 parámetros en el cuerpo, por ejemplo:

> 🚚 {{1}} {{2}}. Fecha: {{3}}. Ver en el mapa: {{4}}

`{{1}}` vehículo · `{{2}}` qué pasó ("entró en Depósito", "iba a 85 km/h (límite 70 km/h)") · `{{3}}` fecha y hora · `{{4}}` enlace al mapa.

```env
WHATSAPP_TOKEN=...                # token de acceso (usuario del sistema)
WHATSAPP_PHONE_NUMBER_ID=...      # id del número en Meta
WHATSAPP_TEMPLATE=alerta_vehiculo # nombre de la plantilla aprobada
WHATSAPP_TEMPLATE_LANG=es         # idioma de la plantilla
WHATSAPP_GRAPH_URL=https://graph.facebook.com/v23.0  # comprobar la versión vigente de la Graph API
```

Los números se guardan en formato internacional sin "+" (18095551234). Meta cobra por conversación iniciada por la empresa.

Si un canal no está configurado, Settings lo avisa y los envíos de ese canal fallan con el motivo.

## Verificación

**Alertas.** Recorrido simulado de 8,1 km por calles reales de Santo Domingo (OSRM local), una posición cada 10 s enviada en orden como un rastreador, con tres geocercas y límite de 70 km/h. Un script independiente calculó las alertas esperadas con las mismas reglas: Globo generó exactamente las mismas 5 (hora, tipo y geocerca). Después, una posición antigua y una repetida no generaron nada, y una posición nueva fuera del destino generó solo su salida.

**Avisos.** Con tres destinatarios (un correo con todos los tipos, un WhatsApp con geocercas y otro con excesos que siempre falla), tres alertas reales generaron exactamente los envíos esperados: 3 correos recibidos en Mailpit y 2 WhatsApp aceptados por un servidor que imita la API de Meta (plantilla, idioma, token y 4 parámetros correctos). El que falla se reintentó a los 30 s y quedó programado a los 2 min; al desactivar el destinatario se descartó sin más peticiones. **No se probó contra Meta real**: requiere la cuenta y la plantilla aprobada.

## Pendiente

- Probar WhatsApp con la cuenta real de Meta y una plantilla aprobada.
- Resumen o límite de avisos cuando hay muchos seguidos (hoy es uno por alerta).
- Geocercas poligonales.
- Reporte de visitas a geocercas (entradas/salidas con tiempo dentro).
- En producción, el puente debería correr como proceso aparte de la web para escalar y no duplicarse con varias réplicas.
