import { isLineOaReplyEvent, lineOaWelcomeLinks, lineOaWelcomeMessage, verifyLineSignature } from "@/server/line-oa";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const channelSecret = process.env.LINE_OA_CHANNEL_SECRET;
  const channelAccessToken = process.env.LINE_OA_CHANNEL_ACCESS_TOKEN;
  if (!channelSecret || !channelAccessToken) return Response.json({ error: "LINE OA is not configured" }, { status: 503 });

  if (Number(request.headers.get("content-length")) > 64_000) return new Response(null, { status: 413 });
  const body = await request.text();
  if (body.length > 64_000) return new Response(null, { status: 413 });
  if (!verifyLineSignature(body, request.headers.get("x-line-signature"), channelSecret)) {
    return new Response(null, { status: 401 });
  }

  let events: unknown[];
  try {
    const payload: unknown = JSON.parse(body);
    if (typeof payload !== "object" || payload === null || !Array.isArray((payload as { events?: unknown }).events)) {
      return new Response(null, { status: 400 });
    }
    events = (payload as { events: unknown[] }).events;
  } catch {
    return new Response(null, { status: 400 });
  }

  const welcomeEvents = events.filter(isLineOaReplyEvent);
  if (!welcomeEvents.length) return new Response(null, { status: 200 });

  const links = lineOaWelcomeLinks(process.env.APP_ORIGIN, process.env.NEXT_PUBLIC_LIFF_ID);
  if (!links) return Response.json({ error: "LINE OA welcome links are not configured" }, { status: 503 });

  try {
    for (const event of welcomeEvents) {
      const response = await fetch("https://api.line.me/v2/bot/message/reply", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${channelAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ replyToken: event.replyToken, messages: [lineOaWelcomeMessage(links.liffUrl, links.imageUrl)] }),
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      });
      if (!response.ok) {
        console.error("LINE OA welcome reply failed", { status: response.status });
        return new Response(null, { status: 502 });
      }
    }
  } catch {
    console.error("LINE OA welcome reply could not reach LINE");
    return new Response(null, { status: 502 });
  }

  return new Response(null, { status: 200 });
}
