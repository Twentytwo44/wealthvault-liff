"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest, arrayOf, errorMessage, formatMoney, record, textOf, valueOf } from "@/lib/api-client";
import { useConfirmation } from "../ConfirmationDialog";
import { assetKinds, type AssetKind } from "./assetKinds";
import { AssetIdentityIcon, assetLabelForItem, sharedAssetDetailText, sharedAssetKind, sharedAssetValue } from "./AssetPresentation";

export function SharedAssetDetailDialog({ asset, isOwner, onClose, onEdit }: { asset: Record<string, unknown>; isOwner: boolean; onClose: () => void; onEdit?: () => void }) {
  const [details, setDetails] = useState<Record<string, unknown>>(asset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const kind = sharedAssetKind(asset);
  const assetId = textOf(asset, "id", "ID");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) { if (event.key === "Escape" && !document.querySelector(".confirmation-backdrop")) onClose(); }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const endpoint = assetKinds.find((entry) => entry.id === kind)?.endpoint;
    if (!isOwner || !endpoint || !assetId) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      void apiRequest(`${endpoint}/${assetId}/`).then((response) => {
        if (!active) return;
        const full = record(valueOf(response, "data")) ?? record(response);
        if (full) setDetails({ ...asset, ...full, asset_kind: textOf(asset, "asset_kind") });
      }).catch((cause) => {
        if (active) setError(errorMessage(cause));
      }).finally(() => { if (active) setLoading(false); });
    }, 0);
    return () => { active = false; window.clearTimeout(timer); };
  }, [asset, assetId, isOwner, kind]);

  const value = sharedAssetValue(details) ?? sharedAssetValue(asset);
  const valueLabel = kind === "insurance" ? "วงเงินคุ้มครอง" : kind === "liability" ? "ยอดหนี้คงเหลือ" : "มูลค่า";
  const fields = [
    { label: "ธนาคาร", keys: ["bank_name"] },
    { label: "เลขบัญชี", keys: ["account_number", "bank_account", "bank_acc"] },
    { label: "สัญลักษณ์", keys: ["symbol", "ticker"] },
    { label: "ประเภท", keys: ["type_name", "investment_type"] },
    { label: "โบรกเกอร์", keys: ["broker_name"] },
    { label: "จำนวนหน่วย", keys: ["quantity"] },
    { label: "ราคาต่อหน่วย", keys: ["cost_per_price"] },
    { label: "บริษัทประกัน", keys: ["company_name"] },
    { label: "เลขกรมธรรม์", keys: ["pol_num", "policy_number"] },
    { label: "วันหมดอายุ", keys: ["exp_date_text", "exp_date"] },
    { label: "เลขโฉนด", keys: ["deed_num"] },
    { label: "ขนาดพื้นที่", keys: ["area"] },
    { label: "สถานที่", keys: ["location", "location_text"] },
    { label: "เจ้าหนี้", keys: ["creditor"] },
    { label: "อัตราดอกเบี้ย", keys: ["interest_rate"] },
    { label: "รายละเอียด", keys: ["description", "message"] },
    { label: "บันทึกเมื่อ", keys: ["created_at"] },
    { label: "แก้ไขล่าสุด", keys: ["updated_at"] },
    { label: "แชร์เมื่อ", keys: ["shared_at"] }
  ].map((field) => ({ label: field.label, value: sharedAssetDetailText(field.label, textOf(details, ...field.keys) || textOf(asset, ...field.keys)) }))
    .filter((field) => field.value);

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className="modal-card shared-asset-detail-modal" role="dialog" aria-modal="true" aria-labelledby="shared-asset-title">
      <div className="modal-heading"><div><span className="eyebrow">{onEdit ? "รายละเอียดทรัพย์สิน" : "รายละเอียดทรัพย์สินที่แชร์"}</span><h2 id="shared-asset-title">{textOf(details, "name", "title") || "รายการทรัพย์สิน"}</h2></div><button className="icon-button" onClick={onClose} aria-label="ปิดรายละเอียดทรัพย์สิน" type="button">×</button></div>
      <div className="shared-asset-detail-summary"><AssetIdentityIcon item={details} fallbackType={textOf(asset, "asset_kind") || "ทรัพย์สิน"} /><div><span>{assetLabelForItem({ ...details, asset_kind: textOf(asset, "asset_kind") })}</span><strong>{value === null ? "ไม่ระบุมูลค่า" : formatMoney(value)}</strong><small>{valueLabel}</small></div></div>
      {loading && <p className="shared-asset-detail-status" role="status">กำลังโหลดรายละเอียดล่าสุด…</p>}
      {error && <p className="shared-asset-detail-status" role="status">แสดงข้อมูลที่แชร์ไว้ · โหลดรายละเอียดล่าสุดไม่สำเร็จ</p>}
      {fields.length > 0 ? <dl className="shared-asset-detail-facts">{fields.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl> : <p className="shared-asset-detail-status">รายการนี้ไม่มีข้อมูลเพิ่มเติมที่เปิดให้ดู</p>}
      {isOwner && kind && assetId && <AssetShareRecipients assetId={assetId} kind={kind} assetName={textOf(details, "name", "title") || "ทรัพย์สินนี้"} />}
      <div className="form-actions"><button className={onEdit ? "button button-quiet" : "button button-primary"} onClick={onClose} type="button">ปิด</button>{onEdit && <button className="button button-primary" onClick={onEdit} type="button">แก้ไขรายการ</button>}</div>
    </section>
  </div>;
}

type ShareRecipient = { kind: "friend" | "group" | "email"; id: string; name: string; sharedAt: string; sent?: boolean };

function AssetShareRecipients({ assetId, kind, assetName }: { assetId: string; kind: AssetKind; assetName: string }) {
  const [recipients, setRecipients] = useState<ShareRecipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [revoking, setRevoking] = useState("");
  const { confirm, confirmationDialog } = useConfirmation();
  const itemType = kind === "invest" ? "investment" : kind;

  const loadRecipients = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiRequest(`share/item/${itemType}/${assetId}/shared-targets`);
      const payload = record(valueOf(response, "data")) ?? record(response);
      const friends = arrayOf(payload, ["friends"]).map((item) => ({ kind: "friend" as const, id: textOf(item, "friend_id"), name: textOf(item, "username") || "เพื่อน", sharedAt: textOf(item, "shared_at") }));
      const groups = arrayOf(payload, ["groups"]).map((item) => ({ kind: "group" as const, id: textOf(item, "group_id"), name: textOf(item, "group_name") || "กลุ่ม", sharedAt: textOf(item, "shared_at") }));
      const emails = arrayOf(payload, ["emails"]).map((item) => ({ kind: "email" as const, id: textOf(item, "email"), name: textOf(item, "email"), sharedAt: textOf(item, "shared_at"), sent: valueOf(item, "is_sent") === true }));
      setRecipients([...friends, ...groups, ...emails]);
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, [assetId, itemType]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadRecipients(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadRecipients]);

  async function revoke(recipient: ShareRecipient) {
    if (recipient.kind === "email" || !recipient.id || revoking) return;
    if (!await confirm({
      title: "ยกเลิกการแชร์?",
      itemName: `${assetName} · ${recipient.name}`,
      description: `${recipient.name} จะไม่สามารถดูรายการนี้ผ่านการแชร์ได้อีก ทรัพย์สินต้นฉบับยังอยู่ในพอร์ตของคุณ`,
      confirmLabel: "ยกเลิกแชร์",
      tone: "warning"
    })) return;
    setRevoking(`${recipient.kind}:${recipient.id}`);
    setError("");
    try {
      const response = await apiRequest(`${recipient.kind}/${recipient.id}/item/`);
      const share = arrayOf(response, ["data", "items"]).find((item) => {
        const detail = record(valueOf(item, "asset_detail"));
        const type = textOf(item, "type", "entity_type").toLowerCase();
        return textOf(detail, "id", "ID") === assetId && (!type || type === itemType || (itemType === "investment" && type === "invest"));
      });
      const shareId = recipient.kind === "friend" ? textOf(share, "shared_item_id") : textOf(share, "group_item_id");
      if (!shareId) throw new Error("ไม่พบสิทธิ์การแชร์นี้ กรุณาโหลดข้อมูลใหม่แล้วลองอีกครั้ง");
      await apiRequest(`${recipient.kind}/item/${shareId}/`, { method: "DELETE" });
      await loadRecipients();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setRevoking(""); }
  }

  return <section className="asset-sharing-section" aria-label="ผู้ที่เข้าถึงทรัพย์สินนี้">
    <div className="asset-sharing-heading"><div><span className="eyebrow">สิทธิ์การเข้าถึง</span><h3>แชร์ให้ใครบ้าง</h3></div>{!loading && !error && <span className="count-badge">{recipients.length} ผู้รับ</span>}</div>
    {loading ? <p className="shared-asset-detail-status" role="status">กำลังตรวจสอบผู้รับการแชร์…</p> : error ? <div className="asset-sharing-error"><p role="alert">ตรวจสอบการแชร์ไม่สำเร็จ: {error}</p><button className="text-button" onClick={() => void loadRecipients()} type="button">ลองอีกครั้ง</button></div> : recipients.length ? <div className="asset-recipient-list">{recipients.map((recipient) => {
      const key = `${recipient.kind}:${recipient.id}`;
      const label = recipient.kind === "friend" ? "เพื่อน" : recipient.kind === "group" ? "กลุ่ม" : "อีเมล";
      const status = recipient.kind === "email" ? recipient.sent ? "ส่งแล้ว · เรียกคืนอีเมลไม่ได้" : "รอส่ง" : "เข้าถึงได้";
      return <div className="asset-recipient-row" key={key}><span className="asset-recipient-icon" aria-hidden="true">{recipient.kind === "friend" ? "♧" : recipient.kind === "group" ? "⌂" : "✉"}</span><div className="asset-recipient-copy"><strong>{recipient.name}</strong><small>{label} · {status}{recipient.sharedAt ? ` · ${sharedAssetDetailText("แชร์เมื่อ", recipient.sharedAt)}` : ""}</small></div>{recipient.kind !== "email" && <button className="chat-share-revoke" onClick={() => void revoke(recipient)} disabled={Boolean(revoking) || !recipient.id} type="button" aria-label={`ยกเลิกแชร์ ${assetName} ให้${recipient.name}`}>{revoking === key ? "กำลังยกเลิก…" : "ยกเลิกแชร์"}</button>}</div>;
    })}</div> : <p className="asset-sharing-private">เฉพาะคุณ · ยังไม่ได้แชร์รายการนี้ให้ใคร</p>}
    {confirmationDialog}
  </section>;
}
