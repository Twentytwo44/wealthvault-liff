"use client";

import { useRef, useState } from "react";
import { apiRequest, arrayOf, errorMessage, record, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { useConfirmation } from "../ConfirmationDialog";
import { AssetRow } from "../assets/AssetPresentation";
import { SharedAssetDetailDialog } from "../assets/SharedAssetDetailDialog";
import { assetKinds, type AssetKind } from "../assets/assetKinds";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";
import { AssetEditor, type NewAssetShare } from "./AssetEditor";

export function PortfolioView({ kind, setKind }: { kind: AssetKind; setKind: (kind: AssetKind) => void }) {
  const [mutationError, setMutationError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, unknown> | null>(null);
  const [viewing, setViewing] = useState<Record<string, unknown> | null>(null);
  const [notice, setNotice] = useState("");
  const noticeTimer = useRef<number | null>(null);
  const { confirm, confirmationDialog } = useConfirmation();
  const selected = assetKinds.find((asset) => asset.id === kind)!;
  const { data, loading, refreshing, error, refresh } = useCachedApi(`/${selected.endpoint}`, 5 * 60_000);
  const aliases: Record<AssetKind, string[]> = {
    account: ["accounts", "data"], cash: ["cash", "data"], invest: ["investments", "investment", "data"],
    insurance: ["insurance", "insurances", "data"], land: ["lands", "land", "data"], building: ["buildings", "building", "data"], liability: ["liabilities", "data"]
  };
  const items = arrayOf(data, aliases[kind]);

  function showNotice(message: string) {
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current);
    setNotice(message);
    noticeTimer.current = window.setTimeout(() => { setNotice(""); noticeTimer.current = null; }, 4_000);
  }

  function createNew() {
    setEditing(null);
    setEditorOpen(true);
  }

  async function save(form: FormData, sharing?: NewAssetShare) {
    const id = editing ? textOf(editing, "id", "ID") : "";
    setMutationError("");
    const response = await apiRequest(id ? `${selected.endpoint}/${id}/` : `${selected.endpoint}/`, {
      method: id ? "PATCH" : "POST",
      body: form
    });
    setEditorOpen(false);
    void refresh();
    if (id) { showNotice("บันทึกการแก้ไขแล้ว"); return; }
    const recipientCount = (sharing?.friendIds.length ?? 0) + (sharing?.groupIds.length ?? 0) + (sharing?.email ? 1 : 0);
    if (!recipientCount) { showNotice("เพิ่มรายการแล้ว · เฉพาะคุณ"); return; }
    const created = record(valueOf(response, "data")) ?? record(response);
    const createdId = textOf(created, "id", "ID");
    if (!createdId) {
      setMutationError("เพิ่มรายการแล้ว แต่ไม่พบรหัสรายการสำหรับแชร์ กรุณาตรวจสอบรายการในพอร์ต");
      return;
    }
    try {
      await apiRequest("share/item/", { method: "POST", body: {
        item_ids: [createdId], item_types: [kind === "invest" ? "investment" : kind],
        friends: sharing?.friendIds.map((targetId) => ({ id: targetId })) ?? [],
        groups: sharing?.groupIds.map((targetId) => ({ id: targetId })) ?? [],
        emails: sharing?.email ? [{ id: sharing.email.toLowerCase(), ...(sharing.shareDate ? { share_at: sharing.shareDate } : {}) }] : []
      } });
      showNotice(`เพิ่มรายการและแชร์ให้ ${recipientCount} ผู้รับแล้ว`);
    } catch (cause) {
      setMutationError(`เพิ่มรายการแล้ว แต่แชร์ไม่สำเร็จ: ${errorMessage(cause)} · รายการไม่ได้ถูกเพิ่มซ้ำ`);
    }
  }

  async function remove(item: Record<string, unknown>) {
    const id = textOf(item, "id", "ID");
    if (!id || !await confirm({
      title: "ลบรายการนี้?",
      itemName: textOf(item, "name") || "รายการทรัพย์สิน",
      description: "รายการนี้จะถูกนำออกจากพอร์ตของคุณ กรุณาตรวจสอบก่อนดำเนินการ",
      confirmLabel: "ลบรายการ"
    })) return;
    try {
      setMutationError("");
      await apiRequest(`${selected.endpoint}/${id}/`, { method: "DELETE" });
      await refresh();
      showNotice("ลบรายการแล้ว");
    } catch (cause) {
      setMutationError(errorMessage(cause));
    }
  }

  return <>
    <PageHeading eyebrow="จัดการสินทรัพย์และหนี้สิน" title="พอร์ตของฉัน" description="บันทึกและดูแลข้อมูลการเงินของคุณอย่างเป็นส่วนตัว" action={<button className="button button-primary" onClick={createNew} type="button"><span>＋</span> เพิ่มรายการ</button>} />
    <section className="panel portfolio-panel">
      <div className="portfolio-toolbar">
        <div className="segmented-control" role="tablist" aria-label="ประเภทพอร์ต">
          {assetKinds.map((asset) => <button key={asset.id} className={kind === asset.id ? "selected" : ""} role="tab" aria-selected={kind === asset.id} onClick={() => { setMutationError(""); setKind(asset.id); }} type="button">{asset.label}</button>)}
        </div>
        <span className="result-count">{loading ? "กำลังโหลด…" : `${items.length} รายการ`}</span>
      </div>
      {notice && <div className="inline-notice" role="status">✓ {notice}</div>}
      {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตรายการ…</div>}
      {(error || mutationError) && <ErrorPanel message={error || mutationError} onRetry={() => void refresh()} />}
      {loading ? <LoadingPanel label={`กำลังโหลด${selected.label}…`} /> : items.length ? (
        <div className="asset-list">{items.map((item, index) => <div className="asset-row-wrap" key={textOf(item, "id", "ID") || index}>
          <AssetRow item={{ ...item, asset_kind: kind }} onClick={() => setViewing({ ...item, asset_kind: kind })} />
          <button className="row-delete" aria-label={`ลบ ${textOf(item, "name")}`} onClick={() => void remove(item)} type="button">×</button>
        </div>)}</div>
      ) : !error ? <EmptyPanel title={`ยังไม่มี${selected.label}`} description="เพิ่มข้อมูลรายการแรกของคุณได้เลย ระบบจะเก็บข้อมูลไว้ในบัญชีของคุณ" action={<button className="button button-primary" onClick={createNew} type="button">เพิ่มรายการ <span>＋</span></button>} /> : null}
    </section>
    {viewing && <SharedAssetDetailDialog asset={viewing} isOwner onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); setEditorOpen(true); }} />}
    {editorOpen && <AssetEditor kind={selected} item={editing} onClose={() => setEditorOpen(false)} onSave={save} />}
    {confirmationDialog}
  </>;
}
