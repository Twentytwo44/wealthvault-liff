"use client";

import { useState, type FormEvent } from "react";
import { apiRequest, arrayOf, errorMessage, numberOf, textOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { useConfirmation } from "../ConfirmationDialog";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../components/FeedbackPanels";
import { GroupDetailPanel, GroupProfilePanel } from "./GroupDetailPanel";

export function GroupsPanel({ currentUserId }: { currentUserId: string }) {
  const { data, loading, refreshing, error: loadError, refresh } = useCachedApi("group/", 30_000, false);
  const groups = arrayOf(data, ["groups", "data"]);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const { confirm, confirmationDialog } = useConfirmation();
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const [profileGroup, setProfileGroup] = useState<Record<string, unknown> | null>(null);
  const error = loadError || mutationError;

  async function load() {
    setMutationError("");
    await refresh();
  }

  async function removeGroup(group: Record<string, unknown>) {
    const id = textOf(group, "id", "ID");
    if (!id || !await confirm({
      title: "ลบกลุ่มนี้?",
      itemName: textOf(group, "group_name", "name") || "กลุ่มนี้",
      description: "กลุ่มนี้จะถูกนำออกจากรายการของคุณ กรุณาตรวจสอบสมาชิกและข้อมูลที่แชร์ก่อนดำเนินการ",
      confirmLabel: "ลบกลุ่ม"
    })) return;
    setBusy(true);
    try {
      await apiRequest(`group/${id}`, { method: "DELETE" });
      await load();
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (profileGroup) return <GroupProfilePanel
    group={profileGroup}
    onBack={() => setProfileGroup(null)}
    onOpenGroup={() => { setSelected(profileGroup); setProfileGroup(null); }}
  />;
  if (selected) return <GroupDetailPanel group={selected} currentUserId={currentUserId} onBack={() => { setSelected(null); void load(); }} onOpenProfile={() => setProfileGroup(selected)} />;

  return <div className="group-list-layout">
    <section className="panel social-primary-panel"><div className="panel-heading"><div><span className="eyebrow">วงสังคมของฉัน</span><h2>กลุ่ม <span className="count-badge">{groups.length}</span></h2></div><div className="group-list-actions"><button className="icon-button" onClick={() => void load()} aria-label="รีเฟรชกลุ่ม" type="button">↻</button><button className="button button-primary" onClick={() => setCreateOpen(true)} type="button">＋ เพิ่มกลุ่ม</button></div></div>
      {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตกลุ่ม…</div>}
      {error && <ErrorPanel message={error} onRetry={() => void load()} />}
      {loading ? <LoadingPanel label="กำลังโหลดกลุ่ม…" /> : groups.length ? <div className="group-list">{groups.map((group, index) => {
        const id = textOf(group, "id", "ID") || String(index);
        const name = textOf(group, "group_name", "name") || "กลุ่ม WealthVault";
        return <article className="group-row" key={id}>
          <button className="group-open" onClick={() => setSelected(group)} type="button"><span className="group-avatar">{name.slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{name}</strong><small>{numberOf(group, "member_count")} สมาชิก · แตะเพื่อเปิดกลุ่ม</small></span><span className="row-chevron">›</span></button>
          <button className="profile-inline-action group-profile-action" onClick={() => setProfileGroup(group)} type="button" aria-label={`ดูโปรไฟล์กลุ่ม ${name}`}>โปรไฟล์</button>
          <button className="row-delete group-delete" onClick={() => void removeGroup(group)} disabled={busy} type="button" aria-label={`ลบ ${name}`}>×</button>
        </article>;
      })}</div> : !error ? <EmptyPanel title="ยังไม่มีกลุ่ม" description="กดเพิ่มกลุ่มเพื่อจัดการการแชร์กับคนในครอบครัวหรือคนที่คุณไว้ใจ" /> : null}
    </section>
    {createOpen && <CreateGroupDialog onClose={() => setCreateOpen(false)} onCreated={() => { setCreateOpen(false); void load(); }} />}
    {confirmationDialog}
  </div>;
}

function CreateGroupDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [groupName, setGroupName] = useState("");
  const [memberIds, setMemberIds] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = groupName.trim();
    if (!name) return;
    const image = (event.currentTarget.elements.namedItem("profile_image") as HTMLInputElement | null)?.files?.[0];
    const form = new FormData();
    form.set("group_name", name);
    memberIds.split(/[\s,]+/).filter(Boolean).forEach((id) => form.append("member_ids", id));
    if (image) form.append("profile_image", image, image.name);
    setBusy(true);
    setError("");
    try {
      await apiRequest("group/", { method: "POST", body: form });
      onCreated();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="create-group-title">
      <div className="modal-heading"><div><span className="eyebrow">พื้นที่ร่วมกัน</span><h2 id="create-group-title">สร้างกลุ่มใหม่</h2></div><button className="icon-button" onClick={onClose} disabled={busy} aria-label="ปิด" type="button">×</button></div>
      <form className="form-stack" onSubmit={(event) => void create(event)}>
        <label className="field"><span>ชื่อกลุ่ม</span><input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="เช่น ครอบครัว" required maxLength={80} /></label>
        <label className="field"><span>เพิ่มสมาชิกด้วยรหัสบัญชี <small>(ไม่บังคับ, คั่นด้วยเว้นวรรคหรือจุลภาค)</small></span><input value={memberIds} onChange={(event) => setMemberIds(event.target.value)} placeholder="account-id" /></label>
        <label className="field"><span>รูปกลุ่ม <small>(ไม่บังคับ)</small></span><input name="profile_image" type="file" accept="image/*" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions"><button className="button button-quiet" onClick={onClose} disabled={busy} type="button">ยกเลิก</button><button className="button button-primary" type="submit" disabled={busy || !groupName.trim()}>{busy ? "กำลังสร้าง…" : "สร้างกลุ่ม"}</button></div>
      </form>
    </section>
  </div>;
}
