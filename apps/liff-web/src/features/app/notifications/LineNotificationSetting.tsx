"use client";

import { useEffect, useState } from "react";
import { apiRequest, errorMessage, record } from "@/lib/api-client";

function enabledOf(value: unknown): boolean {
  const outer = record(value);
  return record(outer?.data)?.enabled === true;
}

export function LineNotificationSetting() {
  const [enabled, setEnabled] = useState(false);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void apiRequest("notifications/line-settings").then((value) => {
      if (active) {
        setEnabled(enabledOf(value));
        setAvailable(record(record(value)?.data)?.available === true);
      }
    }).catch((cause) => {
      if (active) setError(errorMessage(cause));
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  async function update(next: boolean) {
    setSaving(true);
    setError("");
    try {
      const result = await apiRequest("notifications/line-settings", { method: "PUT", body: { enabled: next } });
      setEnabled(enabledOf(result));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return <section className="panel" aria-label="การแจ้งเตือนใน LINE">
    <label className="toggle-row">
      <span><strong>รับการแจ้งเตือนใน LINE</strong><small>{available ? "คำขอเป็นเพื่อน คำเชิญเข้ากลุ่ม รายการที่แชร์ และเตือนประกัน · ต้องเป็นเพื่อนกับ LINE OA" : "ยังไม่พร้อมใช้งานในสภาพแวดล้อมนี้"}</small></span>
      <input type="checkbox" checked={enabled} disabled={loading || saving || !available} onChange={(event) => void update(event.target.checked)} />
    </label>
    {error && <p role="alert" className="inline-notice">{error}</p>}
  </section>;
}
