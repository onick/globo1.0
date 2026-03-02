# Globo GPS - Documento de Diseno

## Resumen

Plataforma SaaS multi-tenant de rastreo GPS construida sobre Traccar como motor de rastreo. Frontend y backend unificados en Next.js (monolito). Tiempo real via WebSockets + Redis Pub/Sub. Desplegada en VPS con Docker.

## Decisiones Clave

| Decision | Eleccion | Razon |
|---|---|---|
| Motor GPS | Traccar | 200+ protocolos, open source, listo para usar |
| Arquitectura | Monolito Next.js | Simplicidad, un solo deploy, curva de aprendizaje baja |
| Multi-tenancy | BD compartida con tenant_id | Simple, economico, escala bien |
| Tiempo real | Redis Pub/Sub + WebSockets | <500ms de latencia, filtrado por tenant |
| Mapas | Mapbox GL JS | Renderizado WebGL, fluido con miles de markers |
| BD | PostgreSQL 16 | Separada de Traccar, solo datos de negocio |
| Infra | Docker Compose en VPS | Un comando levanta todo |

## Usuarios Objetivo

- Empresas de flotas (transporte, logistica, delivery)
- Empresas de seguridad vehicular
- Personas (rastreo personal de vehiculos, motos)

## Escala Inicial

- 2000-5000 dispositivos
- ~150-500 mensajes/segundo
- Escalable a 100K+ dispositivos separando servicios

---

## 1. Arquitectura General

```
Dispositivos GPS (TCP/UDP)
        |
    Traccar Server (:8082)
        |  WebSocket push
    Next.js App (:3000)
        |
   +---------+----------+
   |         |          |
 Redis    PostgreSQL   Nginx
 (cache)  (negocio)   (proxy+SSL)
```

### Flujo de datos en tiempo real

1. Dispositivo GPS envia posicion por TCP/UDP a Traccar
2. Traccar decodifica el protocolo y almacena en su BD
3. Traccar notifica via WebSocket a Next.js
4. Next.js escribe en Redis: cache de posicion + publish al canal del tenant
5. Frontend recibe via WebSocket y actualiza el marker en el mapa

### Latencia esperada

- Dispositivo -> Traccar: depende del dispositivo (10-30s intervalos)
- Traccar -> Next.js: ~50ms (WebSocket push)
- Next.js -> Redis: ~0.1ms
- Redis -> Frontend: ~100-200ms
- **Total plataforma: <500ms desde que Traccar recibe**

---

## 2. Modelo de Datos

### BD Globo (PostgreSQL - datos de negocio)

**tenants**
- id, name, slug, plan_id, status, max_devices, created_at

**users**
- id, tenant_id, email, role (super_admin|admin|operator|viewer), password, status, created_at

**devices**
- id, tenant_id, traccar_id, name, imei, status, vehicle_plate, vehicle_type, created_at

**plans**
- id, name, max_devices, price, interval, features (JSON)

**subscriptions**
- id, tenant_id, plan_id, status, current_period, payment_method, created_at

### BD Traccar (PostgreSQL - datos GPS)

Gestionada por Traccar. No se modifica directamente. Comunicacion solo via API REST.

### Puente entre BDs

- devices.traccar_id (Globo) <-> devices.id (Traccar)
- Toda operacion sobre datos GPS pasa por la API de Traccar

### Redis (tiempo real)

```
device:pos:{traccar_id}    -> ultima posicion (JSON)
device:tenant:{traccar_id} -> tenant_id (mapeo)
tenant:{tenant_id}         -> canal Pub/Sub
```

---

## 3. Roles y Seguridad

| Rol | Alcance |
|---|---|
| super_admin | Gestion global: tenants, planes, facturacion |
| admin | Gestion de su tenant: usuarios, dispositivos, configuracion |
| operator | Monitoreo: mapa, alertas. No administra |
| viewer | Solo lectura: mapa y reportes basicos |

### Aislamiento multi-tenant

- Middleware extrae tenant_id del JWT en cada peticion
- Toda query incluye WHERE tenant_id = ? automaticamente
- Prisma middleware para forzar filtrado a nivel ORM

---

## 4. Estructura del Proyecto

```
globo/
├── docker-compose.yml
├── .env
├── package.json
├── src/
│   ├── app/
│   │   ├── (auth)/login, register
│   │   ├── (dashboard)/map, devices, settings
│   │   ├── admin/tenants, plans, billing
│   │   └── api/auth, devices, positions, tenants, webhooks
│   ├── lib/db, redis, traccar, auth, websocket
│   ├── components/map, layout, ui
│   ├── hooks/usePositions, useDevices, useAuth
│   └── middleware.ts
├── prisma/schema.prisma
└── docker/traccar, nginx
```

---

## 5. Stack Tecnologico

| Tecnologia | Version | Uso |
|---|---|---|
| Traccar | 6.x | Motor GPS |
| Next.js | 15 | Frontend + Backend |
| TypeScript | 5.x | Tipado |
| React | 19 | UI |
| Prisma | 6.x | ORM |
| PostgreSQL | 16 | BD de negocio |
| Redis | 7.x | Cache + Pub/Sub |
| Mapbox GL JS | 3.x | Mapas |
| NextAuth.js | 5 | Autenticacion |
| Tailwind CSS | 4 | Estilos |
| shadcn/ui | latest | Componentes UI |
| Docker | latest | Contenedores |
| Nginx | latest | Reverse proxy |

---

## 6. Docker Compose

Servicios:
- **traccar**: Motor GPS (:8082, puertos TCP 5001-5200)
- **traccar-db**: PostgreSQL para Traccar
- **app**: Next.js (:3000)
- **db**: PostgreSQL para Globo
- **redis**: Cache + tiempo real
- **nginx**: Reverse proxy + SSL (:80, :443)

Un solo comando: `docker compose up -d`

---

## 7. Ruta de Escalamiento

| Fase | Dispositivos | Infraestructura |
|---|---|---|
| 1 (inicio) | 1-5K | 1 VPS, todo junto |
| 2 | 5-20K | 2-3 VPS, servicios separados |
| 3 | 20-100K+ | Cluster, load balancing, Redis cluster |

Escala sin reescribir codigo: solo cambiar variables de entorno.

---

## 8. MVP (Fase 1)

Funcionalidad del primer lanzamiento:
- Autenticacion (login/registro)
- Panel super_admin (gestionar tenants y planes)
- Panel dashboard (mapa en tiempo real)
- Gestion de dispositivos (CRUD)
- Mapa con tracking en tiempo real (WebSocket + Mapbox)
- Multi-tenancy (aislamiento por tenant_id)

Funcionalidades para fases posteriores:
- Geocercas y alertas
- Historial de rutas y reportes
- Facturacion integrada (Stripe)
- Apps moviles
- Notificaciones push/email/SMS
