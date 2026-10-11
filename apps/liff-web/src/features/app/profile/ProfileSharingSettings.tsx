"use client";

import { useState, type FormEvent } from "react";
import { apiRequest, arrayOf, errorMessage, record, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";

type ProfileSharingSettingsProps = {
  profile: Record<string, unknown>;
  onBack: () => void;
  onProfileUpdated: (profile: Record<string, unknown>) => void;
};

export function ProfileSharingSettings({ profile, onBack, onProfileUpdated }: ProfileSharingSettingsProps) {
  const friendsQuery = useCachedApi("friend/", 30_000, false);
  const friends = arrayOf(friendsQuery.data, ["friends", "data"]);
  const [enabled, setEnabled] = useState(valueOf(profile, "shared_enabled") === true);
  const [age, setAge] = useState(textOf(profile, "shared_age") || "80");
  const [saving, setSaving] = useState(false);
  const [updatingFriendId, setUpdatingFriendId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const selectedCount = friends.filter((friend) => valueOf(friend, "is_close") === true).length;

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsedAge = Number(age);
    if (!Number.isInteger(parsedAge) || parsedAge < 1 || parsedAge > 120) {
      setError("กรุณาระบุอายุระหว่าง 1–120 ปี");
      return;
    }
    if (enabled && selectedCount === 0) {
      setError("กรุณาเลือกคนใกล้ชิดอย่างน้อย 1 คนก่อนเปิดการแชร์อัตโนมัติ");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    const body = new FormData();
    body.set("shared_age", String(parsedAge));
    body.set("shared_enabled", String(enabled));
    try {
      const response = await apiRequest("user", { method: "PATCH", body });
      onProfileUpdated(record(valueOf(response, "data")) ?? record(response) ?? { ...profile, shared_age: parsedAge, shared_enabled: enabled });
      setNotice("บันทึกการตั้งค่าการแชร์แล้ว");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  async function setCloseFriend(friend: Record<string, unknown>, isClose: boolean) {
    const id = textOf(friend, "id", "ID");
    if (!id || updatingFriendId) return;
    setUpdatingFriendId(id);
    setError("");
    setNotice("");
    try {
      await apiRequest("closefriend", { method: "POST", body: { friend_id: id, is_close: String(isClose) } });
      friendsQuery.update({ data: { friends: friends.map((item) => textOf(item, "id", "ID") === id ? { ...item, is_close: isClose } : item) } });
      setNotice(isClose ? "เพิ่มคนใกล้ชิดแล้ว" : "นำออกจากคนใกล้ชิดแล้ว");
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setUpdatingFriendId("");
    }
  }

  return <>
    <PageHeading eyebrow="โปรไฟล์และความเป็นส่วนตัว" title="ตั้งค่าการแชร์อัตโนมัติ" description="เลือกคนใกล้ชิดและกำหนดว่าเมื่อถึงอายุที่ตั้งไว้ ระบบจะเริ่มแชร์ทรัพย์สินหรือไม่" />
    <button className="back-button" onClick={onBack} type="button">← <span>กลับไปโปรไฟล์</span></button>
    <div className="profile-sharing-layout">
      <section className="panel profile-sharing-panel">
        <div className="panel-heading"><div><span className="eyebrow">เงื่อนไขการแชร์</span><h2>เปิดใช้งานเมื่อถึงอายุที่กำหนด</h2></div></div>
        <p className="sharing-explanation">เมื่อเปิดใช้งานและถึงอายุที่เลือก ระบบจะพยายามแชร์ <strong>ทรัพย์สินและหนี้สินทั้งหมด</strong> ให้คนใกล้ชิดที่เลือกไว้ โดยทำงานอัตโนมัติครั้งเดียว ไม่ใช่การแสดงอายุบนโปรไฟล์เพื่อน</p>
        <form onSubmit={(event) => void saveSettings(event)}>
          <label className="field"><span>อายุที่เริ่มแชร์อัตโนมัติ</span><input name="shared_age" type="number" min="1" max="120" value={age} onChange={(event) => setAge(event.target.value)} required /></label>
          <label className="toggle-row profile-sharing-toggle"><span><strong>เปิดการแชร์อัตโนมัติ</strong><small>{enabled ? "ระบบจะตรวจเงื่อนไขอายุและแชร์ให้คนใกล้ชิด" : "ปิดอยู่: จะไม่เริ่มแชร์อัตโนมัติ"}</small></span><input name="shared_enabled" type="checkbox" checked={enabled} onChange={(event) => setEnabled(event.target.checked)} /></label>
          {enabled && <p className="sharing-warning" role="status">โปรดตรวจสอบรายชื่อคนใกล้ชิดด้านล่างก่อนบันทึก หากคุณถึงอายุที่กำหนดแล้ว ระบบอาจเริ่มแชร์ทุกรายการในรอบตรวจถัดไป</p>}
          {!textOf(profile, "birthday") && <p className="sharing-warning">ยังไม่ได้ระบุวันเกิดในโปรไฟล์ ระบบจึงยังตรวจอายุเพื่อเริ่มแชร์ไม่ได้</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {notice && <p className="inline-notice" role="status">✓ {notice}</p>}
          <div className="form-actions"><button className="button button-primary" disabled={saving} type="submit">{saving ? "กำลังบันทึก…" : "บันทึกการตั้งค่า"}</button></div>
        </form>
      </section>
      <section className="panel profile-sharing-panel">
        <div className="panel-heading"><div><span className="eyebrow">ผู้รับข้อมูล</span><h2>คนใกล้ชิด</h2></div><span className="count-badge">{selectedCount}</span></div>
        <p className="sharing-explanation">เลือกจากเพื่อนที่ตอบรับแล้ว การเปลี่ยนรายชื่อนี้บันทึกทันที แต่ไม่ยกเลิกทรัพย์สินที่เคยแชร์ไปแล้ว</p>
        {friendsQuery.error && <ErrorPanel message={friendsQuery.error} onRetry={() => void friendsQuery.refresh()} />}
        {friendsQuery.loading ? <LoadingPanel label="กำลังโหลดรายชื่อเพื่อน…" /> : friends.length ? <div className="people-list">{friends.map((friend) => {
          const id = textOf(friend, "id", "ID");
          const name = [textOf(friend, "first_name"), textOf(friend, "last_name")].filter(Boolean).join(" ") || textOf(friend, "username", "email") || "เพื่อน WealthVault";
          const isClose = valueOf(friend, "is_close") === true;
          return <label className="person-row profile-close-friend" key={id}>
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <span className="person-copy"><strong>{name}</strong><small>{isClose ? "เลือกเป็นคนใกล้ชิดแล้ว" : "ยังไม่ได้เลือก"}</small></span>
            <input type="checkbox" aria-label={`เลือก ${name} เป็นคนใกล้ชิด`} checked={isClose} disabled={Boolean(updatingFriendId)} onChange={(event) => void setCloseFriend(friend, event.target.checked)} />
          </label>;
        })}</div> : !friendsQuery.error ? <EmptyPanel title="ยังไม่มีเพื่อน" description="เพิ่มเพื่อนและรอให้ตอบรับก่อน จึงจะเลือกเป็นคนใกล้ชิดได้" /> : null}
      </section>
    </div>
  </>;
}
