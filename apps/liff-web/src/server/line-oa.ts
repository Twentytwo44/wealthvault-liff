import { createHmac, timingSafeEqual } from "node:crypto";

export function isLineOaReplyEvent(event: unknown): event is { type: "follow" | "message"; replyToken: string } {
  if (typeof event !== "object" || event === null) return false;
  const value = event as Record<string, unknown>;
  return typeof value.replyToken === "string" && value.replyToken.length > 0 &&
    (value.type === "follow" || value.type === "message");
}

export function verifyLineSignature(body: string, signature: string | null, channelSecret: string): boolean {
  if (!signature || !channelSecret) return false;
  const expected = createHmac("sha256", channelSecret).update(body).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

export function lineOaWelcomeLinks(originValue: string | undefined, liffId: string | undefined) {
  if (!originValue || !liffId || !/^[a-zA-Z0-9-]+$/.test(liffId)) return null;
  try {
    const origin = new URL(originValue);
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) return null;
    return {
      liffUrl: `https://liff.line.me/${liffId}`,
      imageUrl: new URL("/line-oa/intro-image", origin).toString()
    };
  } catch {
    return null;
  }
}

export function lineOaWelcomeMessage(liffUrl: string, imageUrl: string) {
  return {
    type: "flex" as const,
    altText: "ยินดีต้อนรับสู่ WealthVault จัดการทรัพย์สินและหนี้สินของคุณ เปิดแอปได้ที่นี่",
    contents: {
      type: "bubble" as const,
      hero: {
        type: "image" as const,
        url: imageUrl,
        size: "full",
        aspectRatio: "26:17",
        aspectMode: "cover",
        action: { type: "uri" as const, label: "เปิด WealthVault", uri: liffUrl }
      },
      body: {
        type: "box" as const,
        layout: "vertical" as const,
        spacing: "md",
        backgroundColor: "#FFF9F3",
        contents: [
          { type: "text" as const, text: "ยินดีต้อนรับสู่ WealthVault", weight: "bold" as const, size: "lg", color: "#4B3328", wrap: true },
          { type: "text" as const, text: "รวมทรัพย์สิน หนี้สิน และภาพรวมการเงินไว้ในที่เดียว พร้อมเลือกแชร์ข้อมูลกับคนที่คุณไว้ใจ", size: "sm", color: "#806B5E", wrap: true }
        ]
      },
      footer: {
        type: "box" as const,
        layout: "vertical" as const,
        backgroundColor: "#FFF9F3",
        contents: [{
          type: "button" as const,
          style: "primary" as const,
          color: "#A55F42",
          action: { type: "uri" as const, label: "เปิด WealthVault", uri: liffUrl }
        }]
      }
    }
  };
}
