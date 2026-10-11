import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";
import { isLineOaReplyEvent, lineOaWelcomeLinks, lineOaWelcomeMessage, verifyLineSignature } from "../src/server/line-oa.ts";

test("replies to every incoming message and follows, but not unrelated events", () => {
  for (const message of [
    { type: "text", text: "สวัสดี" },
    { type: "text", text: "ข้อความอื่น" },
    { type: "image" },
    { type: "sticker" }
  ]) {
    assert.equal(isLineOaReplyEvent({ type: "message", replyToken: "reply-1", message }), true);
  }
  assert.equal(isLineOaReplyEvent({ type: "follow", replyToken: "reply-2" }), true);
  assert.equal(isLineOaReplyEvent({ type: "unfollow", replyToken: "reply-3" }), false);
  assert.equal(isLineOaReplyEvent({ type: "postback", replyToken: "reply-4" }), false);
  assert.equal(isLineOaReplyEvent({ type: "message", replyToken: "" }), false);
  assert.equal(isLineOaReplyEvent(null), false);
});

test("accepts only the signature of the unchanged webhook body", () => {
  const body = '{"events":[{"type":"follow"}]}';
  const secret = "test-channel-secret";
  const signature = createHmac("sha256", secret).update(body).digest("base64");
  assert.equal(verifyLineSignature(body, signature, secret), true);
  assert.equal(verifyLineSignature(`${body} `, signature, secret), false);
  assert.equal(verifyLineSignature(body, signature, "different-secret"), false);
  assert.equal(verifyLineSignature(body, null, secret), false);
});

test("requires an HTTPS public origin for LINE artwork", () => {
  assert.equal(lineOaWelcomeLinks("http://localhost:3311", "1234567890-abcd"), null);
  assert.equal(lineOaWelcomeLinks("https://example.com/path", "1234567890-abcd"), null);
  assert.deepEqual(lineOaWelcomeLinks("https://demo.example.com", "1234567890-abcd"), {
    liffUrl: "https://liff.line.me/1234567890-abcd",
    imageUrl: "https://demo.example.com/line-oa/intro-image"
  });
});

test("both the welcome image and button open the same LIFF URL", () => {
  const message = lineOaWelcomeMessage("https://liff.line.me/1234567890-abcd", "https://demo.example.com/line-oa/intro-image");
  assert.equal(message.type, "flex");
  assert.equal(message.contents.hero.action.uri, "https://liff.line.me/1234567890-abcd");
  assert.equal(message.contents.footer.contents[0].action.uri, message.contents.hero.action.uri);
});
