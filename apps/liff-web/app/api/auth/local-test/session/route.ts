import { NextResponse, type NextRequest } from "next/server";
import { backendBaseUrl } from "@/server/backend-url";
import { isSameOrigin } from "@/server/request-security";
import { checkRateLimit, createSession } from "@/server/session-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__Host-wv_session";
const MAX_BODY_BYTES = 4_096;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

function localRequestOnly(request: NextRequest): boolean {
  const hostHeader = request.headers.get("host");
  const originHeader = request.headers.get("origin");
  if (!hostHeader || !originHeader || !isSameOrigin(request)) return false;
  try {
    const host = new URL(`http://${hostHeader}`);
    const origin = new URL(originHeader);
    const forwardedHost = request.headers.get("x-forwarded-host");
    return LOOPBACK_HOSTS.has(host.hostname) && origin.origin === host.origin &&
      (!forwardedHost || forwardedHost.toLowerCase() === hostHeader.toLowerCase()) &&
      request.headers.get("x-forwarded-proto")?.toLowerCase() !== "https";
  } catch {
    return false;
  }
}

async function readBoundedJson(request: NextRequest): Promise<unknown | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV !== "development" || process.env.ALLOW_LOCAL_TEST_LOGIN !== "true") {
    return NextResponse.json({ code: "not_found" }, { status: 404 });
  }
  if (!localRequestOnly(request)) return NextResponse.json({ code: "local_only" }, { status: 403 });
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ code: "unsupported_media_type" }, { status: 415 });
  }
  try {
    const limit = await checkRateLimit("local-test-login", 10, 300);
    if (!limit.allowed) {
      return NextResponse.json({ code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
  } catch {
    return NextResponse.json({ code: "session_unavailable" }, { status: 503 });
  }

  const body = await readBoundedJson(request);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ code: "invalid_credentials" }, { status: 400 });
  }
  const email = "email" in body && typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = "password" in body && typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255 || password.length < 8 || password.length > 72) {
    return NextResponse.json({ code: "invalid_credentials" }, { status: 400 });
  }

  const backendUrl = backendBaseUrl();
  if (!backendUrl) return NextResponse.json({ code: "backend_not_configured" }, { status: 503 });
  let upstream: Response;
  try {
    upstream = await fetch(new URL("auth/login", backendUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(5_000)
    });
  } catch {
    return NextResponse.json({ code: "backend_unavailable" }, { status: 503 });
  }
  if (!upstream.ok) return NextResponse.json({ code: "invalid_credentials" }, { status: 401 });

  let decoded: unknown;
  try {
    const raw = await upstream.text();
    if (Buffer.byteLength(raw, "utf8") > 16_384) throw new Error("oversized login response");
    decoded = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ code: "invalid_auth_response" }, { status: 502 });
  }
  const data = typeof decoded === "object" && decoded !== null && "data" in decoded ? decoded.data : null;
  if (typeof data !== "object" || data === null || !("user_id" in data) || !("access_token" in data) || !("refresh_token" in data) ||
      typeof data.user_id !== "string" || !data.user_id || typeof data.access_token !== "string" || !data.access_token ||
      typeof data.refresh_token !== "string" || !data.refresh_token) {
    return NextResponse.json({ code: "invalid_auth_response" }, { status: 502 });
  }

  try {
    const user = { id: data.user_id, displayName: email };
    const sessionId = await createSession({ user, accessToken: data.access_token, refreshToken: data.refresh_token, accessTokenExpiresIn: 900 });
    const response = NextResponse.json({ status: "authenticated", user }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set({
      name: SESSION_COOKIE,
      value: sessionId,
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      path: "/",
      maxAge: Math.min(Math.max(Number(process.env.SESSION_ABSOLUTE_TTL_SECONDS ?? 43_200), 60), 86_400)
    });
    return response;
  } catch {
    return NextResponse.json({ code: "session_unavailable" }, { status: 503 });
  }
}
