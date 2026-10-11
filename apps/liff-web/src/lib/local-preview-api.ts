type PreviewBody = FormData | Record<string, unknown> | string | undefined;
type PreviewRecord = Record<string, unknown>;

let nextId = 1;
const id = () => `preview-${nextId++}`;

const assetStores: Record<string, PreviewRecord[]> = {
  account: [{ id: "account-1", type: "account", name: "บัญชีออมทรัพย์", bank_name: "ธนาคารตัวอย่าง", amount: 125000, description: "ข้อมูลตัวอย่าง" }],
  cash: [{ id: "cash-1", type: "cash", name: "เงินสำรองฉุกเฉิน", amount: 85000, description: "ข้อมูลตัวอย่าง" }],
  invest: [
    { id: "invest-1", type: "invest", name: "กองทุนดัชนีตัวอย่าง", symbol: "INDEX", amount: 240000, description: "ข้อมูลตัวอย่าง" },
    { id: "invest-stock-1", type: "invest", investment_type: "stock", name: "Apple Inc.", symbol: "AAPL", amount: 125000, description: "หุ้นตัวอย่าง" },
    { id: "invest-crypto-1", type: "invest", investment_type: "crypto", name: "Bitcoin", symbol: "BTC", amount: 85000, description: "คริปโตตัวอย่าง" }
  ],
  insurance: [{ id: "insurance-1", type: "insurance", name: "ประกันสุขภาพตัวอย่าง", company_name: "บริษัทตัวอย่าง", coverage_amount: 1000000 }],
  land: [{ id: "land-1", type: "land", name: "ที่ดินตัวอย่าง", province: "กรุงเทพมหานคร", amount: 900000 }],
  building: [{ id: "building-1", type: "building", name: "คอนโดตัวอย่าง", amount: 1800000 }],
  liability: [{ id: "debt-1", type: "liability", name: "สินเชื่อตัวอย่าง", creditor: "ธนาคารตัวอย่าง", principal: 520000 }]
};

const notifications: PreviewRecord[] = [
  { ID: "notice-1", Message: "ยินดีต้อนรับสู่ WealthVault โหมดตัวอย่าง", EntityType: "welcome", CreatedAt: "วันนี้", IsRead: false },
  { ID: "notice-2", Message: "คุณสามารถทดลองจัดการรายการตัวอย่างได้", EntityType: "portfolio", CreatedAt: "วันนี้", IsRead: true }
];

const profile: PreviewRecord = {
  id: "preview-user", username: "demo_user", first_name: "ผู้ใช้", last_name: "ตัวอย่าง",
  email: "demo@example.invalid", phone_number: "", shared_age: 80, shared_enabled: false
};

const friends: PreviewRecord[] = [
  { id: "friend-1", username: "บัญชีตัวอย่าง A", first_name: "คุณเอ", email: "friend-a@example.invalid", is_close: false },
  { id: "friend-2", username: "บัญชีตัวอย่าง B", first_name: "คุณบี", email: "friend-b@example.invalid", is_close: false }
];
const pendingFriends: PreviewRecord[] = [
  { id: "pending-1", username: "ผู้ใช้ตัวอย่าง", email: "request@example.invalid" }
];
const groups: PreviewRecord[] = [{ id: "group-family", group_name: "ครอบครัวตัวอย่าง", member_count: 3, description: "พื้นที่แบ่งปันข้อมูลภายในครอบครัว", owner_name: "ผู้ใช้ตัวอย่าง", created_at: "วันนี้" }];
const groupMembers: Record<string, PreviewRecord[]> = {
  "group-family": [
    { id: "preview-user", username: "ผู้ใช้ตัวอย่าง", email: "demo@example.invalid" },
    { id: "friend-1", username: "คุณเอ", email: "friend-a@example.invalid" },
    { id: "friend-2", username: "คุณบี", email: "friend-b@example.invalid" }
  ]
};
const groupMessages: Record<string, PreviewRecord[]> = {
  "group-family": [
    { id: "message-1", sender_id: "friend-1", sender_name: "คุณเอ", content: "ยินดีต้อนรับสู่กลุ่มตัวอย่าง", created_at: "10:24" },
    { id: "message-2", sender_id: "preview-user", sender_name: "ผู้ใช้ตัวอย่าง", content: "ขอบคุณครับ ลองแชร์รายการที่อยากให้ทุกคนดูได้เลย", created_at: "10:26" }
  ]
};
const friendMessages: Record<string, PreviewRecord[]> = {
  "friend-1": [
    { id: "friend-message-1", sender_id: "friend-1", sender_name: "คุณเอ", content: "สวัสดีครับ ยินดีที่ได้เป็นเพื่อนกัน", created_at: "09:12" },
    { id: "friend-message-2", sender_id: "preview-user", sender_name: "ผู้ใช้ตัวอย่าง", is_me: true, content: "ยินดีเช่นกันครับ", created_at: "09:14" }
  ],
  "friend-2": [
    { id: "friend-message-3", sender_id: "friend-2", sender_name: "คุณบี", content: "ถ้าสะดวกแชร์รายการที่อยากให้ช่วยดูมาได้เลยนะ", created_at: "เมื่อวาน" }
  ]
};
const sharedItems = new Map<string, Map<string, string>>();

function readBody(body: PreviewBody): PreviewRecord {
  if (typeof body === "string") {
    try { return JSON.parse(body) as PreviewRecord; } catch { return {}; }
  }
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const result: PreviewRecord = {};
    body.forEach((value, key) => { if (typeof value === "string") result[key] = value; });
    return result;
  }
  return body && typeof body === "object" ? body as PreviewRecord : {};
}

function numeric(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function amountOf(item: PreviewRecord): number {
  return numeric(item.amount ?? item.value ?? item.total_value ?? item.coverage_amount ?? item.principal);
}

function allAssets(): PreviewRecord[] {
  return Object.values(assetStores).flatMap((items) => items);
}

function previewAssetKey(item: PreviewRecord): string {
  const type = item.type === "invest" ? "investment" : String(item.type ?? "");
  return `${type}:${item.id}`;
}

function envelope<T>(data: T): { data: T } {
  return { data };
}

export async function requestLocalPreview(path: string, method: string, body?: PreviewBody): Promise<unknown> {
  const segments = path.split("/").filter(Boolean).map((part) => decodeURIComponent(part));
  const route = segments.join("/");
  const verb = method.toUpperCase();
  const values = readBody(body);

  if (route === "dashboard") {
    const assets = Object.values(assetStores).filter((_, index) => index < 6).flat();
    const liabilities = assetStores.liability;
    const totalAssets = assets.reduce((sum, item) => sum + amountOf(item), 0);
    const totalLiabilities = liabilities.reduce((sum, item) => sum + amountOf(item), 0);
    return envelope({
      net_worth: { total_assets: totalAssets, total_liabilities: totalLiabilities, value: totalAssets - totalLiabilities },
      assets, liabilities, friend_count: friends.length, unique_shared_item_count: 2
    });
  }

  if (route === "notifications" || route === "notifications/") return envelope(notifications);
  if (segments[0] === "notifications" && segments[1] === "read-all" && verb === "PUT") {
    notifications.forEach((item) => { item.IsRead = true; });
    return { success: true };
  }
  if (segments[0] === "notifications" && segments[1] && verb === "PUT") {
    const item = notifications.find((entry) => entry.ID === segments[1]);
    if (item) item.IsRead = true;
    return { success: true };
  }

  if (route === "user" || route === "user/") {
    if (verb === "PATCH") {
      Object.assign(profile, values);
      if ("shared_enabled" in values) profile.shared_enabled = values.shared_enabled === true || values.shared_enabled === "true";
      if ("shared_age" in values) profile.shared_age = Number(values.shared_age);
    }
    return envelope(profile);
  }
  if (route === "user/search" && verb === "POST") {
    const email = String(values.email ?? "").trim();
    const match = email ? [{ id: "search-user", username: "ผู้ใช้ตัวอย่าง", first_name: "ผู้ใช้", email }] : [];
    return envelope(match);
  }

  if (route === "closefriend" && verb === "POST") {
    const friend = friends.find((item) => item.id === values.friend_id);
    if (!friend) throw new Error("ไม่พบเพื่อนที่เลือก");
    friend.is_close = values.is_close === true || values.is_close === "true";
    return envelope({ success: true });
  }
  if (route === "closefriend" && verb === "GET") return envelope(friends.filter((item) => item.is_close === true));

  if ((route === "friend" || route === "friend/") && verb === "GET") return envelope(friends);
  if (route === "friend/pending") return envelope(pendingFriends);
  if (segments[0] === "friend" && segments[1] && segments[2] === "msg" && verb === "GET") {
    return envelope({ messages: friendMessages[segments[1]] ?? [] });
  }
  if (segments[0] === "friend" && segments[1] && segments[2] === "profile" && verb === "GET") {
    const friend = friends.find((item) => item.id === segments[1]);
    return envelope({ ...friend, shared_age: 30, shared_enabled: true });
  }
  if (segments[0] === "friend" && segments[1] && segments[2] === "item" && verb === "GET") {
    const shared = sharedItems.get(`friend:${segments[1]}`) ?? new Map<string, string>();
    const rows = [...shared.entries()].flatMap(([assetKey, shareId]) => {
      const asset = allAssets().find((item) => previewAssetKey(item) === assetKey);
      return asset ? [{
        shared_item_id: shareId,
        shared_by: "preview-user",
        shared_at: "วันนี้",
        type: asset.type,
        asset_detail: { id: asset.id, name: asset.name, amount: amountOf(asset), type: asset.type }
      }] : [];
    });
    return envelope(rows);
  }
  if (segments[0] === "friend" && segments[1] === "item" && segments[2] && verb === "DELETE") {
    for (const items of sharedItems.values()) {
      for (const [assetKey, shareId] of items) {
        if (shareId === segments[2]) items.delete(assetKey);
      }
    }
    return { success: true };
  }
  if (route === "friend" && verb === "POST") {
    friends.push({ id: String(values.requester_id ?? id()), username: "เพื่อนตัวอย่าง", email: "new-friend@example.invalid" });
    return { success: true };
  }
  if (route === "friend/accept" && verb === "POST") {
    const requesterId = String(values.requester_id ?? "");
    const requestIndex = pendingFriends.findIndex((item) => item.id === requesterId);
    const [request] = requestIndex >= 0 ? pendingFriends.splice(requestIndex, 1) : [];
    if (values.action === "accept" && request) friends.push(request);
    return { success: true };
  }
  if (segments[0] === "friend" && segments[1] && segments.length === 2 && verb === "DELETE") {
    const index = friends.findIndex((item) => item.id === segments[1]);
    if (index >= 0) friends.splice(index, 1);
    return { success: true };
  }

  if (segments[0] === "asset" || segments[0] === "lia") {
    const category = segments[0] === "lia" ? "liability" : segments[1];
    const store = assetStores[category] ?? [];
    const itemId = segments[0] === "lia" ? segments[1] : segments[2];
    if (verb === "GET") return envelope(store);
    if (verb === "POST") {
      const created = { ...values, id: id(), type: category };
      store.push(created);
      return envelope(created);
    }
    if ((verb === "PATCH" || verb === "PUT") && itemId) {
      const item = store.find((entry) => entry.id === itemId);
      if (item) Object.assign(item, values);
      return envelope(item ?? {});
    }
    if (verb === "DELETE" && itemId) {
      const index = store.findIndex((entry) => entry.id === itemId);
      if (index >= 0) store.splice(index, 1);
      return { success: true };
    }
  }

  if ((route === "group" || route === "group/") && verb === "GET") return envelope(groups);
  if (segments[0] === "group" && segments[1] === "detail" && segments[2] && verb === "GET") {
    const group = groups.find((item) => item.id === segments[2]);
    return envelope(group ?? {});
  }
  if (segments[0] === "group" && segments[1] === "member" && segments[2]) return envelope(groupMembers[segments[2]] ?? []);
  if (segments[0] === "group" && segments[1] && segments[2] === "msg") return envelope(groupMessages[segments[1]] ?? []);
  if (segments[0] === "group" && segments[1] && segments[2] === "item" && verb === "GET") {
    const shared = sharedItems.get(`group:${segments[1]}`) ?? new Map<string, string>();
    const rows = [...shared.entries()].flatMap(([assetKey, shareId]) => {
      const asset = allAssets().find((item) => previewAssetKey(item) === assetKey);
      return asset ? [{
        group_item_id: shareId,
        shared_by: "preview-user",
        shared_at: "วันนี้",
        type: asset.type,
        asset_detail: { id: asset.id, name: asset.name, amount: amountOf(asset), type: asset.type }
      }] : [];
    });
    return envelope(rows);
  }
  if (segments[0] === "group" && segments[1] === "item" && segments[2] && verb === "DELETE") {
    for (const items of sharedItems.values()) {
      for (const [assetKey, shareId] of items) {
        if (shareId === segments[2]) items.delete(assetKey);
      }
    }
    return { success: true };
  }
  if (segments[0] === "group" && segments[1] && segments[2] === "addmember" && verb === "POST") {
    (groupMembers[segments[1]] ??= []).push({ id: String(values.target_ids ?? id()), username: "สมาชิกตัวอย่าง" });
    return { success: true };
  }
  if (segments[0] === "group" && segments[1] && segments[2] === "leave" && verb === "DELETE") {
    const index = groups.findIndex((item) => item.id === segments[1]);
    if (index >= 0) groups.splice(index, 1);
    return { success: true };
  }
  if (segments[0] === "group" && segments[1] && segments.length === 2 && verb === "DELETE") {
    const index = groups.findIndex((item) => item.id === segments[1]);
    if (index >= 0) groups.splice(index, 1);
    return { success: true };
  }
  if ((route === "group" || route === "group/") && verb === "POST") {
    const created = { id: id(), group_name: String(values.group_name ?? "กลุ่มตัวอย่าง"), member_count: 1 };
    groups.push(created);
    groupMembers[String(created.id)] = [{ id: "preview-user", username: "ผู้ใช้ตัวอย่าง" }];
    return envelope(created);
  }

  if (segments[0] === "share" && segments[1] === "item" && segments[2] && segments[3] && segments[4] === "shared-targets" && verb === "GET") {
    const assetType = segments[2] === "invest" ? "investment" : segments[2];
    const assetKey = `${assetType}:${segments[3]}`;
    const sharedWith = (targetType: string, targetId: string) => sharedItems.get(`${targetType}:${targetId}`)?.has(assetKey) ?? false;
    return {
      friends: friends.filter((friend) => sharedWith("friend", String(friend.id))).map((friend) => ({ friend_id: friend.id, username: friend.username, shared_at: new Date().toISOString() })),
      groups: groups.filter((group) => sharedWith("group", String(group.id))).map((group) => ({ group_id: group.id, group_name: group.group_name, member_count: group.member_count, shared_at: new Date().toISOString() })),
      emails: [...sharedItems.keys()].filter((key) => key.startsWith("email:") && sharedItems.get(key)?.has(assetKey)).map((key) => ({ email: key.slice(6), shared_at: new Date().toISOString(), is_sent: true }))
    };
  }

  if (segments[0] === "share" && segments[1] && segments[2] && segments[3] === "selection") {
    const key = `${segments[1]}:${segments[2]}`;
    const selected = sharedItems.get(key) ?? new Map<string, string>();
    const items = allAssets().map((item) => ({
      ...item, id: item.id, name: item.name, type: item.type,
      amount: amountOf(item), is_shared: selected.has(previewAssetKey(item)),
      shared_item_id: selected.get(previewAssetKey(item)) ?? ""
    }));
    return envelope({ items });
  }
  if (route === "share/item" && verb === "POST") {
    const itemIds = Array.isArray(values.item_ids) ? values.item_ids.map(String) : String(values.item_ids ?? "").split(",").filter(Boolean);
    const itemTypes = Array.isArray(values.item_types) ? values.item_types.map(String) : String(values.item_types ?? "").split(",");
    for (const targetType of ["friend", "group", "email"] as const) {
      const field = `${targetType}s`;
      const targets = Array.isArray(values[field]) ? values[field] as PreviewRecord[] : [{ id: values[`${field}[0][id]`] }];
      for (const target of targets) {
        const targetId = String(target.id ?? "");
        if (!targetId) continue;
        const key = `${targetType}:${targetId}`;
        const selected = sharedItems.get(key) ?? new Map<string, string>();
        itemIds.forEach((itemId, index) => {
          const assetKey = `${itemTypes[index] ?? ""}:${itemId}`;
          if (!selected.has(assetKey)) selected.set(assetKey, `preview-share-${id()}`);
        });
        sharedItems.set(key, selected);
      }
    }
    return { success: true };
  }

  return envelope([]);
}
