# Despliegue en un servidor

Globo corre en un solo servidor con `docker-compose.prod.yml`, detrás de un Traefik que ya exista (el proxy de Coolify, red `coolify`). Traefik da el HTTPS con Let's Encrypt.

Desde Internet solo se puede llegar a dos cosas:
- la web, a través de Traefik;
- los puertos de los GPS: 5023, 5001 y 5027.

Las bases de datos, Redis, OSRM y la API de Traccar solo son accesibles dentro de la red del proyecto. Los servicios se llaman entre sí con los alias `globo-db`, `globo-redis`, `globo-traccar` y `globo-osrm`, porque en la red `coolify` otros contenedores ya responden a nombres como `redis` y `postgres`.

## Primera vez

En el servidor, en `/opt/globo`:

1. **Código:** copia los archivos del repo. Copia también los datos de OSRM ya preparados en `docker/osrm/data` (ver [osrm.md](osrm.md)).
2. **`.env.production`**, con permisos 600. Lleva `APP_HOST`, `NEXTAUTH_URL` y `APP_URL` con el dominio de la web; `NEXTAUTH_SECRET`; las contraseñas `DB_PASSWORD`, `TRACCAR_DB_PASSWORD`, `REDIS_PASSWORD` y `TRACCAR_ADMIN_PASSWORD`; `TRACCAR_ADMIN_EMAIL`; `TRACKER_SERVER_HOST` (ver [rastreadores.md](rastreadores.md)); y `ALERT_TIMEZONE`. Genera las contraseñas con `openssl rand -hex 24`.
3. **Servicios y base:**

   ```bash
   C="docker compose -f docker-compose.prod.yml --env-file .env.production"
   $C --profile tools build
   $C up -d db traccar-db redis traccar osrm
   $C --profile tools run --rm tools npx prisma migrate deploy
   ```

4. **Administrador de Traccar:** con Traccar vacío, el primer usuario creado con `POST /api/users` es el administrador. Usa `TRACCAR_ADMIN_EMAIL` y `TRACCAR_ADMIN_PASSWORD`. Después desactiva el registro de Traccar (`PUT /api/server` con `registration: false`).
5. **Super admin de Globo**, sin datos de demo ni contraseña por defecto:

   ```bash
   $C --profile tools run --rm -e BOOTSTRAP_ADMIN_EMAIL=… -e BOOTSTRAP_ADMIN_PASSWORD=… tools npx tsx scripts/bootstrap-prod.ts
   ```

6. **Arranque y firewall:**

   ```bash
   $C up -d app
   ufw allow 5023/tcp; ufw allow 5001/tcp; ufw allow 5027/tcp
   ```

7. **Clientes de otra plataforma:** deja el JSON en `/opt/globo/imports/` e impórtalo:

   ```bash
   $C --profile tools run --rm tools npx tsx scripts/import-fleet.ts /imports/<flota>.json
   ```

## Actualizar

Copia el código nuevo y luego:

```bash
$C --profile tools build && $C --profile tools run --rm tools npx prisma migrate deploy && $C up -d app
```

## Copias de seguridad

`scripts/backup-prod.sh` vuelca cada día las dos bases (Globo y Traccar). Corre a las 02:50 UTC desde el cron de root y deja el registro en `/var/log/globo-backup.log`. Cada volcado:
- se cifra con [age](https://age-encryption.org) usando la clave **pública** de `backup.env`;
- se guarda en `/root/globo-backups/<fecha>/`, con un `SHA256SUMS`;
- se envía fuera del servidor si `BACKUP_RCLONE_REMOTE` tiene un remoto de rclone;
- se borra pasados 14 días (`BACKUP_KEEP_DAYS`), tanto aquí como en el remoto.

`last-success` guarda la hora de la última copia correcta.

Hoy el destino es otro servidor por SFTP: un remoto de rclone creado así.

```bash
rclone config create globo-offsite sftp host=<servidor> user=root key_file=/root/.ssh/id_ed25519 known_hosts_file=/root/.ssh/known_hosts shell_type=unix
```

En `backup.env`: `BACKUP_RCLONE_REMOTE=globo-offsite:/root/globo-backups`. Para comprobar que una copia llegó entera: `rclone check /root/globo-backups/<fecha> globo-offsite:/root/globo-backups/<fecha>`.

La clave **privada** no está en el servidor. Si alguien entra en él, no puede leer las copias. Guárdala en un gestor de contraseñas: sin ella las copias no sirven.

Para restaurar, por ejemplo en un Postgres vacío:

```bash
age -d -i globo-backup-key.txt globo.dump.age | pg_restore -d globo --clean --if-exists --no-owner
age -d -i globo-backup-key.txt traccar.dump.age | pg_restore -d traccar --clean --if-exists --no-owner
```

## Pendiente para producción

- Monitoreo del puerto web y de los puertos de los GPS.
- Dominio propio para la web y para los rastreadores.
