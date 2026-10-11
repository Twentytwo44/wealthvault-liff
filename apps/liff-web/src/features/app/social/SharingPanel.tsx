"use client";

import { useRef, useState } from "react";
import { apiRequest, arrayOf, errorMessage, formatMoney, numberOf, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { AssetIdentityIcon, assetLabelForItem } from "../assets/AssetPresentation";
import { assetKinds, type AssetKind } from "../assets/assetKinds";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../components/FeedbackPanels";

export function SharingPanel() {
  const [targetType, setTargetType] = useState<"friend" | "group" | "email">("friend");
  const targetsQuery = useCachedApi(targetType === "group" ? "group/" : "friend/", 30_000, false);
  const targets = arrayOf(targetsQuery.data, [targetType === "friend" ? "friends" : "groups", "data"]);
  const [targetId, setTargetId] = useState("");
  const [emailTarget, setEmailTarget] = useState("");
  const [emailShareDate, setEmailShareDate] = useState("");
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const loadingTargets = targetsQuery.loading;
  const [loadingItems, setLoadingItems] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const selectionGeneration = useRef(0);
  const error = (targetType === "email" ? "" : targetsQuery.error) || mutationError;
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTarget.trim());
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  function changeTargetType(type: "friend" | "group" | "email") {
    if (type === targetType) return;
    selectionGeneration.current += 1;
    setTargetType(type);
    setMutationError("");
    setTargetId("");
    setItems([]);
    setSelectedIds([]);
    if (type === "email") void loadEmailItems();
  }

  async function loadEmailItems() {
    const generation = ++selectionGeneration.current;
    setLoadingItems(true);
    setMutationError("");
    try {
      const aliases: Record<AssetKind, string[]> = {
        account: ["accounts", "data"], cash: ["cash", "data"], invest: ["investments", "investment", "data"],
        insurance: ["insurance", "insurances", "data"], land: ["lands", "land", "data"],
        building: ["buildings", "building", "data"], liability: ["liabilities", "data"]
      };
      const responses = await Promise.all(assetKinds.map(async (kind) => {
        const response = await apiRequest(kind.endpoint);
        return arrayOf(response, aliases[kind.id]).map((item) => ({
          ...item,
          id: textOf(item, "id", "ID"),
          type: kind.id === "invest" ? "investment" : kind.id,
          asset_kind: kind.id
        }));
      }));
      if (selectionGeneration.current === generation) setItems(responses.flat().filter((item) => item.id));
    } catch (cause) {
      if (selectionGeneration.current === generation) setMutationError(errorMessage(cause));
    } finally {
      if (selectionGeneration.current === generation) setLoadingItems(false);
    }
  }

  async function loadSelection(id: string, type = targetType) {
    if (type === "email") return;
    const generation = ++selectionGeneration.current;
    setTargetId(id);
    setItems([]);
    setSelectedIds([]);
    if (!id) return;
    setLoadingItems(true);
    setMutationError("");
    try {
      const response = await apiRequest(`share/${type}/${id}/selection`);
      const nextItems = arrayOf(response, ["items", "data"]);
      if (selectionGeneration.current !== generation) return;
      setItems(nextItems);
      setSelectedIds(nextItems.filter((item) => valueOf(item, "is_shared") === true).map((item) => textOf(item, "id")).filter(Boolean));
    } catch (cause) { if (selectionGeneration.current === generation) setMutationError(errorMessage(cause)); }
    finally { if (selectionGeneration.current === generation) setLoadingItems(false); }
  }

  function toggle(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function saveSharing() {
    if ((targetType === "email" ? !emailValid || (emailShareDate !== "" && emailShareDate < today) : !targetId) || selectedIds.length === 0) return;
    const selectedItems = items.filter((item) => selectedIds.includes(textOf(item, "id")));
    if (!selectedItems.length) return;
    const shareRequest = {
      item_ids: selectedItems.map((item) => textOf(item, "id")),
      item_types: selectedItems.map((item) => textOf(item, "type")),
      [targetType === "friend" ? "friends" : targetType === "group" ? "groups" : "emails"]:
        [{ id: targetType === "email" ? emailTarget.trim().toLowerCase() : targetId,
          ...(targetType === "email" && emailShareDate ? { share_at: emailShareDate } : {}) }]
    };
    setBusy(true);
    setMutationError("");
    try {
      await apiRequest("share/item/", { method: "POST", body: shareRequest });
      setNotice(targetType === "email" ? emailShareDate > today ? `กำหนดวันส่งไปยัง ${emailTarget.trim()} วันที่ ${emailShareDate} แล้ว` : `บันทึกคำขอส่งไปยัง ${emailTarget.trim()} แล้ว` : "บันทึกการแชร์แล้ว");
      if (targetType === "email") setSelectedIds([]);
      else await loadSelection(targetId, targetType);
      window.setTimeout(() => setNotice(""), 3_000);
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  const targetLabel = targetType === "friend" ? "เพื่อน" : targetType === "group" ? "กลุ่ม" : "อีเมล";
  return <div className="sharing-layout">
    <section className="panel sharing-panel">
      <div className="panel-heading"><div><span className="eyebrow">สิทธิ์การเข้าถึง</span><h2>เลือกผู้รับข้อมูล</h2></div><span className="sharing-shield">◇</span></div>
      <div className="target-kind-switch"><button className={targetType === "friend" ? "selected" : ""} onClick={() => changeTargetType("friend")} type="button">♧ เพื่อน</button><button className={targetType === "group" ? "selected" : ""} onClick={() => changeTargetType("group")} type="button">⌂ กลุ่ม</button><button className={targetType === "email" ? "selected" : ""} onClick={() => changeTargetType("email")} type="button">✉ อีเมล</button></div>
      {targetType === "email" ? <div className="email-share-fields"><label className="field"><span>อีเมลผู้รับ</span><input type="email" value={emailTarget} onChange={(event) => setEmailTarget(event.target.value)} placeholder="name@example.com" autoComplete="email" required /></label><label className="field"><span>วันที่ส่ง <small>(ไม่บังคับ · เว้นว่างเพื่อส่งทันที)</small></span><input type="date" value={emailShareDate} min={today} onChange={(event) => setEmailShareDate(event.target.value)} /></label></div> : <label className="field"><span>เลือก{targetLabel}</span><select value={targetId} onChange={(event) => void loadSelection(event.target.value)} disabled={loadingTargets}>
        <option value="">{loadingTargets ? "กำลังโหลด…" : `เลือก${targetLabel}`}</option>
        {targets.map((target, index) => { const id = textOf(target, targetType === "friend" ? "id" : "id", targetType === "friend" ? "friend_id" : "group_id"); const label = textOf(target, targetType === "friend" ? "username" : "group_name", "first_name", "email", "name") || `${targetLabel} ${index + 1}`; return id ? <option key={id} value={id}>{label}</option> : null; })}
      </select></label>}
      <div className="sharing-safety"><span>✓</span><p>{targetType === "email" ? "ระบบจะส่งรายละเอียดรายการที่เลือกไปยังอีเมลนี้โดยตรง โปรดตรวจที่อยู่ผู้รับให้ถูกต้อง เพราะอีเมลที่ส่งแล้วเรียกคืนไม่ได้" : "คุณเป็นผู้ควบคุมการแชร์ เลือกเฉพาะรายการที่ต้องการได้ และไม่มีข้อมูลใดถูกเปิดเผยโดยอัตโนมัติ"}</p></div>
    </section>
    <section className="panel share-items-panel">
      <div className="panel-heading"><div><span className="eyebrow">สิ่งที่จะแชร์</span><h2>รายการทรัพย์สิน</h2></div>{(targetId || targetType === "email") && <span className="count-badge">{selectedIds.length} เลือก</span>}</div>
      {notice && <div className="inline-notice" role="status">✓ {notice}</div>}
      {error && <ErrorPanel message={error} onRetry={() => targetType === "email" ? void loadEmailItems() : targetId ? void loadSelection(targetId) : void targetsQuery.refresh()} />}
      {targetType !== "email" && !targetId ? <EmptyPanel title="เลือกผู้รับก่อน" description="เลือกรายชื่อเพื่อนหรือกลุ่ม เพื่อดูรายการที่แชร์ได้" /> : loadingItems ? <LoadingPanel label="กำลังโหลดรายการที่แชร์ได้…" /> : items.length ? <>
        <div className="share-item-list">{items.map((item, index) => { const id = textOf(item, "id") || String(index); const chosen = selectedIds.includes(id); return <label className={`share-item-option ${chosen ? "selected" : ""}`} key={id}>
          <input type="checkbox" checked={chosen} onChange={() => toggle(id)} />
          <AssetIdentityIcon item={item} /><span className="person-copy"><strong>{textOf(item, "name") || "รายการทรัพย์สิน"}</strong><small>{assetLabelForItem(item)}{valueOf(item, "is_shared") === true ? " · แชร์แล้ว" : ""}</small></span><strong className="asset-amount">{formatMoney(numberOf(item, "value", "amount", "total_value", "coverage_amount", "principal"))}</strong>
        </label>; })}</div>
        <button className="button button-primary full-width" disabled={busy || !selectedIds.length || (targetType === "email" && (!emailValid || (emailShareDate !== "" && emailShareDate < today)))} onClick={() => void saveSharing()} type="button">{busy ? "กำลังบันทึก…" : targetType === "email" ? `${emailShareDate > today ? "กำหนดวันส่ง" : "ส่ง"} ${selectedIds.length} รายการทางอีเมล` : `แชร์ ${selectedIds.length} รายการให้${targetLabel}`}</button>
      </> : <EmptyPanel title="ไม่มีรายการที่แชร์ได้" description="เพิ่มรายการในพอร์ตของคุณก่อน แล้วกลับมาจัดการสิทธิ์การแชร์ได้ที่นี่" />}
    </section>
  </div>;
}
