import Redis from "ioredis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
  redisSub: Redis | undefined;
  redisPub: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis(process.env.REDIS_URL || "redis://localhost:6379");

// Separate connections for Pub/Sub (Redis requirement)
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
