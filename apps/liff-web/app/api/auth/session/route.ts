import { NextResponse, type NextRequest } from "next/server";
import { isSameOrigin } from "@/server/request-security";
import { deleteSession, getSession } from "@/server/session-store";
import { backendBaseUrl } from "@/server/backend-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "__Host-wv_session";

function clearCookie(response: NextResponse): void {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: true,
    sameSite: "strict",
    path: "/",
    maxAge: 0
  });
}

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  if (!sessionId) {
    return NextResponse.json({ status: "signed_out" }, { headers: { "Cache-Control": "no-store" } });
  }

  try {
    const session = await getSession(sessionId);
    if (session) {
      return NextResponse.json(
        { status: "authenticated", user: session.user },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
  } catch {
    return NextResponse.json({ code: "session_unavailable" }, { status: 503 });
  }

  const response = NextResponse.json({ status: "signed_out" }, { headers: { "Cache-Control": "no-store" } });
  clearCookie(response);
  return response;
}

export async function DELETE(request: NextRequest) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ code: "invalid_origin" }, { status: 403 });
  }

  const sessionId = request.cookies.get(SESSION_COOKIE)?.value;
  let session: Awaited<ReturnType<typeof getSession>> = null;
  if (sessionId) {
    try {
      session = await getSession(sessionId);
      await deleteSession(sessionId);
    } catch {
      const response = NextResponse.json(
        { status: "signed_out", revokePending: true },
        { headers: { "Cache-Control": "no-store" } }
      );
      clearCookie(response);
      return response;
    }
  }

  const backendUrl = backendBaseUrl();
  if (session?.refreshToken && backendUrl) {
    try {
      await fetch(new URL("v2/auth/session/revoke", backendUrl), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: session.refreshToken }),
        cache: "no-store",
        signal: AbortSignal.timeout(3_000)
      });
    } catch {
      // Local logout is authoritative for this browser even if remote revocation is unavailable.
    }
  }

  const response = NextResponse.json({ status: "signed_out" }, { headers: { "Cache-Control": "no-store" } });
  clearCookie(response);
  return response;
}
