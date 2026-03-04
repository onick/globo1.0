/**
 * Simulates GPS devices following real roads in Dominican Republic.
 * Vehicles move along predefined waypoint routes (actual road coordinates).
 *
 * Usage: npx tsx scripts/simulate-devices.ts
 */

import { PrismaClient } from "@prisma/client";
import Redis from "ioredis";

const db = new PrismaClient();
const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6380");

/* ── Road routes (real road coordinates in DR) ────────────── */

type Waypoint = [number, number]; // [lat, lng]

// Route 1: Av. 27 de Febrero → Autopista Duarte (Santo Domingo → north)
const ROUTE_AV27_DUARTE: Waypoint[] = [
  [18.4861, -69.9312], // Av 27 de Febrero / W. Churchill
  [18.4880, -69.9380], // Av 27 de Febrero west
  [18.4895, -69.9460], // Av 27 de Febrero / Máximo Gómez
  [18.4910, -69.9545], // Av 27 de Febrero / Lope de Vega
  [18.4930, -69.9630], // Av 27 de Febrero / Núñez de Cáceres
  [18.4955, -69.9710], // Av 27 de Febrero / Tiradentes
  [18.4990, -69.9780], // Connecting to John F. Kennedy
  [18.5050, -69.9830], // Av JFK
  [18.5130, -69.9850], // Av JFK north
  [18.5230, -69.9870], // Autopista Duarte entrance
  [18.5350, -69.9890], // Autopista Duarte
  [18.5500, -69.9900], // Autopista Duarte north
  [18.5680, -69.9880], // Villa Mella area
];

// Route 2: Zona Colonial → Malecón → San Souci (motorcycle delivery route)
const ROUTE_ZONA_COLONIAL: Waypoint[] = [
  [18.4722, -69.8927], // Parque Colón
  [18.4710, -69.8870], // Calle El Conde east
  [18.4700, -69.8810], // Near Ozama river
  [18.4680, -69.8830], // Malecón start
  [18.4660, -69.8890], // Malecón
  [18.4640, -69.8960], // Malecón / George Washington
  [18.4620, -69.9040], // Malecón west
  [18.4610, -69.9120], // Malecón / Máximo Gómez
  [18.4630, -69.9070], // Turn north
  [18.4660, -69.9010], // Av México
  [18.4700, -69.8960], // Back toward colonial zone
];

// Route 3: Santiago — Av Estrella Sadhalá loop
const ROUTE_SANTIAGO: Waypoint[] = [
  [19.4517, -70.6970], // Monumento Santiago
  [19.4530, -70.6920], // Av Estrella Sadhalá east
  [19.4550, -70.6860], // Av Estrella Sadhalá
  [19.4570, -70.6790], // Near Pontificia
  [19.4600, -70.6730], // Av 27 de Febrero Santiago
  [19.4580, -70.6670], // East Santiago
  [19.4540, -70.6620], // South
  [19.4490, -70.6660], // Av Las Carreras south
  [19.4450, -70.6720], // Toward center
  [19.4430, -70.6790], // Av Imbert
  [19.4450, -70.6870], // Back west
  [19.4480, -70.6940], // Near Monumento
];

// Route 4: San Pedro de Macorís — Av Circunvalación
const ROUTE_SAN_PEDRO: Waypoint[] = [
  [18.4620, -69.3080], // Central San Pedro
  [18.4650, -69.3020], // East on main road
  [18.4680, -69.2960], // Toward port
  [18.4660, -69.2900], // Av Circunvalación east
  [18.4620, -69.2860], // Turn south
  [18.4570, -69.2890], // Coastal road
  [18.4540, -69.2960], // West along coast
  [18.4560, -69.3030], // Back up
  [18.4590, -69.3070], // Center approach
];

// Route 5: Autopista Duarte full (SD → Santiago highway, truck route)
const ROUTE_AUTOPISTA_DUARTE: Waypoint[] = [
  [18.5230, -69.9870], // SD — Autopista Duarte start
  [18.5500, -69.9900], // North SD
  [18.5800, -69.9850], // Bonao approach south
  [18.6200, -69.9750], // Further north
  [18.6700, -69.9600], // Piedra Blanca area
  [18.7300, -69.9400], // Bonao south
  [18.8000, -69.9200], // Bonao
  [18.8500, -69.8900], // North of Bonao
  [18.9200, -69.8500], // La Vega south approach
  [18.9800, -69.8200], // Near Jarabacoa turnoff
  [19.0500, -69.9000], // La Vega approach
  [19.1200, -69.9500], // La Vega
  [19.2220, -70.0290], // La Vega city
  [19.3000, -70.2000], // Toward Santiago
  [19.3800, -70.4500], // Santiago south
  [19.4200, -70.6200], // Santiago approach
  [19.4517, -70.6970], // Santiago Monumento
];

// Route 6: SD Oeste — Av. Luperón loop
const ROUTE_SD_OESTE: Waypoint[] = [
  [18.4900, -69.9888], // SD Oeste start
  [18.4870, -69.9950], // Av Luperón south
  [18.4840, -70.0020], // Av Luperón
  [18.4810, -70.0080], // Near Haina
  [18.4850, -70.0030], // Turn back
  [18.4890, -69.9970], // North
  [18.4930, -69.9910], // Av Independencia
  [18.4960, -69.9850], // East
  [18.4940, -69.9800], // Connecting road
  [18.4920, -69.9840], // Back to start area
];

// Route 7: La Vega → Jarabacoa (mountain route)
const ROUTE_VEGA_JARABACOA: Waypoint[] = [
  [19.2220, -70.0290], // La Vega center
  [19.2100, -70.0400], // South La Vega
  [19.1950, -70.0550], // Road to Jarabacoa
  [19.1750, -70.0750], // Mountain road
  [19.1550, -70.0950], // Higher elevation
  [19.1350, -70.1100], // Near Jarabacoa
  [19.1200, -70.1250], // Jarabacoa entrance
  [19.1050, -70.1350], // Jarabacoa town
  [19.1200, -70.1250], // Return
  [19.1400, -70.1050], // Mountain road back
  [19.1650, -70.0800], // Descending
  [19.1900, -70.0600], // Almost La Vega
  [19.2100, -70.0400], // La Vega south
];

// Route 8: Zona Colonial — Av. España → Sans Souci
const ROUTE_ESPANA: Waypoint[] = [
  [18.4733, -69.8875], // Zona Colonial east
  [18.4760, -69.8820], // Av España start
  [18.4800, -69.8760], // Av España
  [18.4840, -69.8700], // Av España east
  [18.4880, -69.8640], // Near Sans Souci
  [18.4920, -69.8580], // Sans Souci area
  [18.4960, -69.8530], // Los Tres Ojos area
  [18.4920, -69.8580], // Return
  [18.4870, -69.8650], // West
  [18.4830, -69.8720], // Av España west
  [18.4790, -69.8780], // Continuing
  [18.4750, -69.8850], // Near colonial zone
];

const ROUTES = [
  ROUTE_AV27_DUARTE,
  ROUTE_ZONA_COLONIAL,
  ROUTE_SANTIAGO,
  ROUTE_SAN_PEDRO,
  ROUTE_AUTOPISTA_DUARTE,
  ROUTE_SD_OESTE,
  ROUTE_VEGA_JARABACOA,
  ROUTE_ESPANA,
];

// Vehicle definitions — each assigned a route
const VEHICLES = [
  { name: "Camión Logística #01", imei: "SIM001000000001", plate: "A-001234", type: "truck",     routeIdx: 0, speedRange: [40, 70] },
  { name: "Moto Delivery #02",   imei: "SIM002000000002", plate: "M-005678", type: "motorcycle", routeIdx: 1, speedRange: [20, 50] },
  { name: "Toyota Hilux #03",    imei: "SIM003000000003", plate: "G-009012", type: "car",        routeIdx: 2, speedRange: [30, 80] },
  { name: "Hyundai Accent #04",  imei: "SIM004000000004", plate: "G-003456", type: "car",        routeIdx: 3, speedRange: [25, 60] },
  { name: "Camión Frio #05",     imei: "SIM005000000005", plate: "A-007890", type: "truck",      routeIdx: 4, speedRange: [50, 90] },
  { name: "Moto Express #06",    imei: "SIM006000000006", plate: "M-002345", type: "motorcycle", routeIdx: 5, speedRange: [15, 45] },
  { name: "Bus Ruta Norte #07",  imei: "SIM007000000007", plate: "T-006789", type: "bus",        routeIdx: 6, speedRange: [35, 65] },
  { name: "Ford Ranger #08",     imei: "SIM008000000008", plate: "G-001122", type: "car",        routeIdx: 7, speedRange: [20, 55] },
];

/* ── Types ───────────────────────────────────────────────── */

interface SimDevice {
  id: string;
  traccarId: number;
  name: string;
  lat: number;
  lng: number;
  speed: number;
  course: number;
  ignition: boolean;
  batteryLevel: number;
  totalDistance: number;
  hours: number;
  // Route following
  route: Waypoint[];
  waypointIdx: number;
  direction: 1 | -1; // 1 = forward, -1 = reverse
  progress: number;  // 0-1 between current and next waypoint
  speedRange: [number, number];
  stopTimer: number; // ticks remaining at a stop
}

/* ── Setup ───────────────────────────────────────────────── */

async function setupDevices(): Promise<SimDevice[]> {
  let tenant = await db.tenant.findFirst({ where: { slug: "demo-rd" } });
  if (!tenant) {
    tenant = await db.tenant.create({
      data: { name: "Demo RD", slug: "demo-rd", status: "active", maxDevices: 50 },
    });
    console.log(`Created tenant: ${tenant.name} (${tenant.id})`);
  }

  const simDevices: SimDevice[] = [];

  for (let i = 0; i < VEHICLES.length; i++) {
    const v = VEHICLES[i];
    const traccarId = 9000 + i;
    const route = ROUTES[v.routeIdx];

    let device = await db.device.findFirst({ where: { imei: v.imei } });
    if (!device) {
      device = await db.device.create({
        data: {
          tenantId: tenant.id, traccarId, name: v.name,
          imei: v.imei, vehiclePlate: v.plate || null,
          vehicleType: v.type, status: "active",
        },
      });
    }

    const startIdx = Math.floor(Math.random() * (route.length - 1));

    simDevices.push({
      id: device.id,
      traccarId: device.traccarId!,
      name: v.name,
      lat: route[startIdx][0],
      lng: route[startIdx][1],
      speed: 0,
      course: 0,
      ignition: true,
      batteryLevel: 50 + Math.round(Math.random() * 50),
      totalDistance: Math.round(Math.random() * 50000) / 100,
      hours: Math.round(Math.random() * 3600000),
      route,
      waypointIdx: startIdx,
      direction: 1,
      progress: 0,
      speedRange: v.speedRange as [number, number],
      stopTimer: 0,
    });
  }

  const pipeline = redis.pipeline();
  for (const d of simDevices) {
    pipeline.set(`device:tenant:${d.traccarId}`, tenant.id);
  }
  await pipeline.exec();

  console.log(`Setup ${simDevices.length} devices for tenant "${tenant.name}"`);
  return simDevices;
}

/* ── Movement (road-following) ──────────────────────────── */

function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const y = Math.sin(dLng) * Math.cos((lat2 * Math.PI) / 180);
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLng);
  let deg = (Math.atan2(y, x) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  return deg;
}

function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dlat = (lat2 - lat1) * 111;
  const dlng = (lng2 - lng1) * 111 * Math.cos((lat1 * Math.PI) / 180);
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

function moveDevice(d: SimDevice) {
  // Handle stop timer (vehicle pausing at intersection/delivery)
  if (d.stopTimer > 0) {
    d.stopTimer--;
    d.speed = 0;
    // Randomly toggle ignition while stopped
    if (Math.random() < 0.03) d.ignition = !d.ignition;
    updateSensors(d);
    return;
  }

  // Randomly stop at waypoints (simulates traffic, deliveries, etc.)
  if (Math.random() < 0.02) {
    d.stopTimer = 3 + Math.floor(Math.random() * 8); // 6-22 seconds stop
    d.speed = 0;
    updateSensors(d);
    return;
  }

  // Current and next waypoint
  const nextIdx = d.waypointIdx + d.direction;

  // Check if at end of route — reverse direction
  if (nextIdx < 0 || nextIdx >= d.route.length) {
    d.direction = (d.direction * -1) as 1 | -1;
    d.stopTimer = 2 + Math.floor(Math.random() * 5); // Brief pause at turnaround
    d.speed = 0;
    updateSensors(d);
    return;
  }

  const from = d.route[d.waypointIdx];
  const to = d.route[nextIdx];
  const segmentDist = distanceKm(from[0], from[1], to[0], to[1]);

  // Set speed within vehicle's range (with some variation)
  const [minSpd, maxSpd] = d.speedRange;
  if (Math.random() < 0.2) {
    d.speed = minSpd + Math.round(Math.random() * (maxSpd - minSpd));
  }
  d.ignition = true;

  // Calculate how much progress to make in 2 seconds
  const distPerTick = (d.speed / 3600) * 2; // km in 2 seconds
  const progressPerTick = segmentDist > 0 ? distPerTick / segmentDist : 1;
  d.progress += progressPerTick;

  if (d.progress >= 1) {
    // Reached next waypoint — move to it
    d.waypointIdx = nextIdx;
    d.progress = d.progress - 1; // carry over excess
    d.lat = to[0];
    d.lng = to[1];
  } else {
    // Interpolate between waypoints
    d.lat = from[0] + (to[0] - from[0]) * d.progress;
    d.lng = from[1] + (to[1] - from[1]) * d.progress;
  }

  // Calculate bearing toward next waypoint
  d.course = bearing(d.lat, d.lng, to[0], to[1]);

  // Accumulate distance and hours
  d.totalDistance += distPerTick;
  d.hours += 2000;

  updateSensors(d);
}

function updateSensors(d: SimDevice) {
  // Battery: charges when ignition on, drains when off
  if (d.ignition) {
    d.batteryLevel = Math.min(100, d.batteryLevel + Math.random() * 0.3);
  } else {
    d.batteryLevel = Math.max(10, d.batteryLevel - Math.random() * 0.1);
  }
}

/* ── Write to Redis ─────────────────────────────────────── */

async function writePositions(devices: SimDevice[]) {
  const pipeline = redis.pipeline();
  for (const d of devices) {
    const posData = JSON.stringify({
      deviceId: d.traccarId,
      latitude: d.lat,
      longitude: d.lng,
      speed: d.speed,
      course: d.course,
      fixTime: new Date().toISOString(),
      attributes: {
        motion: d.speed > 0,
        ignition: d.ignition,
        batteryLevel: Math.round(d.batteryLevel),
        totalDistance: Math.round(d.totalDistance * 1000) / 1000,
        hours: d.hours,
      },
    });
    pipeline.set(`device:pos:${d.traccarId}`, posData, "EX", 300);
  }
  await pipeline.exec();
}

/* ── Main ────────────────────────────────────────────────── */

async function main() {
  console.log("Setting up simulated devices...");
  const devices = await setupDevices();

  console.log("Simulation running (road-following mode). Press Ctrl+C to stop.\n");

  const tick = async () => {
    for (const d of devices) {
      moveDevice(d);
    }
    await writePositions(devices);

    const moving = devices.filter((d) => d.speed > 0).length;
    const stopped = devices.length - moving;
    process.stdout.write(`\r  ${moving} moving | ${stopped} stopped | ${new Date().toLocaleTimeString()}`);
  };

  await tick();
  setInterval(tick, 2000);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
