"use client";

import { useRef, useState, type FormEvent } from "react";
import { arrayOf, errorMessage, textOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { AssetIdentityIcon } from "../assets/AssetPresentation";
import { assetKinds } from "../assets/assetKinds";
import { LoadingPanel } from "../components/FeedbackPanels";

export type NewAssetShare = { friendIds: string[]; groupIds: string[]; email: string; shareDate: string };

export function AssetEditor({ kind, item, onClose, onSave }: { kind: (typeof assetKinds)[number]; item: Record<string, unknown> | null; onClose: () => void; onSave: (form: FormData, sharing?: NewAssetShare) => Promise<void> }) {
  const [step, setStep] = useState<"details" | "share" | "review">("details");
  const [draft, setDraft] = useState<FormData | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [targetType, setTargetType] = useState<"friend" | "group" | "email">("friend");
  const [email, setEmail] = useState("");
  const [shareDate, setShareDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const friendsQuery = useCachedApi("friend/", 30_000, false);
  const groupsQuery = useCachedApi("group/", 30_000, false);
  const friends = arrayOf(friendsQuery.data, ["friends", "data"]);
  const groups = arrayOf(groupsQuery.data, ["groups", "data"]);
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const recipientCount = friendIds.length + groupIds.length + (validEmail ? 1 : 0);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    setError("");
    const form = new FormData(event.currentTarget);
    const attachments = form.getAll("attachments").filter((value): value is File => value instanceof File && value.size > 0);
    form.delete("attachments");
    attachments.forEach((file) => form.append("files", file, file.name));
    if (!item) { setDraft(form); setStep("share"); return; }
    submitting.current = true;
    setBusy(true);
    try { await onSave(form); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  }

  async function confirmCreate() {
    if (!draft || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError("");
    try { await onSave(draft, { friendIds, groupIds, email: validEmail ? email.trim().toLowerCase() : "", shareDate }); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { submitting.current = false; setBusy(false); }
  }

  function toggle(id: string, selected: string[], update: (ids: string[]) => void) {
    update(selected.includes(id) ? selected.filter((value) => value !== id) : [...selected, id]);
  }

  const summary = kind.fields.map((field) => ({ label: field.label, value: String(draft?.get(field.key) ?? "").trim() })).filter((field) => field.value);
  const attachments = draft?.getAll("files").filter((value): value is File => value instanceof File) ?? [];

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card asset-editor-modal" role="dialog" aria-modal="true" aria-labelledby="asset-editor-title">
      <div className="modal-heading"><div><span className="eyebrow">{item ? "แก้ไขข้อมูล" : step === "details" ? "ขั้นที่ 1 จาก 3 · ข้อมูล" : step === "share" ? "ขั้นที่ 2 จาก 3 · การแชร์" : "ขั้นที่ 3 จาก 3 · ตรวจสอบ"}</span><h2 id="asset-editor-title">{item ? "แก้ไข" : step === "review" ? "สรุปการเพิ่ม" : "เพิ่ม"}{kind.label}</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="ปิด" type="button">×</button></div>
      <form onSubmit={(event) => void submit(event)} className="form-grid" hidden={step !== "details"}>
        {kind.fields.map((field) => {
          const initial = textOf(item, field.key);
          return <label className={`field ${field.type === "textarea" ? "field-wide" : ""}`} key={field.key}>
            <span>{field.label}{field.required && <i> *</i>}</span>
            {field.type === "textarea" ? <textarea name={field.key} defaultValue={initial} rows={3} /> : <input name={field.key} type={field.type ?? "text"} defaultValue={initial} placeholder={field.placeholder} required={field.required} step={field.type === "number" ? "any" : undefined} />}
          </label>;
        })}
        <label className="field field-wide"><span>เอกสารหรือรูปภาพ <small>(ไม่บังคับ, สูงสุด 8 MB)</small></span><input name="attachments" type="file" multiple accept="image/*,.pdf" /></label>
        {step === "details" && error && <p className="form-error field-wide" role="alert">{error}</p>}
        <div className="form-actions field-wide"><button className="button button-quiet" onClick={onClose} disabled={busy} type="button">ยกเลิก</button><button className="button button-primary" disabled={busy} type="submit">{busy ? "กำลังบันทึก…" : item ? "บันทึกข้อมูล" : "ถัดไป · เลือกการแชร์"}</button></div>
      </form>
      {!item && step === "share" && <div className="asset-create-step">
        <p className="chat-share-description">เลือกเพื่อนได้หลายคน จะเพิ่มกลุ่มหรืออีเมลด้วยก็ได้ หากไม่เลือก รายการจะเป็นส่วนตัว</p>
        <div className="target-kind-switch" role="tablist" aria-label="ประเภทผู้รับ"><button className={targetType === "friend" ? "selected" : ""} role="tab" aria-selected={targetType === "friend"} onClick={() => setTargetType("friend")} type="button">♧ เพื่อน{friendIds.length ? ` ${friendIds.length}` : ""}</button><button className={targetType === "group" ? "selected" : ""} role="tab" aria-selected={targetType === "group"} onClick={() => setTargetType("group")} type="button">⌂ กลุ่ม{groupIds.length ? ` ${groupIds.length}` : ""}</button><button className={targetType === "email" ? "selected" : ""} role="tab" aria-selected={targetType === "email"} onClick={() => setTargetType("email")} type="button">✉ อีเมล{validEmail ? " 1" : ""}</button></div>
        {targetType === "friend" && <div className="asset-share-section" role="tabpanel"><strong>เพื่อน · เลือกได้หลายคน</strong>{friendsQuery.loading ? <LoadingPanel label="กำลังโหลดเพื่อน…" /> : friendsQuery.error ? <p className="form-error">โหลดเพื่อนไม่สำเร็จ: {friendsQuery.error} <button className="text-button" onClick={() => void friendsQuery.refresh()} type="button">ลองอีกครั้ง</button></p> : friends.length ? <div className="asset-share-picker-list">{friends.map((friend) => {
          const id = textOf(friend, "id", "friend_id");
          const name = textOf(friend, "username", "first_name", "email", "name") || "เพื่อน";
          return id ? <label className={`asset-share-picker-row ${friendIds.includes(id) ? "selected" : ""}`} key={id}><input type="checkbox" checked={friendIds.includes(id)} onChange={() => toggle(id, friendIds, setFriendIds)} /><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{name}</strong><small>{textOf(friend, "email") || "เพื่อน WealthVault"}</small></span></label> : null;
        })}</div> : <p className="post-save-share-help">ยังไม่มีเพื่อนในบัญชี</p>}</div>}
        {targetType === "group" && <div className="asset-share-section" role="tabpanel"><strong>กลุ่ม</strong>{groupsQuery.loading ? <LoadingPanel label="กำลังโหลดกลุ่ม…" /> : groupsQuery.error ? <p className="form-error">โหลดกลุ่มไม่สำเร็จ: {groupsQuery.error} <button className="text-button" onClick={() => void groupsQuery.refresh()} type="button">ลองอีกครั้ง</button></p> : groups.length ? <div className="asset-share-picker-list">{groups.map((group) => {
          const id = textOf(group, "id", "group_id");
          const name = textOf(group, "group_name", "name") || "กลุ่ม";
          return id ? <label className={`asset-share-picker-row ${groupIds.includes(id) ? "selected" : ""}`} key={id}><input type="checkbox" checked={groupIds.includes(id)} onChange={() => toggle(id, groupIds, setGroupIds)} /><span className="group-avatar">{name.slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{name}</strong><small>กลุ่ม WealthVault</small></span></label> : null;
        })}</div> : <p className="post-save-share-help">ยังไม่มีกลุ่มในบัญชี</p>}</div>}
        {targetType === "email" && <div className="asset-share-section" role="tabpanel"><strong>อีเมล <small>(ไม่บังคับ)</small></strong><label className="field"><span>ที่อยู่ผู้รับ</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" autoComplete="email" /></label>{email && <label className="field"><span>วันที่ส่ง <small>(เว้นว่างเพื่อส่งทันที)</small></span><input type="date" value={shareDate} min={today} onChange={(event) => setShareDate(event.target.value)} /></label>}</div>}
        {email && !validEmail && <p className="form-error" role="alert">กรุณากรอกอีเมลให้ถูกต้อง หรือเว้นว่างไว้</p>}
        <div className="form-actions"><button className="button button-quiet" onClick={() => setStep("details")} type="button">ย้อนกลับ</button><button className="button button-primary" onClick={() => { setError(""); setStep("review"); }} disabled={Boolean(email) && (!validEmail || Boolean(shareDate && shareDate < today))} type="button">ดูสรุป · {recipientCount ? `${recipientCount} ผู้รับ` : "เฉพาะคุณ"}</button></div>
      </div>}
      {!item && step === "review" && <div className="asset-create-step">
        <div className="post-save-share-asset"><AssetIdentityIcon item={{ asset_kind: kind.id }} /><div><strong>{String(draft?.get("name") ?? "รายการใหม่")}</strong><small>{kind.label} · ยังไม่ได้เพิ่ม</small></div></div>
        <dl className="shared-asset-detail-facts">{summary.map((field) => <div key={field.label}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}{attachments.length > 0 && <div><dt>เอกสารหรือรูปภาพ</dt><dd>{attachments.map((file) => file.name).join(", ")}</dd></div>}</dl>
        <div className="asset-review-recipients"><strong>การแชร์ · {recipientCount ? `${recipientCount} ผู้รับ` : "เฉพาะคุณ"}</strong>{recipientCount ? <ul>{friends.filter((friend) => friendIds.includes(textOf(friend, "id", "friend_id"))).map((friend) => <li key={`f:${textOf(friend, "id", "friend_id")}`}>เพื่อน · {textOf(friend, "username", "first_name", "email", "name") || "เพื่อน"}</li>)}{groups.filter((group) => groupIds.includes(textOf(group, "id", "group_id"))).map((group) => <li key={`g:${textOf(group, "id", "group_id")}`}>กลุ่ม · {textOf(group, "group_name", "name") || "กลุ่ม"}</li>)}{validEmail && <li>อีเมล · {email.trim().toLowerCase()}{shareDate ? ` · ส่งวันที่ ${shareDate}` : ""}</li>}</ul> : <p>ยังไม่มีใครเข้าถึงรายการนี้</p>}</div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button button-quiet" onClick={() => setStep("details")} disabled={busy} type="button">แก้ข้อมูล</button><button className="button button-quiet" onClick={() => setStep("share")} disabled={busy} type="button">แก้การแชร์</button><button className="button button-primary" onClick={() => void confirmCreate()} disabled={busy} type="button">{busy ? "กำลังเพิ่ม…" : "ยืนยันเพิ่มรายการ"}</button></div>
      </div>}
    </section>
  </div>;
}
