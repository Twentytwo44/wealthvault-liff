import { NextResponse } from "next/server";
import { checkRedisHealth } from "@/server/session-store";
import { backendBaseUrl } from "@/server/backend-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function localTestConfigured(): boolean {
  if (process.env.NODE_ENV !== "development" || process.env.ALLOW_LOCAL_TEST_LOGIN !== "true" ||
      process.env.NEXT_PUBLIC_LOCAL_TEST_LOGIN !== "true") return false;
  try {
    const origin = new URL(process.env.APP_ORIGIN ?? "");
    return origin.protocol === "http:" && (origin.hostname === "localhost" || origin.hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export async function GET() {
  const configured = Boolean(
    process.env.APP_ORIGIN &&
    ((process.env.NEXT_PUBLIC_LIFF_ID && process.env.WEALTHVAULT_LIFF_CHANNEL_ID) || localTestConfigured()) &&
    backendBaseUrl() &&
    process.env.REDIS_URL
  );
  if (!configured) return NextResponse.json({ status: "not_ready" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  try {
    await checkRedisHealth();
    const backend = await fetch(new URL("health", backendBaseUrl()!), { cache: "no-store", signal: AbortSignal.timeout(2_000) });
    if (!backend.ok) throw new Error("backend unavailable");
    return NextResponse.json({ status: "ready" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "not_ready" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
