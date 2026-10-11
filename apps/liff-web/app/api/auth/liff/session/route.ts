import { NextResponse, type NextRequest } from "next/server";
import { LiffExchangeResponseSchema, type PublicLiffSession } from "@wealthvault/contracts/auth";
import { isSameOrigin } from "@/server/request-security";
import { checkRateLimit, createSession } from "@/server/session-store";
import { backendBaseUrl } from "@/server/backend-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__Host-wv_session";
const MAX_BODY_BYTES = 8_192;

async function readBoundedJson(request: NextRequest): Promise<unknown | "too_large" | "invalid_json"> {
  if (!request.body) return "invalid_json";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > MAX_BODY_BYTES) {
        await reader.cancel();
        return "too_large";
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(byteLength);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  } catch {
    return "invalid_json";
  }
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  }
  try {
    const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
    const limit = await checkRateLimit(`liff-exchange:${clientAddress}`, 12, 300);
    if (!limit.allowed) {
      return NextResponse.json({ code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
    }
  } catch {
    return NextResponse.json({ code: "auth_unavailable" }, { status: 503 });
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ code: "unsupported_media_type" }, { status: 415 });
  }

  const body = await readBoundedJson(request);
  if (body === "too_large") {
    return NextResponse.json({ code: "request_too_large" }, { status: 413 });
  }
  if (body === "invalid_json") {
    return NextResponse.json({ code: "invalid_json" }, { status: 400 });
  }

  const idToken =
    typeof body === "object" && body !== null && "idToken" in body && typeof body.idToken === "string"
      ? body.idToken
      : "";
  const lineAccessToken =
    typeof body === "object" && body !== null && "accessToken" in body && typeof body.accessToken === "string"
      ? body.accessToken
      : "";
  if ((!idToken && !lineAccessToken) || (idToken && (idToken.length < 20 || idToken.length > 6_000)) ||
      (lineAccessToken && (lineAccessToken.length < 20 || lineAccessToken.length > 6_000))) {
    return NextResponse.json({ code: "invalid_id_token" }, { status: 400 });
  }

  const backendUrl = backendBaseUrl();
  const channelId = process.env.WEALTHVAULT_LIFF_CHANNEL_ID;
  if (!backendUrl || !channelId) {
    return NextResponse.json({ code: "auth_not_configured" }, { status: 503 });
  }

  const exchange = (lineToken: string) => fetch(new URL("v2/auth/line/exchange", backendUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ idToken: lineToken, channelId }),
    cache: "no-store",
    signal: AbortSignal.timeout(5_000)
  });

  let upstream: Response;
  try {
    upstream = await exchange(idToken || `line_access_token:${lineAccessToken}`);
    if (upstream.status === 401 && idToken && lineAccessToken) {
      upstream = await exchange(`line_access_token:${lineAccessToken}`);
    }
  } catch {
    return NextResponse.json({ code: "auth_unavailable" }, { status: 503 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ code: upstream.status === 401 ? "line_verification_failed" : "auth_unavailable" }, {
      status: upstream.status === 401 ? 401 : 503
    });
  }

  const responseText = await upstream.text();
  if (Buffer.byteLength(responseText, "utf8") > 16_384) {
    return NextResponse.json({ code: "invalid_auth_response" }, { status: 502 });
  }
  let responseBody: unknown;
  try {
    responseBody = JSON.parse(responseText) as unknown;
  } catch {
    responseBody = null;
  }
  const parsed = LiffExchangeResponseSchema.safeParse(responseBody);
  if (!parsed.success) {
    return NextResponse.json({ code: "invalid_auth_response" }, { status: 502 });
  }

  if (parsed.data.status !== "authenticated") {
    const publicResult: PublicLiffSession = parsed.data;
    return NextResponse.json(publicResult, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const sessionId = await createSession({
      user: parsed.data.user,
      accessToken: parsed.data.accessToken,
      refreshToken: parsed.data.refreshToken,
      accessTokenExpiresIn: parsed.data.accessTokenExpiresIn
    });
    const response = NextResponse.json(
      { status: "authenticated", user: parsed.data.user } satisfies PublicLiffSession,
      { headers: { "Cache-Control": "no-store" } }
    );
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
