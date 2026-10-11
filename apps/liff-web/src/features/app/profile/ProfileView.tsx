"use client";

import { useState, type FormEvent } from "react";
import type { SessionUser } from "@wealthvault/contracts/auth";
import { apiRequest, errorMessage, record, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";
import { ProfileSharingSettings } from "./ProfileSharingSettings";

export function ProfileView({ user }: { user: SessionUser }) {
  const { data, loading, refreshing, error: loadError, refresh, update } = useCachedApi("user/", 5 * 60_000, false);
  const profile = record(valueOf(data, "data")) ?? record(data);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const [showSharingSettings, setShowSharingSettings] = useState(false);
  const error = loadError || mutationError;

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMutationError("");
    const form = new FormData(event.currentTarget);
    const image = form.get("profile_image");
    if (!(image instanceof File) || image.size === 0) form.delete("profile_image");
    try {
      const response = await apiRequest("user", { method: "PATCH", body: form });
      update({ data: record(valueOf(response, "data")) ?? profile });
      setNotice("บันทึกโปรไฟล์แล้ว");
      window.setTimeout(() => setNotice(""), 3_000);
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  const displayName = [textOf(profile, "first_name"), textOf(profile, "last_name")].filter(Boolean).join(" ") || textOf(profile, "username") || user.displayName || "สมาชิก WealthVault";
  if (showSharingSettings) return <ProfileSharingSettings profile={profile ?? {}} onBack={() => setShowSharingSettings(false)} onProfileUpdated={(updated) => update({ data: updated })} />;
  return <>
    <PageHeading eyebrow="ข้อมูลบัญชี" title="โปรไฟล์ของฉัน" description="จัดการข้อมูลส่วนตัวและการตั้งค่าบัญชีของคุณ" />
    {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตโปรไฟล์…</div>}
    {error && <ErrorPanel message={error} onRetry={() => void refresh()} />}
    {loading ? <LoadingPanel label="กำลังโหลดโปรไฟล์…" /> : <div className="profile-layout">
      <section className="panel profile-summary">
        <div className="profile-cover"><span className="cover-orbit orbit-one" /><span className="cover-orbit orbit-two" /></div>
        <div className="profile-avatar-wrap"><span className="profile-avatar">{displayName.slice(0, 1).toUpperCase()}</span></div>
        <div className="profile-person"><h2>{displayName}</h2><p>{textOf(profile, "email") || "บัญชีที่เชื่อมต่อด้วย LINE"}</p><span className="connected-pill"><span /> เชื่อมต่อ LINE แล้ว</span></div>
        <div className="profile-meta"><div><span>ชื่อผู้ใช้</span><strong>{textOf(profile, "username") || "ยังไม่ได้ตั้งชื่อ"}</strong></div><div><span>สถานะบัญชี</span><strong>ใช้งานอยู่</strong></div></div>
      </section>
      <section className="panel profile-form-panel">
        <div className="panel-heading"><div><span className="eyebrow">ข้อมูลส่วนตัว</span><h2>แก้ไขโปรไฟล์</h2></div></div>
        {notice && <div className="inline-notice" role="status">✓ {notice}</div>}
        <form className="form-grid" onSubmit={(event) => void save(event)}>
          <label className="field"><span>ชื่อผู้ใช้</span><input name="username" defaultValue={textOf(profile, "username")} autoComplete="username" /></label>
          <label className="field"><span>ชื่อ</span><input name="first_name" defaultValue={textOf(profile, "first_name")} autoComplete="given-name" /></label>
          <label className="field"><span>นามสกุล</span><input name="last_name" defaultValue={textOf(profile, "last_name")} autoComplete="family-name" /></label>
          <label className="field"><span>วันเกิด</span><input name="birthday" type="date" defaultValue={textOf(profile, "birthday").slice(0, 10)} /></label>
          <label className="field"><span>เบอร์โทรศัพท์</span><input name="phonenumber" type="tel" defaultValue={textOf(profile, "phone_number")} autoComplete="tel" /></label>
          <label className="field field-wide"><span>รูปโปรไฟล์</span><input name="profile_image" type="file" accept="image/*" /></label>
          {error && <p className="form-error field-wide" role="alert">{error}</p>}
          <div className="form-actions field-wide"><button className="button button-primary" disabled={busy} type="submit">{busy ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}</button></div>
        </form>
      </section>
      <section className="panel profile-sharing-entry">
        <div><span className="eyebrow">ความเป็นส่วนตัว</span><h2>การแชร์อัตโนมัติ</h2><p>กำหนดอายุที่เริ่มแชร์ เลือกคนใกล้ชิด และเปิดหรือปิดการแชร์ได้ในหน้าเดียว</p><span className={`sharing-status ${valueOf(profile, "shared_enabled") === true ? "is-on" : ""}`}>{valueOf(profile, "shared_enabled") === true ? "เปิดใช้งาน" : "ปิดอยู่"}</span></div>
        <button className="button button-secondary" onClick={() => setShowSharingSettings(true)} type="button">จัดการการแชร์ <span aria-hidden="true">→</span></button>
      </section>
    </div>}
  </>;
}
