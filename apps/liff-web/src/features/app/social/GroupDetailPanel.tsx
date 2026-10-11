"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { apiRequest, arrayOf, errorMessage, formatMoney, numberOf, record, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { useConfirmation } from "../ConfirmationDialog";
import { AssetIdentityIcon, assetLabelForItem, sharedAssetFromResponse, sharedAssetKind, sharedAssetValue } from "../assets/AssetPresentation";
import { SharedAssetDetailDialog } from "../assets/SharedAssetDetailDialog";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";
import { loadTargetShareSelection, shareableAssetKey } from "./shareSelection";

export function GroupProfilePanel({ group, onBack, onOpenGroup }: { group: Record<string, unknown>; onBack: () => void; onOpenGroup: () => void }) {
  const id = textOf(group, "id", "ID");
  const { data, loading, refreshing, error, refresh } = useCachedApi(`group/detail/${id}`, 30_000, false);
  const profile = record(valueOf(data, "group")) ?? record(valueOf(data, "data")) ?? record(data) ?? {};

  const details = { ...group, ...profile };
  const name = textOf(details, "group_name", "name") || "กลุ่ม WealthVault";
  const owner = textOf(details, "owner_name", "creator_name", "created_by_name");
  const memberCount = numberOf(details, "member_count", "total_members") || numberOf(group, "member_count");
  const facts = [
    { label: "จำนวนสมาชิก", value: memberCount ? `${memberCount} คน` : "" },
    { label: "ผู้สร้างกลุ่ม", value: owner },
    { label: "สร้างเมื่อ", value: textOf(details, "created_at", "created") }
  ].filter((fact) => fact.value);
  const description = textOf(details, "description", "about", "detail");

  return <>
    <PageHeading eyebrow="พื้นที่ร่วมกัน" title="โปรไฟล์กลุ่ม" description="ดูรายละเอียดและสมาชิกของกลุ่ม" />
    <section className="panel contact-profile-panel">
      <button className="back-button" onClick={onBack} type="button">← <span>กลับไปรายชื่อกลุ่ม</span></button>
      <div className="contact-profile-hero"><span className="group-avatar group-avatar-large">{name.slice(0, 1).toUpperCase()}</span><div><span className="eyebrow">กลุ่ม WealthVault</span><h2>{name}</h2><p>{description || "พื้นที่ส่วนตัวสำหรับแชร์ข้อมูลกับสมาชิกที่เลือก"}</p></div></div>
      {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตโปรไฟล์กลุ่ม…</div>}
      {error && <ErrorPanel message={error} onRetry={() => void refresh()} />}
      {loading ? <LoadingPanel label="กำลังโหลดโปรไฟล์กลุ่ม…" /> : facts.length ? <dl className="contact-profile-facts">{facts.map((fact) => <div key={fact.label}><dt>{fact.label}</dt><dd>{fact.value}</dd></div>)}</dl> : !error ? <p className="muted-copy">ยังไม่มีรายละเอียดเพิ่มเติมของกลุ่มนี้</p> : null}
      <div className="form-actions"><button className="button button-quiet" onClick={onBack} type="button">กลับ</button><button className="button button-primary" onClick={onOpenGroup} type="button">เปิดกลุ่ม <span>→</span></button></div>
    </section>
  </>;
}

export function GroupDetailPanel({ group, currentUserId, onBack, onOpenProfile }: { group: Record<string, unknown>; currentUserId: string; onBack: () => void; onOpenProfile: () => void }) {
  const id = textOf(group, "id", "ID");
  const [members, setMembers] = useState<Record<string, unknown>[]>([]);
  const [messages, setMessages] = useState<Record<string, unknown>[]>([]);
  const [availableAssets, setAvailableAssets] = useState<Record<string, unknown>[]>([]);
  const [sharedAssets, setSharedAssets] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharedAssetsLoading, setSharedAssetsLoading] = useState(false);
  const [sharedAssetsError, setSharedAssetsError] = useState("");
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [sharingBusy, setSharingBusy] = useState(false);
  const [unsharingAssetKey, setUnsharingAssetKey] = useState("");
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [shareError, setShareError] = useState("");
  const [shareNotice, setShareNotice] = useState("");
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"members" | "chat">("members");
  const [selectedSharedAsset, setSelectedSharedAsset] = useState<Record<string, unknown> | null>(null);
  const { confirm, confirmationDialog } = useConfirmation();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [memberResponse, messageResponse] = await Promise.all([
        apiRequest(`group/member/${id}/`),
        apiRequest(`group/${id}/msg/`)
      ]);
      setMembers(arrayOf(memberResponse, ["members", "data"]));
      setMessages(arrayOf(messageResponse, ["messages", "data"]));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [id]);

  async function loadSharedAssets() {
    setSharedAssetsLoading(true);
    setSharedAssetsError("");
    try {
      const response = await apiRequest(`group/${id}/item/`);
      const items = arrayOf(response, ["data", "items"]).map(sharedAssetFromResponse).filter((asset): asset is Record<string, unknown> => asset !== null);
      setSharedAssets(items);
    } catch (cause) {
      setSharedAssetsError(errorMessage(cause));
    } finally {
      setSharedAssetsLoading(false);
    }
  }

  async function openAssetPicker() {
    setShareDialogOpen(true);
    setSharingBusy(true);
    setShareError("");
    setSharedAssetsError("");
    setSelectedAssetIds([]);
    try {
      const items = await loadTargetShareSelection("group", id);
      setAvailableAssets(items);
    } catch (cause) {
      setShareError(errorMessage(cause));
    } finally {
      setSharingBusy(false);
    }
  }

  async function shareSelectedAssets() {
    const selected = availableAssets.filter((item) => selectedAssetIds.includes(textOf(item, "id", "ID")));
    if (selected.length === 0) return;
    const shareRequest = {
      item_ids: selected.map((item) => textOf(item, "id", "ID")),
      item_types: selected.map((item) => textOf(item, "type", "item_type")),
      groups: [{ id }]
    };
    setSharingBusy(true);
    setShareError("");
    try {
      await apiRequest("share/item/", { method: "POST", body: shareRequest });
      const updated = availableAssets.map((item) => selectedAssetIds.includes(textOf(item, "id", "ID")) ? { ...item, is_shared: true } : item);
      setAvailableAssets(updated);
      setSharedAssetsError("");
      setSelectedAssetIds([]);
      setShareDialogOpen(false);
      setShareNotice("แชร์ทรัพย์สินให้กลุ่มแล้ว");
      window.setTimeout(() => setShareNotice(""), 3_500);
      await loadSharedAssets();
    } catch (cause) {
      setShareError(errorMessage(cause));
    } finally {
      setSharingBusy(false);
    }
  }

  async function unshareAsset(asset: Record<string, unknown>) {
    const shareId = textOf(asset, "shared_item_id", "group_item_id");
    const assetId = textOf(asset, "id", "ID");
    const assetKey = shareableAssetKey(asset);
    if (!shareId || !assetId || unsharingAssetKey) return;
    if (!await confirm({
      title: "ยกเลิกการแชร์กับกลุ่ม?",
      itemName: textOf(asset, "name", "title") || "ทรัพย์สินนี้",
      description: "สมาชิกกลุ่มจะไม่สามารถดูรายการนี้ผ่านการแชร์ได้อีก ทรัพย์สินต้นฉบับจะยังอยู่ในพอร์ตของคุณ",
      confirmLabel: "ยกเลิกแชร์",
      tone: "warning"
    })) return;

    setUnsharingAssetKey(assetKey);
    setSharedAssetsError("");
    try {
      await apiRequest(`group/item/${shareId}/`, { method: "DELETE" });
      const updated = availableAssets.map((item) => shareableAssetKey(item) === assetKey
        ? { ...item, is_shared: false, shared_item_id: "" }
        : item);
      setAvailableAssets(updated);
      setSharedAssets((current) => current.filter((item) => shareableAssetKey(item) !== assetKey));
      setSelectedAssetIds((current) => current.filter((selectedId) => selectedId !== assetId));
      setShareNotice("ยกเลิกการแชร์แล้ว");
      window.setTimeout(() => setShareNotice(""), 3_500);
    } catch (cause) {
      setSharedAssetsError(errorMessage(cause));
    } finally {
      setUnsharingAssetKey("");
    }
  }

  useEffect(() => {
    if (!id) return;
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [id, load]);

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!targetId.trim()) return;
    const body = new FormData();
    body.set("target_ids", targetId.trim());
    setBusy(true);
    try {
      await apiRequest(`group/${id}/addmember`, { method: "POST", body });
      setTargetId("");
      await load();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function leave() {
    if (!await confirm({
      title: "ออกจากกลุ่มนี้?",
      itemName: textOf(group, "group_name", "name") || "กลุ่มนี้",
      description: "คุณจะออกจากกลุ่ม และอาจเข้าถึงรายการที่สมาชิกแชร์ในกลุ่มไม่ได้อีก",
      confirmLabel: "ออกจากกลุ่ม",
      tone: "warning"
    })) return;
    setBusy(true);
    try { await apiRequest(`group/${id}/leave`, { method: "DELETE" }); onBack(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <section className="panel group-detail-panel">
    <div className="group-detail-head"><button className="back-button" onClick={onBack} type="button">← <span>กลับไปกลุ่ม</span></button><button className="group-detail-title profile-trigger" onClick={onOpenProfile} type="button" aria-label={`ดูโปรไฟล์กลุ่ม ${textOf(group, "group_name", "name") || "กลุ่ม WealthVault"}`}><span className="group-avatar group-avatar-large">{(textOf(group, "group_name", "name") || "G").slice(0, 1).toUpperCase()}</span><span className="profile-trigger-copy"><span className="eyebrow">พื้นที่ร่วมกัน</span><strong>{textOf(group, "group_name", "name") || "กลุ่ม WealthVault"}</strong><small>{members.length} สมาชิก · ดูโปรไฟล์</small></span><span className="profile-trigger-chevron">›</span></button><button className="button button-quiet" onClick={() => void leave()} disabled={busy} type="button">ออกจากกลุ่ม</button></div>
    <div className="social-tabs small-tabs"><button className={tab === "members" ? "selected" : ""} onClick={() => setTab("members")} type="button">สมาชิก</button><button className={tab === "chat" ? "selected" : ""} onClick={() => { setTab("chat"); void loadSharedAssets(); }} type="button">แชต</button></div>
    {error && <ErrorPanel message={error} onRetry={() => void load()} />}
    {loading ? <LoadingPanel label="กำลังโหลดข้อมูลกลุ่ม…" /> : tab === "members" ? <div className="group-detail-content">
      <form className="add-member-form" onSubmit={(event) => void addMember(event)}><input value={targetId} onChange={(event) => setTargetId(event.target.value)} placeholder="รหัสบัญชีสมาชิก" aria-label="รหัสบัญชีสมาชิก" required /><button className="button button-primary" disabled={busy} type="submit">เพิ่มสมาชิก</button></form>
      <div className="people-list">{members.map((member, index) => { const name = textOf(member, "username", "first_name", "email") || "สมาชิก"; return <article className="person-row" key={textOf(member, "id", "ID") || index}><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{name}</strong><small>{textOf(member, "email") || "สมาชิกกลุ่ม"}</small></span><span className="member-role">สมาชิก</span></article>; })}</div>
    </div> : <div className="chat-layout">
      <section className="chat-panel" aria-label="บทสนทนาในกลุ่ม">
        <div className="chat-transcript" aria-live="polite">
          <div className="chat-day-divider"><span>บทสนทนาในกลุ่ม</span></div>
          {messages.map((message, index) => {
            const senderId = textOf(message, "sender_id", "user_id");
            const ownMessage = senderId !== "" && senderId === currentUserId;
            const senderName = textOf(message, "sender_name", "username") || (ownMessage ? "คุณ" : "สมาชิก");
            const metadata = record(valueOf(message, "metadata"));
            const assetId = textOf(metadata, "asset_id");
            const assetType = textOf(metadata, "asset_type", "type");
            const itemName = textOf(metadata, "item_name", "snapshot_title");
            const assetMessage = Boolean(assetId || itemName);
            const sharedAsset = assetId ? sharedAssets.find((asset) => textOf(asset, "id", "ID") === assetId && (!assetType || sharedAssetKind(asset) === (assetType.toLowerCase() === "investment" ? "invest" : assetType.toLowerCase()))) : undefined;
            const content = textOf(message, "content", "message");
            return <article className={`chat-message ${ownMessage ? "is-own" : ""}`} key={textOf(message, "id", "ID") || index}>
              {!ownMessage && <span className="message-avatar">{senderName.slice(0, 1).toUpperCase()}</span>}
              {assetMessage ? sharedAsset ? <button className="chat-asset-bubble" onClick={() => setSelectedSharedAsset(sharedAsset)} type="button"><span className="chat-asset-overline">◈ {ownMessage ? "แชร์ทรัพย์สินให้กลุ่ม" : `${senderName} แชร์ทรัพย์สิน`}</span><strong>{itemName || content || "รายการทรัพย์สิน"}</strong><small>{assetLabelForItem(metadata ?? {}, assetType || "ทรัพย์สิน")} · {textOf(message, "created_at")}</small><span className="chat-asset-hint">ดูรายละเอียด ›</span></button> : <div className="chat-asset-bubble"><span className="chat-asset-overline">◈ {ownMessage ? "แชร์ทรัพย์สินให้กลุ่ม" : `${senderName} แชร์ทรัพย์สิน`}</span><strong>{itemName || content || "รายการทรัพย์สิน"}</strong><small>{assetLabelForItem(metadata ?? {}, assetType || "ทรัพย์สิน")} · {textOf(message, "created_at")}</small><span className="chat-asset-unavailable">{sharedAssetsLoading ? "กำลังตรวจสิทธิ์การแชร์…" : "ไม่สามารถดูรายละเอียดรายการนี้"}</span></div> : <div className="chat-message-body">
                {!ownMessage && <strong className="chat-sender">{senderName}</strong>}
                <div className="chat-bubble"><p>{content || "ข้อความที่แนบมากับกลุ่ม"}</p><small>{textOf(message, "created_at")}</small></div>
              </div>}
            </article>;
          })}
          {sharedAssets.length > 0 && <>
            <div className="chat-day-divider"><span>ทรัพย์สินที่แชร์กับกลุ่ม</span></div>
            {sharedAssets.map((asset, index) => { const ownShare = textOf(asset, "shared_by") === currentUserId; const amount = sharedAssetValue(asset); return <article className={`chat-message ${ownShare ? "is-own" : ""}`} key={shareableAssetKey(asset) || index}>
              <button className="chat-asset-bubble" onClick={() => setSelectedSharedAsset(asset)} type="button"><span className="chat-asset-overline">◈ {ownShare ? "แชร์ทรัพย์สินให้กลุ่ม" : "สมาชิกแชร์ทรัพย์สิน"}</span><strong>{textOf(asset, "name", "title") || "ทรัพย์สิน"}</strong><small>{assetLabelForItem(asset)} · {amount === null ? "ไม่ระบุมูลค่า" : formatMoney(amount)}</small><span className="chat-asset-hint">ดูรายละเอียด ›</span></button>
            </article>; })}
          </>}
          {!messages.length && !sharedAssets.length && <EmptyPanel title="เริ่มบทสนทนา" description="แชร์รายการทรัพย์สินให้สมาชิกกลุ่มดูได้จากปุ่มด้านล่าง" />}
        </div>
        {shareNotice && <div className="inline-notice" role="status">✓ {shareNotice}</div>}
        <div className="chat-composer">
          <button className="button button-secondary chat-share-button" onClick={() => void openAssetPicker()} type="button">◈ <span>แชร์ทรัพย์สิน</span></button>
          <input aria-label="ข้อความแชต" placeholder="การส่งข้อความยังไม่เปิดใช้งาน" disabled />
          <button className="chat-send-button" aria-label="ส่งข้อความ" disabled type="button">➤</button>
        </div>
        <p className="chat-compose-footnote">แชร์แล้ว สมาชิกกลุ่มที่ได้รับอนุญาตจะเห็นรายการตามสิทธิ์ที่คุณเลือก</p>
      </section>
      <aside className="chat-context">
        <section className="panel chat-shared-panel"><div className="panel-heading"><div><span className="eyebrow">การเข้าถึงของกลุ่ม</span><h2>ทรัพย์สินที่แชร์</h2></div><span className="count-badge">{sharedAssets.length}</span></div>
          {sharedAssetsError ? <ErrorPanel message={sharedAssetsError} onRetry={() => void loadSharedAssets()} /> : sharedAssetsLoading ? <LoadingPanel label="กำลังโหลดรายการที่แชร์…" /> : sharedAssets.length ? <div className="chat-shared-list">{sharedAssets.map((asset, index) => { const ownShare = textOf(asset, "shared_by") === currentUserId; return <div className="chat-shared-row" key={shareableAssetKey(asset) || index}><AssetIdentityIcon item={asset} /><button className="chat-shared-open person-copy" onClick={() => setSelectedSharedAsset(asset)} type="button"><strong>{textOf(asset, "name", "title") || "ทรัพย์สิน"}</strong><small>{assetLabelForItem(asset)} · ดูรายละเอียด</small></button>{ownShare ? <button className="chat-share-revoke" onClick={() => void unshareAsset(asset)} disabled={!textOf(asset, "shared_item_id", "group_item_id") || Boolean(unsharingAssetKey)} type="button">{unsharingAssetKey === shareableAssetKey(asset) ? "กำลังยกเลิก…" : "ยกเลิกแชร์"}</button> : <span className="chat-share-source">จากสมาชิก</span>}</div>; })}</div> : <p className="chat-context-empty">ยังไม่มีรายการที่แชร์กับกลุ่มนี้</p>}
          <button className="text-button" onClick={() => void openAssetPicker()} type="button">เลือกทรัพย์สินที่จะแชร์ <span>→</span></button>
        </section>
        <div className="chat-notice"><span>🔒</span><p>การแชร์จะเปลี่ยนสิทธิ์การเข้าถึงทรัพย์สินของกลุ่ม ส่วนการส่งข้อความยังรอระบบแชตฝั่ง backend</p></div>
      </aside>
    </div>}
    {shareDialogOpen && <div className="modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) setShareDialogOpen(false); }}>
      <section className="modal-card chat-share-modal" role="dialog" aria-modal="true" aria-labelledby="chat-share-title">
        <div className="modal-heading"><div><span className="eyebrow">แชร์กับ {textOf(group, "group_name", "name") || "กลุ่มนี้"}</span><h2 id="chat-share-title">เลือกทรัพย์สิน</h2></div><button className="icon-button" onClick={() => setShareDialogOpen(false)} aria-label="ปิด" type="button">×</button></div>
        <p className="chat-share-description">เลือกเฉพาะรายการที่ต้องการให้สมาชิกกลุ่มเข้าถึง การแชร์จะมีผลกับสิทธิ์ของกลุ่ม</p>
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
        })}</div> : !sharingBusy && !shareError ? <EmptyPanel title="ยังไม่มีทรัพย์สิน" description="เพิ่มรายการในพอร์ตของคุณก่อน แล้วกลับมาแชร์กับกลุ่มได้" /> : null}
        <div className="form-actions"><button className="button button-quiet" onClick={() => setShareDialogOpen(false)} disabled={sharingBusy || Boolean(unsharingAssetKey)} type="button">ปิด</button><button className="button button-primary" onClick={() => void shareSelectedAssets()} disabled={sharingBusy || Boolean(unsharingAssetKey) || selectedAssetIds.length === 0} type="button">{sharingBusy ? "กำลังแชร์…" : `แชร์ ${selectedAssetIds.length} รายการ`}</button></div>
      </section>
    </div>}
    {selectedSharedAsset && <SharedAssetDetailDialog key={shareableAssetKey(selectedSharedAsset)} asset={selectedSharedAsset} isOwner={textOf(selectedSharedAsset, "shared_by") === currentUserId} onClose={() => setSelectedSharedAsset(null)} />}
    {confirmationDialog}
  </section>;
}
