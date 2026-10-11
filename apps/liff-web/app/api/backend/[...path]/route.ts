import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/server/request-security";
import { checkRateLimit, getSession, refreshSessionTokens } from "@/server/session-store";
import { backendBaseUrl } from "@/server/backend-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__Host-wv_session";
const MAX_JSON_BYTES = 1_048_576;
const MAX_MULTIPART_BYTES = 8_388_608;
const MAX_RESPONSE_BYTES = 5_242_880;
const SAFE_HEADERS = ["accept", "accept-language"] as const;

type RouteRule = { path: RegExp; methods: ReadonlySet<string> };
const rules: RouteRule[] = [
  { path: /^dashboard$/, methods: new Set(["GET"]) },
  ...["account", "cash", "invest", "insurance", "land", "building"].flatMap((type) => [
    { path: new RegExp(`^asset/${type}/?$`), methods: new Set(["GET", "POST"]) },
    { path: new RegExp(`^asset/${type}/[A-Za-z0-9_-]{1,100}/?$`), methods: new Set(["GET", "PATCH", "DELETE"]) }
  ]),
  { path: /^lia\/?$/, methods: new Set(["GET", "POST"]) },
  { path: /^lia\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["GET", "PATCH", "DELETE"]) },
  { path: /^user\/?$/, methods: new Set(["GET", "PATCH"]) },
  { path: /^user\/search$/, methods: new Set(["POST"]) },
  { path: /^closefriend\/?$/, methods: new Set(["GET", "POST"]) },
  { path: /^friend\/?$/, methods: new Set(["GET", "POST"]) },
  { path: /^friend\/pending\/?$/, methods: new Set(["GET"]) },
  { path: /^friend\/accept\/?$/, methods: new Set(["POST"]) },
  { path: /^friend\/item\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["DELETE"]) },
  { path: /^friend\/(?!pending\/?$|accept\/?$|item\/)[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["DELETE"]) },
  { path: /^friend\/[A-Za-z0-9_-]{1,100}\/item\/?$/, methods: new Set(["GET"]) },
  { path: /^friend\/[A-Za-z0-9_-]{1,100}\/msg\/?$/, methods: new Set(["GET"]) },
  { path: /^friend\/[A-Za-z0-9_-]{1,100}\/profile\/?$/, methods: new Set(["GET"]) },
  { path: /^group\/?$/, methods: new Set(["GET", "POST"]) },
  { path: /^group\/detail\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["GET"]) },
  { path: /^group\/member\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["GET"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["PATCH", "DELETE"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/addmember\/?$/, methods: new Set(["POST"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/grantaccess\/?$/, methods: new Set(["POST"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/leave\/?$/, methods: new Set(["DELETE"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/removemember\/?$/, methods: new Set(["DELETE"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/msg\/?$/, methods: new Set(["GET"]) },
  { path: /^group\/[A-Za-z0-9_-]{1,100}\/item\/?$/, methods: new Set(["GET"]) },
  { path: /^group\/item\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["DELETE"]) },
  { path: /^share\/(friend|group)\/[A-Za-z0-9_-]{1,100}\/selection\/?$/, methods: new Set(["GET"]) },
  { path: /^share\/item\/?$/, methods: new Set(["POST"]) },
  { path: /^share\/item\/[A-Za-z0-9_-]{1,100}\/?$/, methods: new Set(["GET"]) },
  { path: /^share\/item\/(account|cash|invest|investment|insurance|land|building|liability)\/[A-Za-z0-9_-]{1,100}\/shared-targets\/?$/, methods: new Set(["GET"]) },
  { path: /^notifications\/?$/, methods: new Set(["GET"]) },
  { path: /^notifications\/read-all\/?$/, methods: new Set(["PUT"]) },
  { path: /^notifications\/[A-Za-z0-9_-]{1,100}\/read\/?$/, methods: new Set(["PUT"]) }
];

function allowed(path: string, method: string): boolean {
  return rules.some((rule) => rule.path.test(path) && rule.methods.has(method));
}

async function readLimitedBody(request: NextRequest, limit: number): Promise<Uint8Array | null> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > limit) return null;
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function boundedResponse(response: Response): Promise<Uint8Array | null> {
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        return null;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function error(code: string, status: number): NextResponse {
  return NextResponse.json({ code }, { status, headers: { "Cache-Control": "no-store" } });
}

function bodyBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function POST(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function PUT(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  return proxy(request, context);
}

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const method = request.method.toUpperCase();
  if (method !== "GET" && !isSameOrigin(request)) return error("invalid_origin", 403);

  const { path: segments } = await context.params;
  if (!segments.length || segments.some((part) => !/^[A-Za-z0-9_-]{1,100}$/.test(part))) return error("invalid_path", 400);
  const path = segments.join("/");
  if (!allowed(path, method)) return error("route_not_allowed", 404);
  if (request.nextUrl.search.length > 2_048) return error("query_too_large", 400);

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  const declaredLength = request.headers.get("content-length");
  const hasBody = method !== "GET" && (declaredLength !== null
    ? Number(declaredLength) > 0
    : request.body !== null && (contentType !== "" || request.headers.has("transfer-encoding")));
  let body: Uint8Array | undefined;
  if (hasBody) {
    if (!contentType.startsWith("application/json") && !contentType.startsWith("multipart/form-data") && !contentType.startsWith("application/x-www-form-urlencoded")) {
      return error("unsupported_media_type", 415);
    }
    const maxBody = contentType.startsWith("multipart/form-data") ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES;
    const limitedBody = await readLimitedBody(request, maxBody);
    if (!limitedBody) return error("request_too_large", 413);
    body = limitedBody;
  }

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) return error("unauthenticated", 401);
  try {
    const limit = await checkRateLimit(`api:${sessionId}`, 240, 60);
    if (!limit.allowed) {
      const response = error("rate_limited", 429);
      response.headers.set("Retry-After", String(limit.retryAfterSeconds));
      return response;
    }
  } catch {
    return error("session_unavailable", 503);
  }
  let session: Awaited<ReturnType<typeof getSession>>;
  try {
    session = await getSession(sessionId);
    if (session && session.accessTokenExpiresAt <= Date.now() + 30_000) {
      session = await refreshSessionTokens(sessionId);
    }
  } catch {
    return error("session_unavailable", 503);
  }
  if (!session) return error("session_expired", 401);

  const backendUrl = backendBaseUrl();
  if (!backendUrl) return error("backend_not_configured", 503);
  let upstreamUrl: URL;
  try {
    upstreamUrl = new URL(path, backendUrl);
  } catch {
    return error("backend_not_configured", 503);
  }
  request.nextUrl.searchParams.forEach((value, key) => upstreamUrl.searchParams.append(key, value));

  const send = async (accessToken: string) => {
    const headers = new Headers({ Accept: "application/json" });
    for (const name of SAFE_HEADERS) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    const idempotencyKey = request.headers.get("idempotency-key");
    if (method !== "GET" && idempotencyKey && /^[A-Za-z0-9_-]{16,80}$/.test(idempotencyKey)) {
      headers.set("Idempotency-Key", idempotencyKey);
    }
    headers.set("X-Request-ID", requestId);
    if (contentType) headers.set("Content-Type", request.headers.get("content-type")!);
    headers.set("Authorization", `Bearer ${accessToken}`);
    return fetch(upstreamUrl, {
      method,
      headers,
      body: hasBody && body ? bodyBuffer(body) : undefined,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(15_000)
    });
  };

  let upstream: Response;
  const requestId = randomUUID();
  const startedAt = performance.now();
  try {
    upstream = await send(session.accessToken);
    if (upstream.status === 401 && method === "GET") {
      const refreshed = await refreshSessionTokens(sessionId, true, session.accessToken);
      if (refreshed && refreshed.accessToken !== session.accessToken) upstream = await send(refreshed.accessToken);
    }
  } catch {
    return error("backend_unavailable", 502);
  }

  if (upstream.status === 204 || upstream.status === 304) {
    const response = new NextResponse(null, { status: upstream.status });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-ID", requestId);
    response.headers.set("Server-Timing", `upstream;dur=${Math.max(0, Math.round(performance.now() - startedAt))}`);
    return response;
  }

  const responseType = upstream.headers.get("content-type")?.toLowerCase() ?? "";
  if (!responseType.startsWith("application/json") && !responseType.startsWith("text/plain")) {
    return error("invalid_backend_response", 502);
  }
  const responseBody = await boundedResponse(upstream);
  if (!responseBody) return error("backend_response_too_large", 502);
  const response = new NextResponse(bodyBuffer(responseBody), { status: upstream.status });
  response.headers.set("Content-Type", responseType.split(";")[0] || "application/json");
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Request-ID", requestId);
  response.headers.set("Server-Timing", `upstream;dur=${Math.max(0, Math.round(performance.now() - startedAt))}`);
  return response;
}
