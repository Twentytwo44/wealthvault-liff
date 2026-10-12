import assert from "node:assert/strict";
import test from "node:test";
import { buildChatTimeline } from "../src/features/app/social/chatTimeline.ts";

test("orders newest-first API messages as an oldest-to-newest chat", () => {
  const messages = [
    { id: "new", created_at: "2026-10-11T10:02:00Z" },
    { id: "old", created_at: "2026-10-11T10:01:00Z" }
  ];
  assert.deepEqual(buildChatTimeline(messages, []).map((entry) => entry.key), ["message:old", "message:new"]);
  assert.equal(messages[0].id, "new");
});

test("places a newly shared asset after older messages while its chat event is pending", () => {
  const timeline = buildChatTimeline(
    [{ id: "old", created_at: "2026-10-11T10:01:00Z" }],
    [{ id: "asset-1", asset_kind: "cash", shared_item_id: "share-1", shared_at: "2026-10-11T10:02:00Z" }]
  );
  assert.deepEqual(timeline.map((entry) => entry.key), ["message:old", "asset:share-1"]);
});

test("does not repeat a share that is already represented by a chat message", () => {
  const timeline = buildChatTimeline(
    [{ id: "event-1", sender_id: "user-1", created_at: "2026-10-11T10:02:00Z", metadata: { asset_id: "asset-1", asset_type: "cash", share_at: 1791712920 } }],
    [{ id: "asset-1", asset_kind: "cash", shared_by: "user-1", shared_item_id: "share-1", shared_at: "2026-10-11T10:02:00Z" }]
  );
  assert.deepEqual(timeline.map((entry) => entry.key), ["message:event-1"]);
});

test("keeps a new share of the same asset distinct from an older share event", () => {
  const timeline = buildChatTimeline(
    [{ id: "event-old", sender_id: "user-1", created_at: "2026-10-11T10:00:00Z", metadata: { asset_id: "asset-1", asset_type: "cash", share_at: 1791712800 } }],
    [{ id: "asset-1", asset_kind: "cash", shared_by: "user-1", shared_item_id: "share-new", shared_at: "2026-10-11T10:05:00Z" }]
  );
  assert.deepEqual(timeline.map((entry) => entry.key), ["message:event-old", "asset:share-new"]);
});
