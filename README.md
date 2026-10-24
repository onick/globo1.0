# Globo GPS

Plataforma SaaS multi-cliente de rastreo GPS de flotas, construida sobre [Traccar](https://www.traccar.org) como motor de recepción de rastreadores.

- **Mapa en vivo** de la flota y **historial** de recorridos ajustado a las calles (OSRM), con reproducción.
- **Reportes de actividad:** viajes, paradas, ralentí y excesos de velocidad, exportables a CSV.
- **Geocercas y alertas** (entrada, salida, exceso) calculadas por Globo en vivo, con **avisos** por correo y WhatsApp.
- Panel de **administración** de clientes, usuarios, dispositivos y planes.

Stack: Next.js 16 + React 19 + TypeScript, Prisma + PostgreSQL, Redis, Traccar, OSRM y MapLibre, todo en Docker Compose. Node 24 (`.nvmrc`).

## Puesta en marcha (desarrollo)

```bash
cp .env.example .env            # y completar contraseñas y secretos
docker compose up -d            # Traccar, PostgreSQL, Redis, OSRM
npm install
npm run db:deploy               # aplica las migraciones
npx prisma db seed              # planes y super admin de prueba
scripts/osrm-prepare.sh         # una vez: mapa de calles para OSRM (docs/osrm.md)
npm run dev                     # http://localhost:3000
```

Para ver vehículos moviéndose sin rastreadores reales:

```bash
node --env-file=.env --import tsx scripts/simulate-devices.ts
```

El simulador publica en Traccar por el protocolo OsmAnd, igual que un rastreador, así que el mapa, el historial, los reportes y las alertas lo ven.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run typecheck` | Comprobación de tipos |
| `npm run lint` | ESLint |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:integration` | Pruebas de la API contra Postgres, entre ellas el aislamiento entre clientes (necesita `TEST_DATABASE_URL`) |
| `npm run build` | Compilación de producción |
| `npm run db:migrate` | Crea una migración a partir de cambios en `prisma/schema.prisma` |
| `npm run db:deploy` | Aplica las migraciones pendientes (producción) |
| `npm run db:check` | Falla si el esquema y las migraciones no coinciden (necesita `SHADOW_DATABASE_URL`) |

## Base de datos

El esquema vive en `prisma/schema.prisma` y **cada cambio va con su migración** en `prisma/migrations/`:

1. Editar `schema.prisma`.
2. `npm run db:migrate -- --name que_cambia`, que crea la migración y la aplica en local.
3. Hacer commit del esquema y de la migración juntos.

En producción solo se usa `npm run db:deploy`. No usar `prisma db push` fuera de pruebas desechables: no deja migración y puede borrar datos.

## Calidad

Cada pull request y cada push a `main` pasan por GitHub Actions (`.github/workflows/ci.yml`): tipos, lint, pruebas, migraciones al día con el esquema y compilación. Un PR con cualquiera de esos pasos en rojo no debería fusionarse.

Las pruebas están junto al código que prueban (`src/**/*.test.ts`). La lógica de historial, reportes, alertas y avisos está en funciones puras de `src/lib/`, que es donde se prueba.

Las pruebas de integración (`src/**/*.int.test.ts`) llaman a las rutas de la API con una base de datos real y comprueban que **ningún usuario ve ni cambia datos de otro cliente**: listados, historial, reportes, cambios, borrados y altas que nombran a otro cliente, el panel de administración y usuarios sin cliente asignado. Usan una base de datos propia cuyo nombre debe terminar en `test`, porque vacían sus tablas:

```bash
createdb globo_test
TEST_DATABASE_URL=postgresql://usuario:clave@localhost:5432/globo_test npm run test:integration
```

Toda ruta nueva que lea o cambie datos de un cliente filtra con `tenantScope()` (`src/lib/tenant-scope.ts`) y se añade a esas pruebas.

## Documentación

- [docs/osrm.md](docs/osrm.md): rutas ajustadas a las calles.
- [docs/alertas.md](docs/alertas.md): geocercas, motor de alertas y avisos por correo y WhatsApp.
- [docs/rastreadores.md](docs/rastreadores.md): dominio y puertos del servidor, y cómo pasar un GPS de otra plataforma a Globo.
- [docs/plans/](docs/plans/): diseño original del proyecto.
