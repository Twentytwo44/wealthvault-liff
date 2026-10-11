"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, arrayOf, errorMessage, formatMoney, numberOf, record, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { useConfirmation } from "../ConfirmationDialog";
import { AssetIdentityIcon, assetLabelForItem, sharedAssetFromResponse, sharedAssetKind, sharedAssetValue } from "../assets/AssetPresentation";
import { SharedAssetDetailDialog } from "../assets/SharedAssetDetailDialog";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";
import { loadTargetShareSelection, shareableAssetKey } from "./shareSelection";

export function FriendProfilePanel({ friend, fromChat, onBack, onOpenChat }: { friend: Record<string, unknown>; fromChat: boolean; onBack: () => void; onOpenChat: (friend: Record<string, unknown>) => void }) {
  const id = textOf(friend, "id", "ID", "friend_id");
  const { data, loading, refreshing, error, refresh } = useCachedApi(`friend/${id}/profile`, 30_000, false);
  const profile = record(valueOf(data, "profile")) ?? record(valueOf(data, "data")) ?? record(data) ?? {};

  const details = { ...friend, ...profile };
  const name = [textOf(details, "first_name"), textOf(details, "last_name")].filter(Boolean).join(" ")
    || textOf(details, "display_name", "username", "email") || "เพื่อน WealthVault";
  const facts = [
    { label: "ชื่อผู้ใช้", value: textOf(details, "username") },
    { label: "อีเมล", value: textOf(details, "email") }
  ].filter((fact) => fact.value);

  return <>
    <PageHeading eyebrow="เครือข่ายของฉัน" title="โปรไฟล์เพื่อน" description="ดูข้อมูลทั่วไปและกลับไปสนทนากับเพื่อนได้" />
    <section className="panel contact-profile-panel">
      <button className="back-button" onClick={onBack} type="button">← <span>{fromChat ? "กลับไปแชต" : "กลับไปรายชื่อเพื่อน"}</span></button>
      <div className="contact-profile-hero"><span className="group-avatar group-avatar-large">{name.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">เพื่อน WealthVault</span><h2>{name}</h2><p>{textOf(details, "email") || "เชื่อมต่อแล้ว"}</p></div></div>
      {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตโปรไฟล์เพื่อน…</div>}
      {error && <ErrorPanel message={error} onRetry={() => void refresh()} />}
      {loading ? <LoadingPanel label="กำลังโหลดโปรไฟล์…" /> : facts.length ? <dl className="contact-profile-facts">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : !error ? <p className="muted-copy">เพื่อนยังไม่ได้เพิ่มข้อมูลโปรไฟล์เพิ่มเติม</p> : null}
      <div className="form-actions"><button className="button button-quiet" onClick={onBack} type="button">กลับ</button><button className="button button-primary" onClick={() => onOpenChat(details)} type="button">เปิดแชต <span>→</span></button></div>
    </section>
  </>;
}

export function FriendDetailPanel({ friend, currentUserId, onBack, onOpenProfile }: { friend: Record<string, unknown>; currentUserId: string; onBack: () => void; onOpenProfile: () => void }) {
  const id = textOf(friend, "id", "ID", "friend_id");
  const friendName = [textOf(friend, "first_name"), textOf(friend, "last_name")].filter(Boolean).join(" ")
    || textOf(friend, "username", "email") || "เพื่อน WealthVault";
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Record<string, unknown>[]>([]);
  const [sharedAssets, setSharedAssets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedAssetsLoading, setSharedAssetsLoading] = useState(false);
  const [sharedAssetsError, setSharedAssetsError] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [unsharingAssetKey, setUnsharingAssetKey] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [selectedSharedAsset, setSelectedSharedAsset] = useState<Record<string, unknown> | null>(null);
  const { confirm, confirmationDialog } = useConfirmation();

  const loadMessages = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(`friend/${id}/msg/`);
      setMessages(arrayOf(response, ["messages", "data"]));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);

  const loadSharedAssets = useCallback(async () => {
    setSharedAssetsLoading(true);
    setSharedAssetsError("");
    try {
      const response = await apiRequest(`friend/${id}/item/`);
      const assets = arrayOf(response, ["data", "items"]).map(sharedAssetFromResponse).filter((asset): asset is Record<string, unknown> => asset !== null);
      setSharedAssets(assets);
    } catch (cause) { setSharedAssetsError(errorMessage(cause)); }
    finally { setSharedAssetsLoading(false); }
  }, [id]);

  useEffect(() => {
    const messageTimer = window.setTimeout(() => { void loadMessages(); }, 0);
    const assetsTimer = window.setTimeout(() => { void loadSharedAssets(); }, 0);
    return () => { window.clearTimeout(messageTimer); window.clearTimeout(assetsTimer); };
  }, [id, loadMessages, loadSharedAssets]);

  async function openAssetPicker() {
    setShareDialogOpen(true);
    setSharingBusy(true);
    setShareError("");
    setSelectedAssetIds([]);
    try {
      const items = await loadTargetShareSelection("friend", id);
      setAvailableAssets(items);
    } catch (cause) { setShareError(errorMessage(cause)); }
    finally { setSharingBusy(false); }
  }

  async function shareSelectedAssets() {
    const selected = availableAssets.filter((item) => selectedAssetIds.includes(textOf(item, "id", "ID")));
    if (!selected.length) return;
    const shareRequest = {
      item_ids: selected.map((item) => textOf(item, "id", "ID")),
      item_types: selected.map((item) => textOf(item, "type", "item_type")),
      friends: [{ id }]
    };
    setSharingBusy(true);
    setShareError("");
    try {
      await apiRequest("share/item/", { method: "POST", body: shareRequest });
      const updated = availableAssets.map((item) => selectedAssetIds.includes(textOf(item, "id", "ID")) ? { ...item, is_shared: true } : item);
      setAvailableAssets(updated);
      setSelectedAssetIds([]);
      setShareDialogOpen(false);
      setShareNotice(`แชร์ทรัพย์สินให้${friendName}แล้ว`);
      window.setTimeout(() => setShareNotice(""), 3_500);
      void loadSharedAssets();
    } catch (cause) { setShareError(errorMessage(cause)); }
    finally { setSharingBusy(false); }
  }

  async function unshareAsset(asset: Record<string, unknown>) {
    const shareId = textOf(asset, "shared_item_id", "group_item_id");
    const assetId = textOf(asset, "id", "ID");
    const assetKey = shareableAssetKey(asset);
    if (!shareId || !assetId || unsharingAssetKey) return;
    if (!await confirm({
      title: "ยกเลิกการแชร์?",
      itemName: textOf(asset, "name", "title") || "ทรัพย์สินนี้",
      description: `${friendName} จะไม่สามารถดูรายการนี้ผ่านการแชร์ได้อีก ทรัพย์สินต้นฉบับจะยังอยู่ในพอร์ตของคุณ`,
      confirmLabel: "ยกเลิกแชร์",
      tone: "warning"
    })) return;
    setUnsharingAssetKey(assetKey);
    setSharedAssetsError("");
    try {
      await apiRequest(`friend/item/${shareId}/`, { method: "DELETE" });
      setSharedAssets((current) => current.filter((item) => shareableAssetKey(item) !== assetKey));
      setAvailableAssets((current) => current.map((item) => shareableAssetKey(item) === assetKey
        ? { ...item, is_shared: false, shared_item_id: "" }
        : item));
      setSelectedAssetIds((current) => current.filter((selectedId) => selectedId !== assetId));
      setShareNotice("ยกเลิกการแชร์กับเพื่อนแล้ว");
      window.setTimeout(() => setShareNotice(""), 3_500);
    } catch (cause) { setSharedAssetsError(errorMessage(cause)); }
    finally { setUnsharingAssetKey(""); }
  }

  async function removeFriend() {
    if (!await confirm({
      title: "ลบเพื่อนคนนี้?",
      itemName: friendName,
      description: "คุณจะไม่เห็นเพื่อนคนนี้ในรายชื่ออีก และไม่สามารถเปิดแชตจากรายการเพื่อนได้",
      confirmLabel: "ลบเพื่อน"
    })) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(`friend/${id}`, { method: "DELETE" });
      onBack();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <section className="panel group-detail-panel">
    <div className="group-detail-head"><button className="back-button" onClick={onBack} type="button">← <span>กลับไปรายชื่อเพื่อน</span></button><button className="group-detail-title profile-trigger" onClick={onOpenProfile} type="button" aria-label={`ดูโปรไฟล์ ${friendName}`}><span className="group-avatar group-avatar-large">{friendName.slice(0, 1).toUpperCase()}</span><span className="profile-trigger-copy"><span className="eyebrow">แชตส่วนตัว</span><strong>{friendName}</strong><small>{textOf(friend, "email") || "เพื่อนใน WealthVault"}</small></span><span className="profile-trigger-chevron">›</span></button><button className="button button-quiet" onClick={() => void removeFriend()} disabled={busy} type="button">ลบเพื่อน</button></div>
    {error && <ErrorPanel message={error} onRetry={() => void loadMessages()} />}
    {loading ? <LoadingPanel label="กำลังโหลดบทสนทนา…" /> : <div className="chat-layout friend-chat-layout">
      <section className="chat-panel" aria-label={`บทสนทนากับ${friendName}`}>
        <div className="chat-transcript" aria-live="polite">
          <div className="chat-day-divider"><span>บทสนทนาส่วนตัว</span></div>
          {messages.map((message, index) => {
            const senderId = textOf(message, "sender_id", "user_id");
            const ownMessage = valueOf(message, "is_me") === true || (senderId !== "" && senderId === currentUserId);
            const senderName = textOf(message, "sender_name", "username") || (ownMessage ? "คุณ" : friendName);
            const metadata = record(valueOf(message, "metadata"));
            const itemName = textOf(metadata, "item_name", "snapshot_title");
            const assetType = textOf(metadata, "asset_type", "type");
            const assetMessage = Boolean(itemName || textOf(metadata, "asset_id"));
            const messageAssetId = textOf(metadata, "asset_id");
            const sharedAsset = messageAssetId ? sharedAssets.find((asset) => textOf(asset, "id", "ID") === messageAssetId && (!assetType || sharedAssetKind(asset) === (assetType.toLowerCase() === "investment" ? "invest" : assetType.toLowerCase()))) : undefined;
            const content = textOf(message, "content", "message");
            return <article className={`chat-message ${ownMessage ? "is-own" : ""}`} key={textOf(message, "id", "ID") || index}>
              {!ownMessage && <span className="message-avatar">{senderName.slice(0, 1).toUpperCase()}</span>}
              {assetMessage ? sharedAsset ? <button className="chat-asset-bubble" onClick={() => setSelectedSharedAsset(sharedAsset)} type="button"><span className="chat-asset-overline">◈ {ownMessage ? "แชร์ทรัพย์สินให้เพื่อน" : `${senderName} แชร์ทรัพย์สิน`}</span><strong>{itemName || content || "รายการทรัพย์สิน"}</strong><small>{assetLabelForItem(metadata ?? {}, assetType || "ทรัพย์สิน")} · {textOf(metadata, "share_at_display") || textOf(message, "created_at")}</small><span className="chat-asset-hint">ดูรายละเอียด ›</span></button> : <div className="chat-asset-bubble"><span className="chat-asset-overline">◈ {ownMessage ? "แชร์ทรัพย์สินให้เพื่อน" : `${senderName} แชร์ทรัพย์สิน`}</span><strong>{itemName || content || "รายการทรัพย์สิน"}</strong><small>{assetLabelForItem(metadata ?? {}, assetType || "ทรัพย์สิน")} · {textOf(metadata, "share_at_display") || textOf(message, "created_at")}</small><span className="chat-asset-unavailable">{sharedAssetsLoading ? "กำลังตรวจสิทธิ์การแชร์…" : "ไม่สามารถดูรายละเอียดรายการนี้"}</span></div> : <div className="chat-message-body">
                {!ownMessage && <strong className="chat-sender">{senderName}</strong>}
                <div className="chat-bubble"><p>{content || "ข้อความในบทสนทนา"}</p><small>{textOf(message, "created_at")}</small></div>
              </div>}
            </article>;
          })}
          {sharedAssets.length > 0 && <>
            <div className="chat-day-divider"><span>ทรัพย์สินที่แชร์ในแชต</span></div>
            {sharedAssets.map((asset, index) => { const ownShare = textOf(asset, "shared_by") === currentUserId; const amount = sharedAssetValue(asset); return <article className={`chat-message ${ownShare ? "is-own" : ""}`} key={shareableAssetKey(asset) || index}>
              <button className="chat-asset-bubble" onClick={() => setSelectedSharedAsset(asset)} type="button"><span className="chat-asset-overline">◈ {ownShare ? "แชร์ทรัพย์สินให้เพื่อน" : `${friendName} แชร์ทรัพย์สิน`}</span><strong>{textOf(asset, "name", "title") || "ทรัพย์สิน"}</strong><small>{assetLabelForItem(asset)} · {amount === null ? "ไม่ระบุมูลค่า" : formatMoney(amount)}</small><span className="chat-asset-hint">ดูรายละเอียด ›</span></button>
            </article>; })}
          </>}
          {!messages.length && !sharedAssets.length && <EmptyPanel title="เริ่มบทสนทนา" description="แชร์รายการทรัพย์สินที่ต้องการให้เพื่อนคนนี้ดูได้จากปุ่มด้านล่าง" />}
        </div>
        {shareNotice && <div className="inline-notice" role="status">✓ {shareNotice}</div>}
        <div className="chat-composer"><button className="button button-secondary chat-share-button" onClick={() => void openAssetPicker()} type="button">◈ <span>แชร์ทรัพย์สิน</span></button><input aria-label="ข้อความแชต" placeholder="การส่งข้อความยังไม่เปิดใช้งาน" disabled /><button className="chat-send-button" aria-label="ส่งข้อความ" disabled type="button">➤</button></div>
        <p className="chat-compose-footnote">แชร์แล้ว เฉพาะ{friendName}จะเห็นรายการนี้ · การส่งข้อความยังรอระบบแชตฝั่ง backend</p>
      </section>
      <aside className="chat-context">
        <section className="panel chat-shared-panel"><div className="panel-heading"><div><span className="eyebrow">การเข้าถึงส่วนตัว</span><h2>ทรัพย์สินในแชต</h2></div><span className="count-badge">{sharedAssets.length}</span></div>
          {sharedAssetsError ? <ErrorPanel message={sharedAssetsError} onRetry={() => void loadSharedAssets()} /> : sharedAssetsLoading ? <LoadingPanel label="กำลังโหลดรายการที่แชร์…" /> : sharedAssets.length ? <div className="chat-shared-list">{sharedAssets.map((asset, index) => { const ownShare = textOf(asset, "shared_by") === currentUserId; return <div className="chat-shared-row" key={shareableAssetKey(asset) || index}><AssetIdentityIcon item={asset} /><button className="chat-shared-open person-copy" onClick={() => setSelectedSharedAsset(asset)} type="button"><strong>{textOf(asset, "name", "title") || "ทรัพย์สิน"}</strong><small>{assetLabelForItem(asset)} · ดูรายละเอียด</small></button>{ownShare ? <button className="chat-share-revoke" onClick={() => void unshareAsset(asset)} disabled={!textOf(asset, "shared_item_id", "group_item_id") || Boolean(unsharingAssetKey)} type="button">{unsharingAssetKey === shareableAssetKey(asset) ? "กำลังยกเลิก…" : "ยกเลิกแชร์"}</button> : <span className="chat-share-source">จากเพื่อน</span>}</div>; })}</div> : <p className="chat-context-empty">ยังไม่มีรายการที่แชร์ให้เพื่อนคนนี้</p>}
          <button className="text-button" onClick={() => void openAssetPicker()} type="button">เลือกทรัพย์สินที่จะแชร์ <span>→</span></button>
        </section>
        <div className="chat-notice"><span>🔒</span><p>คุณสามารถแชร์หรือยกเลิกสิทธิ์ของเพื่อนคนนี้ได้ โดยไม่กระทบกับทรัพย์สินต้นฉบับ</p></div>
      </aside>
    </div>}
    {shareDialogOpen && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShareDialogOpen(false); }}>
      <section className="modal-card chat-share-modal" role="dialog" aria-modal="true" aria-labelledby="friend-share-title">
        <div className="modal-heading"><div><span className="eyebrow">แชร์ให้{friendName}</span><h2 id="friend-share-title">เลือกทรัพย์สิน</h2></div><button className="icon-button" onClick={() => setShareDialogOpen(false)} aria-label="ปิด" type="button">×</button></div>
        <p className="chat-share-description">เลือกรายการที่ต้องการให้เพื่อนคนนี้เข้าถึง การแชร์มีผลกับเพื่อนคนนี้เท่านั้น</p>
        {shareError && <ErrorPanel message={shareError} onRetry={() => void openAssetPicker()} />}
        {sharingBusy && !availableAssets.length ? <LoadingPanel label="กำลังโหลดทรัพย์สิน…" /> : availableAssets.length ? <div className="chat-share-options">{availableAssets.map((asset, index) => {
          const assetId = textOf(asset, "id", "ID") || String(index);
          const alreadyShared = valueOf(asset, "is_shared") === true;
          const checked = alreadyShared || selectedAssetIds.includes(assetId);
          return <div className={`chat-share-option ${checked ? "selected" : ""}`} key={shareableAssetKey(asset) || assetId}>
            <input type="checkbox" aria-label={`แชร์ ${textOf(asset, "name", "title") || "ทรัพย์สิน"}`} checked={checked} disabled={alreadyShared || sharingBusy || Boolean(unsharingAssetKey)} onChange={() => setSelectedAssetIds((current) => current.includes(assetId) ? current.filter((selectedId) => selectedId !== assetId) : [...current, assetId])} />
            <AssetIdentityIcon item={asset} /><span className="person-copy"><strong>{textOf(asset, "name", "title") || "ทรัพย์สิน"}</strong><small>{assetLabelForItem(asset)}</small></span>
            {alreadyShared ? <button className="chat-share-revoke" onClick={() => void unshareAsset(asset)} disabled={!textOf(asset, "shared_item_id", "group_item_id") || Boolean(unsharingAssetKey)} type="button">{unsharingAssetKey === shareableAssetKey(asset) ? "กำลังยกเลิก…" : "ยกเลิกแชร์"}</button> : <span className="chat-share-state">{formatMoney(numberOf(asset, "value", "amount"))}</span>}
          </div>;
        })}</div> : !sharingBusy && !shareError ? <EmptyPanel title="ยังไม่มีทรัพย์สิน" description="เพิ่มรายการในพอร์ตของคุณก่อน แล้วกลับมาแชร์ให้เพื่อนได้" /> : null}
        <div className="form-actions"><button className="button button-quiet" onClick={() => setShareDialogOpen(false)} disabled={sharingBusy || Boolean(unsharingAssetKey)} type="button">ปิด</button><button className="button button-primary" onClick={() => void shareSelectedAssets()} disabled={sharingBusy || Boolean(unsharingAssetKey) || selectedAssetIds.length === 0} type="button">{sharingBusy ? "กำลังแชร์…" : `แชร์ ${selectedAssetIds.length} รายการ`}</button></div>
      </section>
    </div>}
    {selectedSharedAsset && <SharedAssetDetailDialog key={shareableAssetKey(selectedSharedAsset)} asset={selectedSharedAsset} isOwner={textOf(selectedSharedAsset, "shared_by") === currentUserId} onClose={() => setSelectedSharedAsset(null)} />}
    {confirmationDialog}
  </section>;
}
