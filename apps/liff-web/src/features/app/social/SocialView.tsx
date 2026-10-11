"use client";

import { PageHeading } from "../components/FeedbackPanels";
import { FriendsPanel } from "./FriendsPanel";
import { GroupsPanel } from "./GroupsPanel";
import { SharingPanel } from "./SharingPanel";

export function SocialView({ currentUserId, tab, setTab }: { currentUserId: string; tab: "friends" | "groups" | "sharing"; setTab: (tab: "friends" | "groups" | "sharing") => void }) {
  return <>
    <PageHeading eyebrow="แบ่งปันอย่างที่คุณเลือก" title="เพื่อนและการแชร์" description="เชื่อมต่อกับคนที่คุณไว้ใจ และกำหนดได้เองว่าจะให้ใครเห็นข้อมูลใด" />
    <div className="social-tabs" role="tablist" aria-label="เพื่อนและการแชร์">
      <button className={tab === "friends" ? "selected" : ""} onClick={() => setTab("friends")} role="tab" aria-selected={tab === "friends"} type="button">เพื่อน</button>
      <button className={tab === "groups" ? "selected" : ""} onClick={() => setTab("groups")} role="tab" aria-selected={tab === "groups"} type="button">กลุ่ม</button>
      <button className={tab === "sharing" ? "selected" : ""} onClick={() => setTab("sharing")} role="tab" aria-selected={tab === "sharing"} type="button">จัดการการแชร์</button>
    </div>
    {tab === "friends" && <FriendsPanel currentUserId={currentUserId} />}
    {tab === "groups" && <GroupsPanel currentUserId={currentUserId} />}
    {tab === "sharing" && <SharingPanel />}
  </>;
}
