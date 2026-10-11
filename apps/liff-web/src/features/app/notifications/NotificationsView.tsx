"use client";

import { useState } from "react";
import { apiRequest, arrayOf, errorMessage, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";
import { LineNotificationSetting } from "./LineNotificationSetting";

export function NotificationsView({ query }: { query: ReturnType<typeof useCachedApi> }) {
  const { data, loading, refreshing, error: loadError, refresh } = query;
  const items = arrayOf(data, ["notifications", "data"]);
  const [mutationError, setMutationError] = useState("");
  const [busy, setBusy] = useState(false);
  const error = loadError || mutationError;

  async function markRead(item: Record<string, unknown>) {
    const id = textOf(item, "ID", "id");
    if (!id || valueOf(item, "IsRead", "is_read") === true) return;
    setBusy(true);
    try {
      await apiRequest(`notifications/${id}/read`, { method: "PUT" });
      await refresh();
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function markAllRead() {
    setBusy(true);
    setMutationError("");
    try {
      await apiRequest("notifications/read-all", { method: "PUT" });
      await refresh();
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  const unread = items.filter((item) => valueOf(item, "IsRead", "is_read") !== true).length;
  return <>
    <PageHeading eyebrow="อัปเดตจากบัญชีของคุณ" title="การแจ้งเตือน" description="ติดตามคำขอจากเพื่อนและความเคลื่อนไหวที่เกี่ยวข้องกับบัญชีของคุณ" action={unread > 0 ? <button className="button button-quiet" onClick={() => void markAllRead()} disabled={busy} type="button">ทำเครื่องหมายว่าอ่านแล้วทั้งหมด</button> : undefined} />
    <LineNotificationSetting />
    <section className="panel notifications-panel">
      <div className="panel-heading"><div><span className="eyebrow">กล่องข้อความ</span><h2>{unread ? `${unread} รายการที่ยังไม่ได้อ่าน` : "อ่านครบแล้ว"}</h2></div><button className="icon-button" aria-label="รีเฟรช" onClick={() => void refresh()} type="button">↻</button></div>
      {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตการแจ้งเตือน…</div>}
      {error && <ErrorPanel message={error} onRetry={() => void refresh()} />}
      {loading ? <LoadingPanel label="กำลังโหลดการแจ้งเตือน…" /> : items.length ? <div className="notification-list">
        {items.map((item, index) => {
          const read = valueOf(item, "IsRead", "is_read") === true;
          const id = textOf(item, "ID", "id") || String(index);
          const message = textOf(item, "Message", "message") || "มีความเคลื่อนไหวใหม่ในบัญชีของคุณ";
          const date = textOf(item, "CreatedAt", "created_at");
          const sender = textOf(item, "SenderID", "sender_id");
          return <article className={`notification-row ${read ? "is-read" : "is-unread"}`} key={id}>
            <span className="notification-symbol">{textOf(item, "EntityType", "entity_type").toLowerCase().includes("friend") ? "♧" : "◈"}</span>
            <div className="notification-copy"><strong>{message}</strong><p>{sender ? `จาก ${sender} · ` : ""}{date || ""}</p></div>
            {!read && <button className="text-button" onClick={() => void markRead(item)} disabled={busy} type="button">อ่านแล้ว</button>}
            {!read && <span className="unread-dot" />}
          </article>;
        })}
      </div> : !error ? <EmptyPanel title="ยังไม่มีการแจ้งเตือน" description="เมื่อมีความเคลื่อนไหว คุณจะเห็นรายละเอียดได้ที่นี่" /> : null}
    </section>
  </>;
}
