import { createHash, randomBytes } from "node:crypto";
import { createClient } from "redis";
import { z } from "zod";
import { SessionUserSchema, type SessionUser } from "@wealthvault/contracts/auth";
import { backendBaseUrl } from "./backend-url";

export type ServerSession = {
  user: SessionUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: number;
  absoluteExpiresAt: number;
};

type SessionRedisClient = ReturnType<typeof createClient>;
let redisPromise: Promise<SessionRedisClient> | undefined;
const ServerSessionSchema = z.object({
  user: SessionUserSchema,
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  accessTokenExpiresAt: z.number().finite(),
  absoluteExpiresAt: z.number().finite()
});

function boundedSeconds(name: string, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(process.env[name]);
  return Number.isFinite(parsed) ? Math.min(Math.max(Math.floor(parsed), minimum), maximum) : fallback;
}

async function redis(): Promise<SessionRedisClient> {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL is required");
  if (process.env.NODE_ENV === "production" && !url.startsWith("rediss://")) {
    throw new Error("REDIS_URL must use TLS in production");
  }
  redisPromise ??= (async () => {
    const client = createClient({ url });
    client.on("error", () => {
      // Do not log connection details; URLs may contain credentials.
    });
    try {
      await client.connect();
      return client;
    } catch (error) {
      await client.close().catch(() => undefined);
      throw error;
    }
  })();
  try {
    return await redisPromise;
  } catch (error) {
    redisPromise = undefined;
    throw error;
  }
}

function digest(sessionId: string): string {
  return createHash("sha256").update(sessionId).digest("hex");
}

export async function createSession(input: Omit<ServerSession, "accessTokenExpiresAt" | "absoluteExpiresAt"> & {
  accessTokenExpiresIn: number;
}): Promise<string> {
  const idleTtl = boundedSeconds("SESSION_IDLE_TTL_SECONDS", 1_800, 60, 7_200);
  const absoluteTtl = Math.max(boundedSeconds("SESSION_ABSOLUTE_TTL_SECONDS", 43_200, 60, 86_400), idleTtl);
  const now = Date.now();
  const session: ServerSession = {
    user: input.user,
    accessToken: input.accessToken,
    refreshToken: input.refreshToken,
    accessTokenExpiresAt: now + input.accessTokenExpiresIn * 1_000,
    absoluteExpiresAt: now + absoluteTtl * 1_000
  };

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const sessionId = randomBytes(32).toString("base64url");
    const result = await (await redis()).set(`wv:session:${digest(sessionId)}`, JSON.stringify(session), {
      EX: Math.min(idleTtl, absoluteTtl),
      NX: true
    });
    if (result === "OK") return sessionId;
  }
  throw new Error("Unable to allocate session");
}

export async function getSession(sessionId: string): Promise<ServerSession | null> {
  if (sessionId.length < 40 || sessionId.length > 80) return null;
  const client = await redis();
  const key = `wv:session:${digest(sessionId)}`;
  const raw = await client.get(key);
  if (!raw) return null;

  let decoded: unknown;
  try {
    decoded = JSON.parse(raw) as unknown;
  } catch {
    await client.del(key);
    return null;
  }
  const parsed = ServerSessionSchema.safeParse(decoded);
  if (!parsed.success) {
    await client.del(key);
    return null;
  }
  const session = parsed.data;

  const remainingSeconds = Math.floor((session.absoluteExpiresAt - Date.now()) / 1_000);
  if (remainingSeconds <= 0) {
    await client.del(key);
    return null;
  }
  const idleTtl = boundedSeconds("SESSION_IDLE_TTL_SECONDS", 1_800, 60, 7_200);
  await client.expire(key, Math.min(idleTtl, remainingSeconds));
  return session;
}

export async function deleteSession(sessionId: string): Promise<void> {
  if (sessionId.length < 40 || sessionId.length > 80) return;
  await (await redis()).del(`wv:session:${digest(sessionId)}`);
}

export async function checkRateLimit(key: string, maximum: number, windowSeconds: number): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const client = await redis();
  const safeKey = createHash("sha256").update(key).digest("hex");
  const redisKey = `wv:rate:${safeKey}`;
  const result = await client.eval(
    "local count = redis.call('INCR', KEYS[1]); if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end; return {count, redis.call('PTTL', KEYS[1])}",
    { keys: [redisKey], arguments: [String(windowSeconds * 1_000)] }
  );
  if (!Array.isArray(result)) throw new Error("Rate limit result unavailable");
  const count = Number(result[0]);
  const remaining = Number(result[1]);
  if (!Number.isFinite(count) || !Number.isFinite(remaining)) throw new Error("Rate limit result invalid");
  return {
    allowed: count <= maximum,
    retryAfterSeconds: Math.max(1, Math.ceil((remaining > 0 ? remaining : windowSeconds * 1_000) / 1_000))
  };
}

export async function checkRedisHealth(): Promise<void> {
  await (await redis()).ping();
}

export async function refreshSessionTokens(sessionId: string, force = false, staleAccessToken?: string): Promise<ServerSession | null> {
  if (sessionId.length < 40 || sessionId.length > 80) return null;
  const client = await redis();
  const sessionKey = `wv:session:${digest(sessionId)}`;
  const lockKey = `${sessionKey}:refresh`;
  const lockValue = randomBytes(24).toString("base64url");
  const initial = await getSession(sessionId);
  if (!initial) return null;
  // Another request may already have rotated the token while this request was in flight.
  if (staleAccessToken && initial.accessToken !== staleAccessToken && initial.accessTokenExpiresAt > Date.now() + 5_000) return initial;
  if (!force && initial.accessTokenExpiresAt > Date.now() + 30_000) return initial;

  let acquired = false;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const current = await getSession(sessionId);
    if (!current) return null;
    if (current.accessToken !== initial.accessToken && current.accessTokenExpiresAt > Date.now() + 5_000) return current;
    const result = await client.set(lockKey, lockValue, { NX: true, PX: 8_000 });
    if (result === "OK") {
      acquired = true;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!acquired) return null;

  try {
    const current = await getSession(sessionId);
    if (!current) return null;
    if (current.accessToken !== initial.accessToken && current.accessTokenExpiresAt > Date.now() + 5_000) return current;

    const backendUrl = backendBaseUrl();
    if (!backendUrl) return null;
    const response = await fetch(new URL("auth/refresh", backendUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshtoken: current.refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000)
    });
    if (!response.ok) return null;
    const decoded: unknown = await response.json();
    if (typeof decoded !== "object" || decoded === null || !("data" in decoded)) return null;
    const data = decoded.data;
    if (typeof data !== "object" || data === null || !("access_token" in data) || !("refresh_token" in data)) return null;
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    if (typeof accessToken !== "string" || !accessToken || typeof refreshToken !== "string" || !refreshToken) return null;
    const accessTokenExpiresIn =
      "access_token_expires_in" in data && typeof data.access_token_expires_in === "number" && Number.isFinite(data.access_token_expires_in)
        ? Math.min(Math.max(Math.floor(data.access_token_expires_in), 60), 86_400)
        : 300;

    const updated: ServerSession = {
      ...current,
      accessToken,
      refreshToken,
      accessTokenExpiresAt: Date.now() + accessTokenExpiresIn * 1_000
    };
    const remainingSeconds = Math.floor((updated.absoluteExpiresAt - Date.now()) / 1_000);
    if (remainingSeconds <= 0) return null;
    const idleTtl = boundedSeconds("SESSION_IDLE_TTL_SECONDS", 1_800, 60, 7_200);
    const saved = await client.set(sessionKey, JSON.stringify(updated), {
      XX: true,
      EX: Math.min(idleTtl, remainingSeconds)
    });
    return saved === "OK" ? updated : null;
  } catch {
    return null;
  } finally {
    await client.eval(
      "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
      { keys: [lockKey], arguments: [lockValue] }
    ).catch(() => undefined);
  }
}
