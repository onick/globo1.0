# Globo GPS - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a multi-tenant SaaS GPS tracking platform on top of Traccar with real-time map tracking, device management, and tenant administration.

**Architecture:** Next.js 15 monolith (App Router) consuming Traccar's API via WebSockets for real-time GPS data. Redis for position caching and Pub/Sub per tenant. PostgreSQL for business data (users, tenants, devices, plans). Docker Compose orchestrates all services.

**Tech Stack:** Next.js 15, TypeScript 5, React 19, Prisma 6, PostgreSQL 16, Redis 7, Mapbox GL JS 3, NextAuth.js 5, Tailwind CSS 4, shadcn/ui, Traccar 6, Docker, Nginx.

---

## Task 1: Project Scaffolding + Docker Infrastructure

**Files:**
- Create: `package.json`
- Create: `docker-compose.yml`
- Create: `.env`
- Create: `.env.example`
- Create: `.gitignore`
- Create: `docker/traccar/traccar.xml`
- Create: `docker/nginx/nginx.conf`
- Create: `Dockerfile`

**Step 1: Initialize Next.js project**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults. This creates the full Next.js 15 project with TypeScript, Tailwind, and App Router.

**Step 2: Create `.env` file**

```env
# Database - Globo
DATABASE_URL=postgresql://globo:globo_secret@localhost:5432/globo

# Database - Traccar
TRACCAR_DB_PASSWORD=traccar_secret

# Redis
REDIS_URL=redis://localhost:6379

# Traccar
TRACCAR_API_URL=http://localhost:8082/api
TRACCAR_WS_URL=ws://localhost:8082/api/socket
TRACCAR_ADMIN_EMAIL=admin@globo.local
TRACCAR_ADMIN_PASSWORD=admin_secret

# Auth
NEXTAUTH_SECRET=replace-with-random-64-char-string
NEXTAUTH_URL=http://localhost:3000

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_mapbox_token_here
```

**Step 3: Create `.env.example`**

Same as `.env` but with placeholder values. Never commit `.env`.

**Step 4: Create `.gitignore`**

Ensure these are listed:

```
node_modules/
.env
.env.local
docker/nginx/certs/
```

**Step 5: Create `docker/traccar/traccar.xml`**

```xml
<?xml version='1.0' encoding='UTF-8'?>
<!DOCTYPE properties SYSTEM 'http://java.sun.com/dtd/properties.dtd'>
<properties>
    <entry key='config.default'>./conf/default.xml</entry>

    <entry key='database.driver'>org.postgresql.Driver</entry>
    <entry key='database.url'>jdbc:postgresql://traccar-db:5432/traccar</entry>
    <entry key='database.user'>traccar</entry>
    <entry key='database.password'>traccar_secret</entry>

    <entry key='web.enable'>true</entry>
    <entry key='web.port'>8082</entry>
    <entry key='web.path'>./modern</entry>

    <entry key='api.key'>traccar-api-key-replace-me</entry>
</properties>
```

**Step 6: Create `docker/nginx/nginx.conf`**

```nginx
upstream nextjs {
    server app:3000;
}

upstream traccar {
    server traccar:8082;
}

server {
    listen 80;
    server_name localhost;

    # Next.js app
    location / {
        proxy_pass http://nextjs;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Traccar API (internal, only if needed externally)
    location /traccar/ {
        proxy_pass http://traccar/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

**Step 7: Create `Dockerfile`**

```dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
USER nextjs
EXPOSE 3000
ENV PORT=3000
CMD ["node", "server.js"]
```

**Step 8: Create `docker-compose.yml`**

```yaml
services:
  traccar:
    image: traccar/traccar:latest
    ports:
      - "8082:8082"
      - "5001-5150:5001-5150"
    volumes:
      - ./docker/traccar/traccar.xml:/opt/traccar/conf/traccar.xml:ro
      - traccar-data:/opt/traccar/data
    depends_on:
      traccar-db:
        condition: service_healthy
    restart: always

  traccar-db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: traccar
      POSTGRES_USER: traccar
      POSTGRES_PASSWORD: ${TRACCAR_DB_PASSWORD:-traccar_secret}
    volumes:
      - traccar-db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U traccar"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: globo
      POSTGRES_USER: globo
      POSTGRES_PASSWORD: ${DB_PASSWORD:-globo_secret}
    ports:
      - "5432:5432"
    volumes:
      - db-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U globo"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: always

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    depends_on:
      - traccar
    restart: always

volumes:
  traccar-data:
  traccar-db-data:
  db-data:
  redis-data:
```

**Step 9: Add `output: "standalone"` to `next.config.ts`**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
};

export default nextConfig;
```

**Step 10: Start infrastructure and verify**

```bash
docker compose up -d traccar-db db redis traccar
```

Wait 15 seconds, then verify:

```bash
docker compose ps
```

Expected: all 4 services `Up (healthy)` or `Up`.

Visit `http://localhost:8082` — Traccar web UI should load.

**Step 11: Commit**

```bash
git init
git add -A
git commit -m "feat: project scaffolding with Docker infrastructure

- Next.js 15 with TypeScript, Tailwind, App Router
- Docker Compose: Traccar, PostgreSQL x2, Redis, Nginx
- Traccar configured with PostgreSQL backend
- Multi-stage Dockerfile for production builds"
```

---

## Task 2: Prisma Schema + Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Install: `prisma`, `@prisma/client`
- Create: `src/lib/db.ts`

**Step 1: Install Prisma**

```bash
npm install prisma --save-dev
npm install @prisma/client
npx prisma init
```

This creates `prisma/schema.prisma` and updates `.env` with `DATABASE_URL`.

**Step 2: Write the Prisma schema**

Replace `prisma/schema.prisma` with:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum UserRole {
  super_admin
  admin
  operator
  viewer
}

enum TenantStatus {
  active
  suspended
  trial
}

enum DeviceStatus {
  active
  inactive
  disabled
}

enum SubscriptionStatus {
  active
  past_due
  canceled
  trialing
}

model Tenant {
  id          String       @id @default(cuid())
  name        String
  slug        String       @unique
  status      TenantStatus @default(trial)
  maxDevices  Int          @default(10) @map("max_devices")
  createdAt   DateTime     @default(now()) @map("created_at")
  updatedAt   DateTime     @updatedAt @map("updated_at")

  users         User[]
  devices       Device[]
  subscriptions Subscription[]

  @@map("tenants")
}

model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String
  name      String
  role      UserRole @default(operator)
  tenantId  String?  @map("tenant_id")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  tenant Tenant? @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("users")
}

model Device {
  id           String       @id @default(cuid())
  tenantId     String       @map("tenant_id")
  traccarId    Int?         @unique @map("traccar_id")
  name         String
  imei         String       @unique
  status       DeviceStatus @default(active)
  vehiclePlate String?      @map("vehicle_plate")
  vehicleType  String?      @map("vehicle_type")
  createdAt    DateTime     @default(now()) @map("created_at")
  updatedAt    DateTime     @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId])
  @@map("devices")
}

model Plan {
  id         String @id @default(cuid())
  name       String @unique
  maxDevices Int    @map("max_devices")
  price      Int    // cents
  interval   String @default("monthly") // monthly | yearly
  features   Json   @default("[]")
  active     Boolean @default(true)
  createdAt  DateTime @default(now()) @map("created_at")

  subscriptions Subscription[]

  @@map("plans")
}

model Subscription {
  id            String             @id @default(cuid())
  tenantId      String             @map("tenant_id")
  planId        String             @map("plan_id")
  status        SubscriptionStatus @default(trialing)
  currentPeriodEnd DateTime?       @map("current_period_end")
  createdAt     DateTime           @default(now()) @map("created_at")
  updatedAt     DateTime           @updatedAt @map("updated_at")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  plan   Plan   @relation(fields: [planId], references: [id])

  @@index([tenantId])
  @@map("subscriptions")
}
```

**Step 3: Create `src/lib/db.ts`**

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query"] : [],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

**Step 4: Run migration**

Make sure `db` container is running:

```bash
docker compose up -d db
npx prisma migrate dev --name init
```

Expected: Migration created and applied. Tables created in PostgreSQL.

**Step 5: Verify with Prisma Studio**

```bash
npx prisma studio
```

Opens browser at `http://localhost:5555`. You should see all 5 tables: tenants, users, devices, plans, subscriptions.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: Prisma schema with multi-tenant data model

- Tables: tenants, users, devices, plans, subscriptions
- Tenant isolation via tenant_id foreign keys
- Enum types for roles, statuses
- Initial migration applied"
```

---

## Task 3: Redis Client + Traccar API Client

**Files:**
- Install: `ioredis`
- Create: `src/lib/redis.ts`
- Create: `src/lib/traccar.ts`

**Step 1: Install Redis client**

```bash
npm install ioredis
```

**Step 2: Create `src/lib/redis.ts`**

```typescript
import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisSub: Redis | undefined;
  redisPub: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export const redisSub =
  globalForRedis.redisSub ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379");

export const redisPub =
  globalForRedis.redisPub ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379");

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
  globalForRedis.redisSub = redisSub;
  globalForRedis.redisPub = redisPub;
}
```

Three connections: one for read/write, one for subscribe, one for publish. Redis requires separate connections for Pub/Sub.

**Step 3: Create `src/lib/traccar.ts`**

```typescript
interface TraccarSession {
  token: string;
  cookie: string;
}

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
}

interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  attributes: Record<string, unknown>;
  fixTime: string;
  serverTime: string;
}

class TraccarClient {
  private baseUrl: string;
  private cookie: string | null = null;

  constructor() {
    this.baseUrl = process.env.TRACCAR_API_URL || "http://localhost:8082/api";
  }

  private async authenticate(): Promise<void> {
    const response = await fetch(`${this.baseUrl}/session`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        email: process.env.TRACCAR_ADMIN_EMAIL || "",
        password: process.env.TRACCAR_ADMIN_PASSWORD || "",
      }),
    });

    if (!response.ok) {
      throw new Error(`Traccar auth failed: ${response.status}`);
    }

    const setCookie = response.headers.get("set-cookie");
    if (setCookie) {
      this.cookie = setCookie.split(";")[0];
    }
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    if (!this.cookie) {
      await this.authenticate();
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        ...options.headers,
        Cookie: this.cookie || "",
        "Content-Type": "application/json",
      },
    });

    if (response.status === 401) {
      this.cookie = null;
      await this.authenticate();
      return this.request<T>(path, options);
    }

    if (!response.ok) {
      throw new Error(`Traccar API error: ${response.status} ${path}`);
    }

    return response.json() as Promise<T>;
  }

  // Devices
  async getDevices(): Promise<TraccarDevice[]> {
    return this.request<TraccarDevice[]>("/devices");
  }

  async createDevice(name: string, uniqueId: string): Promise<TraccarDevice> {
    return this.request<TraccarDevice>("/devices", {
      method: "POST",
      body: JSON.stringify({ name, uniqueId }),
    });
  }

  async deleteDevice(id: number): Promise<void> {
    await this.request(`/devices/${id}`, { method: "DELETE" });
  }

  // Positions
  async getPositions(deviceId?: number): Promise<TraccarPosition[]> {
    const query = deviceId ? `?deviceId=${deviceId}` : "";
    return this.request<TraccarPosition[]>(`/positions${query}`);
  }

  // WebSocket URL for real-time positions
  getWebSocketUrl(): string {
    return process.env.TRACCAR_WS_URL || "ws://localhost:8082/api/socket";
  }
}

// Singleton
const globalForTraccar = globalThis as unknown as {
  traccar: TraccarClient | undefined;
};

export const traccar =
  globalForTraccar.traccar ?? new TraccarClient();

if (process.env.NODE_ENV !== "production") {
  globalForTraccar.traccar = traccar;
}

export type { TraccarDevice, TraccarPosition };
```

**Step 4: Verify Redis connection**

```bash
docker compose up -d redis
npx tsx -e "const Redis = require('ioredis'); const r = new Redis(); r.ping().then(console.log).then(() => r.quit())"
```

Expected: `PONG`

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: Redis client and Traccar API client

- Redis with separate pub/sub connections
- Traccar client with auto-auth and session management
- Device and position API methods
- Singleton pattern for both clients"
```

---

## Task 4: Authentication (NextAuth.js)

**Files:**
- Install: `next-auth`, `bcryptjs`, `@types/bcryptjs`
- Create: `src/lib/auth.ts`
- Create: `src/app/api/auth/[...nextauth]/route.ts`
- Create: `src/app/api/auth/register/route.ts`
- Create: `src/middleware.ts`

**Step 1: Install dependencies**

```bash
npm install next-auth@beta bcryptjs
npm install -D @types/bcryptjs
```

**Step 2: Create `src/lib/auth.ts`**

```typescript
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { db } from "./db";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.user.findUnique({
          where: { email: credentials.email as string },
          include: { tenant: true },
        });

        if (!user) return null;

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!isValid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          tenantSlug: user.tenant?.slug,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as any).role;
        token.tenantId = (user as any).tenantId;
        token.tenantSlug = (user as any).tenantSlug;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.sub;
        (session.user as any).role = token.role;
        (session.user as any).tenantId = token.tenantId;
        (session.user as any).tenantSlug = token.tenantSlug;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
});
```

**Step 3: Create `src/app/api/auth/[...nextauth]/route.ts`**

```typescript
import { handlers } from "@/lib/auth";

export const { GET, POST } = handlers;
```

**Step 4: Create `src/app/api/auth/register/route.ts`**

```typescript
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const { email, password, name, tenantName } = await request.json();

    if (!email || !password || !name || !tenantName) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const slug = tenantName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const tenant = await db.tenant.create({
      data: {
        name: tenantName,
        slug,
        users: {
          create: {
            email,
            password: hashedPassword,
            name,
            role: "admin",
          },
        },
      },
      include: { users: true },
    });

    return NextResponse.json(
      { message: "Account created", tenantId: tenant.id },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
```

**Step 5: Create `src/middleware.ts`**

```typescript
import { auth } from "@/lib/auth";

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublic = isAuthPage || isApiAuth;

  if (!req.auth && !isPublic) {
    const loginUrl = new URL("/login", req.url);
    return Response.redirect(loginUrl);
  }

  if (req.auth && isAuthPage) {
    const dashboardUrl = new URL("/map", req.url);
    return Response.redirect(dashboardUrl);
  }
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: Server starts on `http://localhost:3000`, redirects to `/login`.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: authentication with NextAuth.js

- Credentials provider with bcrypt password hashing
- JWT strategy with role and tenantId in session
- Registration endpoint creates tenant + admin user
- Middleware protects all routes except auth pages"
```

---

## Task 5: UI Foundation (shadcn/ui + Layout)

**Files:**
- Install: `shadcn/ui` components
- Create: `src/app/(auth)/login/page.tsx`
- Create: `src/app/(auth)/register/page.tsx`
- Create: `src/app/(auth)/layout.tsx`
- Create: `src/app/(dashboard)/layout.tsx`
- Create: `src/app/(dashboard)/map/page.tsx`
- Create: `src/components/layout/sidebar.tsx`
- Create: `src/components/layout/header.tsx`

**Step 1: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

Choose: New York style, Zinc color, CSS variables: yes.

**Step 2: Add needed components**

```bash
npx shadcn@latest add button input label card form toast separator avatar dropdown-menu sheet
```

**Step 3: Create `src/app/(auth)/layout.tsx`**

```tsx
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md px-4">{children}</div>
    </div>
  );
}
```

**Step 4: Create `src/app/(auth)/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    if (result?.error) {
      setError("Invalid email or password");
      setLoading(false);
    } else {
      router.push("/map");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Globo GPS</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          <p className="text-sm text-center text-zinc-500">
            No account?{" "}
            <Link href="/register" className="text-zinc-900 underline">
              Register
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 5: Create `src/app/(auth)/register/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        email: formData.get("email"),
        password: formData.get("password"),
        tenantName: formData.get("tenantName"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Registration failed");
      setLoading(false);
      return;
    }

    router.push("/login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create Account</CardTitle>
        <CardDescription>Register your company on Globo GPS</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-2 rounded">{error}</p>
          )}
          <div className="space-y-2">
            <Label htmlFor="tenantName">Company Name</Label>
            <Input id="tenantName" name="tenantName" required placeholder="e.g. Transportes Lopez" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Your Name</Label>
            <Input id="name" name="name" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={8} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create Account"}
          </Button>
          <p className="text-sm text-center text-zinc-500">
            Already have an account?{" "}
            <Link href="/login" className="text-zinc-900 underline">
              Sign in
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
```

**Step 6: Create `src/components/layout/sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Map, Cpu, Settings, Users, CreditCard, Building2 } from "lucide-react";

const navigation = [
  { name: "Map", href: "/map", icon: Map },
  { name: "Devices", href: "/devices", icon: Cpu },
  { name: "Settings", href: "/settings", icon: Settings },
];

const adminNavigation = [
  { name: "Tenants", href: "/admin/tenants", icon: Building2 },
  { name: "Plans", href: "/admin/plans", icon: CreditCard },
];

export function Sidebar({ role }: { role: string }) {
  const pathname = usePathname();

  const items = role === "super_admin"
    ? [...navigation, ...adminNavigation]
    : navigation;

  return (
    <aside className="w-64 bg-zinc-900 text-white min-h-screen p-4 flex flex-col">
      <div className="text-xl font-bold mb-8 px-2">Globo GPS</div>
      <nav className="space-y-1 flex-1">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
              pathname === item.href
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.name}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
```

**Step 7: Create `src/components/layout/header.tsx`**

```tsx
import { auth, signOut } from "@/lib/auth";
import { Button } from "@/components/ui/button";

export async function Header() {
  const session = await auth();

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <div className="text-sm text-zinc-500">
        {(session?.user as any)?.tenantSlug || "Super Admin"}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm">{session?.user?.email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="ghost" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
```

**Step 8: Create `src/app/(dashboard)/layout.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={(session.user as any)?.role || "viewer"} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-zinc-50">{children}</main>
      </div>
    </div>
  );
}
```

**Step 9: Create `src/app/(dashboard)/map/page.tsx`** (placeholder)

```tsx
export default function MapPage() {
  return (
    <div className="h-full flex items-center justify-center text-zinc-400">
      Map will be here
    </div>
  );
}
```

**Step 10: Install lucide-react icons**

```bash
npm install lucide-react
```

**Step 11: Verify the full auth flow**

```bash
npm run dev
```

1. Visit `http://localhost:3000` — should redirect to `/login`
2. Click "Register" — create an account
3. Login — should redirect to `/map` with sidebar and header visible

**Step 12: Commit**

```bash
git add -A
git commit -m "feat: UI foundation with auth pages and dashboard layout

- Login and register pages with form validation
- Dashboard layout with sidebar navigation and header
- shadcn/ui components (button, input, card, etc.)
- Role-based sidebar navigation
- Sign out functionality"
```

---

## Task 6: Device Management (CRUD)

**Files:**
- Create: `src/app/api/devices/route.ts`
- Create: `src/app/api/devices/[id]/route.ts`
- Create: `src/app/(dashboard)/devices/page.tsx`
- Create: `src/components/devices/device-table.tsx`
- Create: `src/components/devices/device-form.tsx`

**Step 1: Create `src/app/api/devices/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";

// GET /api/devices — list devices for current tenant
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as any;

  const where = role === "super_admin" ? {} : { tenantId };
  const devices = await db.device.findMany({ where, orderBy: { createdAt: "desc" } });

  return NextResponse.json(devices);
}

// POST /api/devices — create a new device
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as any;
  if (role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, imei, vehiclePlate, vehicleType } = await request.json();

  if (!name || !imei) {
    return NextResponse.json({ error: "Name and IMEI are required" }, { status: 400 });
  }

  // Check device limit
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  const deviceCount = await db.device.count({ where: { tenantId } });
  if (tenant && deviceCount >= tenant.maxDevices) {
    return NextResponse.json(
      { error: `Device limit reached (${tenant.maxDevices})` },
      { status: 403 }
    );
  }

  // Create in Traccar first
  const traccarDevice = await traccar.createDevice(name, imei);

  // Create in Globo DB
  const device = await db.device.create({
    data: {
      tenantId,
      traccarId: traccarDevice.id,
      name,
      imei,
      vehiclePlate: vehiclePlate || null,
      vehicleType: vehicleType || null,
    },
  });

  return NextResponse.json(device, { status: 201 });
}
```

**Step 2: Create `src/app/api/devices/[id]/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { traccar } from "@/lib/traccar";

// DELETE /api/devices/:id
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as any;
  const { id } = await params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (role !== "super_admin" && device.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Delete from Traccar
  if (device.traccarId) {
    await traccar.deleteDevice(device.traccarId);
  }

  // Delete from Globo DB
  await db.device.delete({ where: { id } });

  return NextResponse.json({ message: "Device deleted" });
}

// PATCH /api/devices/:id
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as any;
  const { id } = await params;

  const device = await db.device.findUnique({ where: { id } });
  if (!device) {
    return NextResponse.json({ error: "Device not found" }, { status: 404 });
  }

  if (role !== "super_admin" && device.tenantId !== tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const data = await request.json();
  const updated = await db.device.update({
    where: { id },
    data: {
      name: data.name,
      vehiclePlate: data.vehiclePlate,
      vehicleType: data.vehicleType,
      status: data.status,
    },
  });

  return NextResponse.json(updated);
}
```

**Step 3: Create `src/components/devices/device-table.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface Device {
  id: string;
  name: string;
  imei: string;
  status: string;
  vehiclePlate: string | null;
  vehicleType: string | null;
}

export function DeviceTable({
  devices: initialDevices,
}: {
  devices: Device[];
}) {
  const [devices, setDevices] = useState(initialDevices);

  async function handleDelete(id: string) {
    if (!confirm("Delete this device?")) return;
    const res = await fetch(`/api/devices/${id}`, { method: "DELETE" });
    if (res.ok) {
      setDevices(devices.filter((d) => d.id !== id));
    }
  }

  return (
    <div className="bg-white rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-zinc-50">
            <th className="text-left p-3 font-medium">Name</th>
            <th className="text-left p-3 font-medium">IMEI</th>
            <th className="text-left p-3 font-medium">Plate</th>
            <th className="text-left p-3 font-medium">Type</th>
            <th className="text-left p-3 font-medium">Status</th>
            <th className="p-3"></th>
          </tr>
        </thead>
        <tbody>
          {devices.map((device) => (
            <tr key={device.id} className="border-b last:border-0">
              <td className="p-3 font-medium">{device.name}</td>
              <td className="p-3 text-zinc-500 font-mono text-xs">{device.imei}</td>
              <td className="p-3">{device.vehiclePlate || "—"}</td>
              <td className="p-3">{device.vehicleType || "—"}</td>
              <td className="p-3">
                <span
                  className={`px-2 py-1 rounded-full text-xs ${
                    device.status === "active"
                      ? "bg-green-100 text-green-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}
                >
                  {device.status}
                </span>
              </td>
              <td className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(device.id)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </td>
            </tr>
          ))}
          {devices.length === 0 && (
            <tr>
              <td colSpan={6} className="p-8 text-center text-zinc-400">
                No devices yet. Add your first device.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
```

**Step 4: Create `src/components/devices/device-form.tsx`**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function DeviceForm({ onCreated }: { onCreated: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const res = await fetch("/api/devices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: formData.get("name"),
        imei: formData.get("imei"),
        vehiclePlate: formData.get("vehiclePlate"),
        vehicleType: formData.get("vehicleType"),
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Failed to create device");
      setLoading(false);
      return;
    }

    (e.target as HTMLFormElement).reset();
    setLoading(false);
    onCreated();
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white p-4 rounded-lg border space-y-4">
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="name">Device Name</Label>
          <Input id="name" name="name" required placeholder="e.g. Truck 01" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="imei">IMEI</Label>
          <Input id="imei" name="imei" required placeholder="15-digit IMEI" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehiclePlate">License Plate</Label>
          <Input id="vehiclePlate" name="vehiclePlate" placeholder="Optional" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="vehicleType">Vehicle Type</Label>
          <Input id="vehicleType" name="vehicleType" placeholder="e.g. truck, car, motorcycle" />
        </div>
      </div>
      <Button type="submit" disabled={loading}>
        {loading ? "Adding..." : "Add Device"}
      </Button>
    </form>
  );
}
```

**Step 5: Create `src/app/(dashboard)/devices/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";
import { DeviceTable } from "@/components/devices/device-table";
import { DeviceForm } from "@/components/devices/device-form";

export default function DevicesPage() {
  const [devices, setDevices] = useState([]);
  const [showForm, setShowForm] = useState(false);

  async function loadDevices() {
    const res = await fetch("/api/devices");
    if (res.ok) setDevices(await res.json());
  }

  useEffect(() => {
    loadDevices();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Devices</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-zinc-900 text-white rounded-md text-sm hover:bg-zinc-800"
        >
          {showForm ? "Cancel" : "Add Device"}
        </button>
      </div>

      {showForm && (
        <DeviceForm
          onCreated={() => {
            loadDevices();
            setShowForm(false);
          }}
        />
      )}

      <DeviceTable devices={devices} />
    </div>
  );
}
```

**Step 6: Verify device CRUD**

1. Register a new account (creates tenant)
2. Go to `/devices`
3. Add a device with name and IMEI
4. Verify it appears in the table
5. Delete it

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: device management CRUD

- API routes for list, create, update, delete devices
- Devices synced to Traccar on create/delete
- Tenant isolation enforced on all operations
- Device limit enforcement per tenant
- Device table and form components"
```

---

## Task 7: Real-Time Map with Mapbox + WebSocket

**Files:**
- Install: `mapbox-gl`, `ws`
- Create: `src/lib/websocket.ts`
- Create: `src/hooks/usePositions.ts`
- Create: `src/components/map/tracking-map.tsx`
- Create: `src/app/api/positions/route.ts`
- Modify: `src/app/(dashboard)/map/page.tsx`

**Step 1: Install dependencies**

```bash
npm install mapbox-gl ws
npm install -D @types/ws
```

**Step 2: Create `src/lib/websocket.ts`** — server-side Traccar WS bridge

```typescript
import WebSocket from "ws";
import { redis, redisPub } from "./redis";
import { db } from "./db";

let traccarWs: WebSocket | null = null;
let reconnectTimer: NodeJS.Timeout | null = null;

interface TraccarMessage {
  positions?: Array<{
    deviceId: number;
    latitude: number;
    longitude: number;
    speed: number;
    course: number;
    attributes: Record<string, unknown>;
    fixTime: string;
  }>;
}

// Build device-to-tenant mapping in Redis
async function syncDeviceTenantMap() {
  const devices = await db.device.findMany({
    where: { traccarId: { not: null } },
    select: { traccarId: true, tenantId: true },
  });

  const pipeline = redis.pipeline();
  for (const device of devices) {
    pipeline.set(`device:tenant:${device.traccarId}`, device.tenantId);
  }
  await pipeline.exec();
  console.log(`[WS] Synced ${devices.length} device-tenant mappings`);
}

function connect() {
  const wsUrl = process.env.TRACCAR_WS_URL || "ws://localhost:8082/api/socket";

  // Authenticate first to get cookie
  fetch(`${process.env.TRACCAR_API_URL || "http://localhost:8082/api"}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      email: process.env.TRACCAR_ADMIN_EMAIL || "",
      password: process.env.TRACCAR_ADMIN_PASSWORD || "",
    }),
  })
    .then((res) => {
      const cookie = res.headers.get("set-cookie")?.split(";")[0] || "";
      traccarWs = new WebSocket(wsUrl, { headers: { Cookie: cookie } });

      traccarWs.on("open", () => {
        console.log("[WS] Connected to Traccar");
        syncDeviceTenantMap();
      });

      traccarWs.on("message", async (data) => {
        try {
          const message: TraccarMessage = JSON.parse(data.toString());
          if (message.positions) {
            await handlePositions(message.positions);
          }
        } catch (err) {
          console.error("[WS] Parse error:", err);
        }
      });

      traccarWs.on("close", () => {
        console.log("[WS] Disconnected from Traccar. Reconnecting in 5s...");
        reconnectTimer = setTimeout(connect, 5000);
      });

      traccarWs.on("error", (err) => {
        console.error("[WS] Error:", err.message);
      });
    })
    .catch((err) => {
      console.error("[WS] Auth error:", err.message);
      reconnectTimer = setTimeout(connect, 5000);
    });
}

async function handlePositions(
  positions: TraccarMessage["positions"] & {}
) {
  const pipeline = redis.pipeline();

  for (const pos of positions) {
    const posData = JSON.stringify({
      deviceId: pos.deviceId,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      course: pos.course,
      fixTime: pos.fixTime,
      attributes: pos.attributes,
    });

    // Cache latest position
    pipeline.set(`device:pos:${pos.deviceId}`, posData, "EX", 300);

    // Get tenant for this device and publish
    const tenantId = await redis.get(`device:tenant:${pos.deviceId}`);
    if (tenantId) {
      pipeline.publish(`tenant:${tenantId}`, posData);
    }
  }

  await pipeline.exec();
}

export function startTraccarBridge() {
  connect();
}

export function stopTraccarBridge() {
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (traccarWs) traccarWs.close();
}
```

**Step 3: Create `src/app/api/positions/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { redis } from "@/lib/redis";
import { db } from "@/lib/db";

// GET /api/positions — get current positions for tenant's devices
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { tenantId, role } = session.user as any;

  // Get tenant's devices
  const where = role === "super_admin" ? { traccarId: { not: null } } : { tenantId, traccarId: { not: null } };
  const devices = await db.device.findMany({
    where,
    select: { id: true, traccarId: true, name: true, vehiclePlate: true },
  });

  // Get positions from Redis
  const positions = [];
  for (const device of devices) {
    const posData = await redis.get(`device:pos:${device.traccarId}`);
    if (posData) {
      positions.push({
        ...JSON.parse(posData),
        deviceName: device.name,
        vehiclePlate: device.vehiclePlate,
        globoDeviceId: device.id,
      });
    }
  }

  return NextResponse.json(positions);
}
```

**Step 4: Create `src/hooks/usePositions.ts`**

```typescript
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface Position {
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  fixTime: string;
  deviceName: string;
  vehiclePlate: string | null;
  globoDeviceId: string;
}

export function usePositions() {
  const [positions, setPositions] = useState<Map<number, Position>>(new Map());
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Load initial positions via REST
  const loadInitial = useCallback(async () => {
    try {
      const res = await fetch("/api/positions");
      if (res.ok) {
        const data: Position[] = await res.json();
        const map = new Map<number, Position>();
        data.forEach((p) => map.set(p.deviceId, p));
        setPositions(map);
      }
    } catch (err) {
      console.error("Failed to load positions:", err);
    }
  }, []);

  // Poll for updates (SSE or polling fallback)
  useEffect(() => {
    loadInitial();

    // Poll every 3 seconds for new positions
    const interval = setInterval(loadInitial, 3000);

    return () => clearInterval(interval);
  }, [loadInitial]);

  return {
    positions: Array.from(positions.values()),
    connected: true,
    refresh: loadInitial,
  };
}
```

Note: This starts with polling. We upgrade to Server-Sent Events (SSE) or WebSocket in a later task. Polling every 3s is sufficient for MVP since GPS devices report every 10-30s.

**Step 5: Create `src/components/map/tracking-map.tsx`**

```tsx
"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { usePositions } from "@/hooks/usePositions";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

export function TrackingMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<Map<number, mapboxgl.Marker>>(new Map());
  const { positions } = usePositions();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-99.13, 19.43], // Default: Mexico City
      zoom: 12,
    });

    mapRef.current.addControl(new mapboxgl.NavigationControl(), "top-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers when positions change
  useEffect(() => {
    if (!mapRef.current) return;

    const currentDeviceIds = new Set(positions.map((p) => p.deviceId));

    // Remove markers for devices no longer in positions
    markersRef.current.forEach((marker, deviceId) => {
      if (!currentDeviceIds.has(deviceId)) {
        marker.remove();
        markersRef.current.delete(deviceId);
      }
    });

    // Add or update markers
    positions.forEach((pos) => {
      const existing = markersRef.current.get(pos.deviceId);

      if (existing) {
        existing.setLngLat([pos.longitude, pos.latitude]);
        // Update popup content
        existing.getPopup()?.setHTML(popupHtml(pos));
      } else {
        const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
          popupHtml(pos)
        );

        const marker = new mapboxgl.Marker({
          color: pos.speed > 0 ? "#22c55e" : "#a1a1aa",
        })
          .setLngLat([pos.longitude, pos.latitude])
          .setPopup(popup)
          .addTo(mapRef.current!);

        markersRef.current.set(pos.deviceId, marker);
      }
    });
  }, [positions]);

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden border">
      <div ref={mapContainer} className="w-full h-full" />
      <div className="absolute top-3 left-3 bg-white px-3 py-1 rounded-md shadow text-sm">
        {positions.length} device{positions.length !== 1 ? "s" : ""} online
      </div>
    </div>
  );
}

function popupHtml(pos: {
  deviceName: string;
  vehiclePlate: string | null;
  speed: number;
  fixTime: string;
}) {
  return `
    <div style="font-family: sans-serif; font-size: 13px;">
      <strong>${pos.deviceName}</strong>
      ${pos.vehiclePlate ? `<br/>${pos.vehiclePlate}` : ""}
      <br/>Speed: ${Math.round(pos.speed)} km/h
      <br/><span style="color: #888;">${new Date(pos.fixTime).toLocaleTimeString()}</span>
    </div>
  `;
}
```

**Step 6: Update `src/app/(dashboard)/map/page.tsx`**

```tsx
import { TrackingMap } from "@/components/map/tracking-map";

export default function MapPage() {
  return (
    <div className="h-[calc(100vh-8rem)]">
      <TrackingMap />
    </div>
  );
}
```

**Step 7: Verify the map loads**

```bash
npm run dev
```

Visit `http://localhost:3000/map`. You should see:
- Full-screen Mapbox map
- "0 devices online" badge (no GPS devices sending data yet)
- Navigation controls on top-right

**Step 8: Commit**

```bash
git add -A
git commit -m "feat: real-time GPS tracking map

- Traccar WebSocket bridge writes positions to Redis
- Redis Pub/Sub routes positions per tenant
- /api/positions endpoint reads from Redis cache
- usePositions hook with polling (3s interval)
- Mapbox GL map with dynamic markers
- Green markers for moving, gray for stationary
- Device info popups on click"
```

---

## Task 8: Seed Data + Super Admin Setup

**Files:**
- Create: `prisma/seed.ts`
- Modify: `package.json` (add seed script)

**Step 1: Create `prisma/seed.ts`**

```typescript
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Create plans
  const basicPlan = await prisma.plan.upsert({
    where: { name: "Basic" },
    update: {},
    create: {
      name: "Basic",
      maxDevices: 5,
      price: 999, // $9.99
      interval: "monthly",
      features: ["real-time tracking", "5 devices"],
    },
  });

  const proPlan = await prisma.plan.upsert({
    where: { name: "Pro" },
    update: {},
    create: {
      name: "Pro",
      maxDevices: 50,
      price: 4999, // $49.99
      interval: "monthly",
      features: ["real-time tracking", "50 devices", "geofences", "reports"],
    },
  });

  const enterprisePlan = await prisma.plan.upsert({
    where: { name: "Enterprise" },
    update: {},
    create: {
      name: "Enterprise",
      maxDevices: 500,
      price: 19999, // $199.99
      interval: "monthly",
      features: ["real-time tracking", "500 devices", "geofences", "reports", "api access", "priority support"],
    },
  });

  // Create super admin (no tenant)
  const hashedPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@globo.app" },
    update: {},
    create: {
      email: "admin@globo.app",
      password: hashedPassword,
      name: "Globo Admin",
      role: "super_admin",
      tenantId: null,
    },
  });

  console.log("Seed complete: 3 plans + super admin created");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

**Step 2: Add seed config to `package.json`**

Add to `package.json`:

```json
{
  "prisma": {
    "seed": "npx tsx prisma/seed.ts"
  }
}
```

**Step 3: Install tsx and run seed**

```bash
npm install -D tsx
npx prisma db seed
```

Expected: "Seed complete: 3 plans + super admin created"

**Step 4: Verify**

Login with `admin@globo.app` / `admin123`. Should see super admin sidebar with Tenants and Plans links.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: seed data with plans and super admin

- 3 plans: Basic ($9.99), Pro ($49.99), Enterprise ($199.99)
- Super admin account: admin@globo.app
- Seed script via prisma db seed"
```

---

## Task 9: Super Admin Panel (Tenant Management)

**Files:**
- Create: `src/app/admin/layout.tsx`
- Create: `src/app/admin/tenants/page.tsx`
- Create: `src/app/api/admin/tenants/route.ts`
- Create: `src/app/admin/plans/page.tsx`

**Step 1: Create `src/app/admin/layout.tsx`**

```tsx
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  const role = (session.user as any)?.role;
  if (role !== "super_admin") redirect("/map");

  return (
    <div className="flex min-h-screen">
      <Sidebar role={role} />
      <div className="flex-1 flex flex-col">
        <Header />
        <main className="flex-1 p-6 bg-zinc-50">{children}</main>
      </div>
    </div>
  );
}
```

**Step 2: Create `src/app/api/admin/tenants/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenants = await db.tenant.findMany({
    include: {
      _count: { select: { devices: true, users: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(tenants);
}
```

**Step 3: Create `src/app/admin/tenants/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  maxDevices: number;
  createdAt: string;
  _count: { devices: number; users: number };
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);

  useEffect(() => {
    fetch("/api/admin/tenants")
      .then((res) => res.json())
      .then(setTenants);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Tenants</h1>
      <div className="bg-white rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-zinc-50">
              <th className="text-left p-3 font-medium">Name</th>
              <th className="text-left p-3 font-medium">Slug</th>
              <th className="text-left p-3 font-medium">Status</th>
              <th className="text-left p-3 font-medium">Devices</th>
              <th className="text-left p-3 font-medium">Users</th>
              <th className="text-left p-3 font-medium">Max Devices</th>
              <th className="text-left p-3 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{tenant.name}</td>
                <td className="p-3 text-zinc-500">{tenant.slug}</td>
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs ${
                      tenant.status === "active"
                        ? "bg-green-100 text-green-700"
                        : tenant.status === "trial"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {tenant.status}
                  </span>
                </td>
                <td className="p-3">{tenant._count.devices}</td>
                <td className="p-3">{tenant._count.users}</td>
                <td className="p-3">{tenant.maxDevices}</td>
                <td className="p-3 text-zinc-500">
                  {new Date(tenant.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {tenants.length === 0 && (
              <tr>
                <td colSpan={7} className="p-8 text-center text-zinc-400">
                  No tenants registered yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

**Step 4: Create `src/app/admin/plans/page.tsx`**

```tsx
"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  name: string;
  maxDevices: number;
  price: number;
  interval: string;
  active: boolean;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    fetch("/api/admin/plans")
      .then((res) => res.json())
      .then(setPlans);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Plans</h1>
      <div className="grid grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="bg-white p-6 rounded-lg border">
            <h3 className="text-lg font-bold">{plan.name}</h3>
            <p className="text-3xl font-bold mt-2">
              ${(plan.price / 100).toFixed(2)}
              <span className="text-sm text-zinc-500 font-normal">/{plan.interval}</span>
            </p>
            <p className="text-sm text-zinc-500 mt-2">
              Up to {plan.maxDevices} devices
            </p>
            <span
              className={`inline-block mt-3 px-2 py-1 rounded-full text-xs ${
                plan.active ? "bg-green-100 text-green-700" : "bg-zinc-100 text-zinc-500"
              }`}
            >
              {plan.active ? "Active" : "Inactive"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Create `src/app/api/admin/plans/route.ts`**

```typescript
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session || (session.user as any).role !== "super_admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const plans = await db.plan.findMany({ orderBy: { price: "asc" } });
  return NextResponse.json(plans);
}
```

**Step 6: Verify**

Login as `admin@globo.app`, visit `/admin/tenants` and `/admin/plans`.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: super admin panel for tenant and plan management

- Admin layout with role-based access guard
- Tenants list with device/user counts
- Plans overview with pricing cards
- Admin-only API routes"
```

---

## Summary: MVP Task Order

| Task | What it builds | Depends on |
|---|---|---|
| 1 | Project scaffolding + Docker | Nothing |
| 2 | Database schema (Prisma) | Task 1 |
| 3 | Redis + Traccar clients | Task 1 |
| 4 | Authentication (NextAuth) | Task 2 |
| 5 | UI Foundation + Layout | Task 4 |
| 6 | Device CRUD | Tasks 3, 5 |
| 7 | Real-time Map | Tasks 3, 6 |
| 8 | Seed data | Task 2 |
| 9 | Super Admin panel | Tasks 5, 8 |

After Task 9, you have a working MVP: users can register, add GPS devices, and see them moving on a real-time map. Super admin can manage all tenants and plans.
