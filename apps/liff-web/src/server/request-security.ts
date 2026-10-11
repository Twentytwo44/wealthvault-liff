import type { NextRequest } from "next/server";

export function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  const configuredOrigin = process.env.APP_ORIGIN;
  if (!configuredOrigin) {
    return process.env.NODE_ENV === "development" && origin === request.nextUrl.origin;
  }

  try {
    const expected = new URL(configuredOrigin);
    if (process.env.NODE_ENV === "production" && expected.protocol !== "https:") return false;
    return origin === expected.origin;
  } catch {
    return false;
  }
}
