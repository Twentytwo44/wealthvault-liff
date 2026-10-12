type ChatRecord = Record<string, unknown>;

export type ChatTimelineEntry =
  | { kind: "message"; key: string; message: ChatRecord; time: number; order: number }
  | { kind: "asset"; key: string; asset: ChatRecord; time: number; order: number };

function text(item: ChatRecord, ...keys: string[]): string {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value) return value;
  }
  return "";
}

function timeOf(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value !== "string" || !value) return Number.NaN;
  if (/^\d+$/.test(value)) return timeOf(Number(value));
  return Date.parse(value);
}

function assetType(value: string): string {
  const type = value.toLowerCase();
  return type === "investment" ? "invest" : type;
}

function metadataOf(message: ChatRecord): ChatRecord {
  const value = message.metadata;
  return value && typeof value === "object" && !Array.isArray(value) ? value as ChatRecord : {};
}

function representsShare(message: ChatRecord, asset: ChatRecord): boolean {
  const metadata = metadataOf(message);
  const assetId = text(asset, "id", "ID");
  if (!assetId || text(metadata, "asset_id") !== assetId) return false;
  const messageType = assetType(text(metadata, "asset_type", "type"));
  const currentType = assetType(text(asset, "asset_kind", "item_type", "type"));
  if (messageType && currentType && messageType !== currentType) return false;
  const sharer = text(asset, "shared_by");
  const sender = text(message, "sender_id", "user_id");
  if (sharer && sender && sharer !== sender) return false;

  const sharedAt = timeOf(asset.shared_at);
  const messageShareAt = timeOf(metadata.share_at);
  const messageAt = Number.isFinite(messageShareAt) ? messageShareAt : timeOf(message.created_at);
  // The share record and its chat event are written separately by the backend.
  return !Number.isFinite(sharedAt) || !Number.isFinite(messageAt) || Math.abs(sharedAt - messageAt) < 2000;
}

export function buildChatTimeline(messages: ChatRecord[], sharedAssets: ChatRecord[]): ChatTimelineEntry[] {
  const entries: ChatTimelineEntry[] = messages.map((message, index) => ({
    kind: "message", key: `message:${text(message, "id", "ID") || index}`, message,
    time: timeOf(message.created_at), order: index
  }));

  sharedAssets.forEach((asset, index) => {
    if (messages.some((message) => representsShare(message, asset))) return;
    entries.push({
      kind: "asset", key: `asset:${text(asset, "shared_item_id", "group_item_id") || `${text(asset, "asset_kind", "type")}:${text(asset, "id", "ID")}`}`,
      asset, time: timeOf(asset.shared_at), order: messages.length + index
    });
  });

  return entries.sort((left, right) => {
    const leftTime = Number.isFinite(left.time) ? left.time : Number.MAX_SAFE_INTEGER;
    const rightTime = Number.isFinite(right.time) ? right.time : Number.MAX_SAFE_INTEGER;
    return leftTime - rightTime || left.order - right.order;
  });
}
