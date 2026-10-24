# Rastreadores: servidor y migración

Cómo dejar el servidor listo para recibir GPS reales y cómo pasar un rastreador de otra plataforma (por ejemplo Trakzee) a Globo sin perderlo.

## 1. Dirección del servidor: un dominio, no una IP

Los rastreadores guardan la dirección a la que reportan. Si es una IP y algún día cambia el servidor o su IP, **hay que reconfigurar por SMS cada equipo**. Con un dominio basta con cambiar el registro DNS.

1. Crea un subdominio solo para los rastreadores, por ejemplo `trackers.tuempresa.com`. Usa un subdominio aparte del de la web: así se puede mover el servidor de rastreo sin tocar la web.
2. Crea un registro **A** que apunte a la IP fija del servidor, con un **TTL bajo (300 s)** mientras dure la migración. Cuando todo esté estable se puede subir.
3. Ponlo en el `.env` del servidor:

   ```bash
   TRACKER_SERVER_HOST=trackers.tuempresa.com
   ```

La página de cada dispositivo muestra entonces la dirección completa (dominio y puerto del modelo) y los comandos SMS ya rellenados. Si se configura una IP, la página avisa. Los Concox aceptan dominio (`SERVER,1,dominio,5023,0#`); algunos Coban antiguos solo aceptan IP en `adminip`.

## 2. Puertos

Cada modelo reporta a un puerto de Traccar. Tienen que estar abiertos **por TCP** en el firewall del servidor y del proveedor:

| Modelo | Protocolo | Puerto |
|---|---|---|
| Concox GT06N / GT06E / otros GT06 | gt06 | 5023 |
| Coban 303F / TK103B | gps103 | 5001 |
| Teltonika FMB | teltonika | 5027 |
| App OsmAnd / Traccar Client | osmand | 5055 (solo si se usa) |

La web y la API de Traccar (`8083` en `docker-compose.yml`) quedan escuchando solo en `127.0.0.1`. Globo habla con Traccar dentro del servidor y no hace falta exponerlas. Para entrar a la web de Traccar, usa un túnel SSH (`ssh -L 8083:localhost:8083 servidor`).

Para comprobar desde fuera del servidor que un puerto responde:

```bash
nc -vz trackers.tuempresa.com 5023
```

## 3. Pasar un rastreador a Globo

Un rastreador reporta a un solo servidor: al cambiarlo, la otra plataforma deja de recibir sus posiciones.

**Antes**
- El vehículo tiene que existir en Globo con su **IMEI**, su **modelo** y el **número de teléfono de la SIM** (página del dispositivo → «Tracker & SIM»). Para clientes enteros se usa `scripts/import-fleet.ts`.
- Anota la dirección actual del equipo para poder volver. En Trakzee, los GT06 reportan a `13.127.228.11:5023`.
- Cuidado con el campo «SIM» de otras plataformas: a menudo guarda el **ICCID** de la tarjeta (19–20 dígitos que empiezan por 89), no el teléfono, y a un ICCID no se le puede mandar un SMS. Hay que conseguir el número con la operadora o con el cliente.

**Cambio**
1. En Globo, abre el vehículo → «SMS commands». Los comandos ya llevan el APN y el servidor.
2. Envía al número de la SIM, en este orden: APN (si cambió), Server y Restart. En un Concox: `APN,…#`, `SERVER,1,trackers.tuempresa.com,5023,0#`, `RESET#`.
3. Espera el primer reporte. En el panel del vehículo del mapa, «GPS Tracker» pasa a **Connected** y «Last report» se actualiza; suele tardar menos de 5 minutos.

**Si no llega en 10–15 minutos**
- Envía `GPRSSET#` (Concox) o `check123456` (Coban): el equipo contesta con el servidor y el APN que tiene.
- Comprueba que el IMEI de Globo es el mismo que el del equipo (`PARAM#` en Concox).
- Para volver a la plataforma anterior, envía el comando Server con su dirección (`SERVER,0,13.127.228.11,5023,0#`) y `RESET#`.

**Por lotes**
- Empieza con un piloto de 2 o 3 vehículos de un cliente y déjalos un día.
- Después, migra por cliente y fuera de horas de trabajo, revisando el panel de cada vehículo.
- Mantén la otra plataforma activa hasta que el último equipo reporte en Globo.

## Ver también

- [osrm.md](osrm.md): rutas ajustadas a las calles.
- [alertas.md](alertas.md): geocercas y avisos.
