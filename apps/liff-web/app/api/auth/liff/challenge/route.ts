import { NextResponse, type NextRequest } from "next/server";
import { LiffExchangeResponseSchema, type PublicLiffSession } from "@wealthvault/contracts/auth";
import { isSameOrigin } from "@/server/request-security";
import { checkRateLimit, createSession } from "@/server/session-store";
import { backendBaseUrl } from "@/server/backend-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__Host-wv_session";
const MAX_BODY_BYTES = 8_192;

type ChallengeInput = {
  challengeId: string;
  action: "link" | "register";
  email: string;
  password?: string;
  username?: string;
  firstName?: string;
  lastName?: string;
};

function invalid(code: string, status: number) {
  return NextResponse.json({ code }, { status, headers: { "Cache-Control": "no-store" } });
}

async function readBoundedText(request: NextRequest): Promise<string | "too_large" | null> {
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
        return "too_large";
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
  return new TextDecoder().decode(bytes);
}

export async function POST(request: NextRequest) {
  if (!isSameOrigin(request)) return invalid("invalid_origin", 403);
  try {
    const clientAddress = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-real-ip") ?? "unknown";
    const limit = await checkRateLimit(`liff-challenge:${clientAddress}`, 12, 300);
    if (!limit.allowed) return NextResponse.json({ code: "rate_limited" }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  } catch {
    return invalid("auth_unavailable", 503);
  }
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return invalid("unsupported_media_type", 415);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return invalid("request_too_large", 413);

  const raw = await readBoundedText(request);
  if (raw === "too_large") return invalid("request_too_large", 413);
  if (raw === null) return invalid("invalid_json", 400);
  let decoded: unknown;
  try { decoded = JSON.parse(raw) as unknown; }
  catch { return invalid("invalid_json", 400); }

  if (typeof decoded !== "object" || decoded === null) return invalid("invalid_challenge", 400);
  const input = decoded as Partial<ChallengeInput>;
  const email = typeof input.email === "string" ? input.email.trim().toLowerCase() : "";
  if (typeof input.challengeId !== "string" || input.challengeId.length < 16 || input.challengeId.length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return invalid("invalid_challenge", 400);
  }
  if (input.action !== "link" && input.action !== "register") return invalid("invalid_challenge", 400);
  if (input.action === "link") {
    const hasPassword = typeof input.password === "string" && input.password.length >= 8 && input.password.length <= 72;
    if (!hasPassword) return invalid("invalid_credentials", 400);
  } else if (
    typeof input.username !== "string" || input.username.trim().length < 3 || input.username.trim().length > 60 ||
    typeof input.password !== "string" || input.password.length < 8 || input.password.length > 72
  ) {
    return invalid("invalid_registration", 400);
  }

  const backendUrl = backendBaseUrl();
  const channelId = process.env.WEALTHVAULT_LIFF_CHANNEL_ID;
  if (!backendUrl || !channelId) return invalid("auth_not_configured", 503);

  let upstream: Response;
  try {
    upstream = await fetch(new URL("v2/auth/line/challenge/complete", backendUrl), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        action: input.action,
        challengeId: input.challengeId,
        channelId,
        email,
        password: input.password,
        username: input.username?.trim(),
        firstName: input.firstName?.trim(),
        lastName: input.lastName?.trim()
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000)
    });
  } catch {
    return invalid("auth_unavailable", 503);
  }
  if (!upstream.ok) return invalid(upstream.status === 401 || upstream.status === 422 ? "challenge_rejected" : "auth_unavailable", upstream.status === 401 || upstream.status === 422 ? 401 : 503);

  const responseText = await upstream.text();
  if (Buffer.byteLength(responseText, "utf8") > 16_384) return invalid("invalid_auth_response", 502);
  let responseBody: unknown;
  try { responseBody = JSON.parse(responseText) as unknown; }
  catch { return invalid("invalid_auth_response", 502); }
  const parsed = LiffExchangeResponseSchema.safeParse(responseBody);
  if (!parsed.success) return invalid("invalid_auth_response", 502);
  if (parsed.data.status !== "authenticated") {
    return NextResponse.json(parsed.data satisfies PublicLiffSession, { headers: { "Cache-Control": "no-store" } });
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
    return invalid("session_unavailable", 503);
  }
}
