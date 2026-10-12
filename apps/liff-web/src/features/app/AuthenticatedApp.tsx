"use client";

import { useState } from "react";
import type { SessionUser } from "@wealthvault/contracts/auth";
import { arrayOf, valueOf } from "@/lib/api-client";
import { clearCachedQueries } from "@/lib/query-cache";
import { CachedApiProvider, useCachedApi } from "@/lib/use-cached-api";
import type { AssetKind } from "./assets/assetKinds";
import { DashboardView } from "./dashboard/DashboardView";
import { NotificationsView } from "./notifications/NotificationsView";
import { PortfolioView } from "./portfolio/PortfolioView";
import { ProfileView } from "./profile/ProfileView";
import { SocialView } from "./social/SocialView";
import type { Section } from "./types";

const navigation: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "ภาพรวม", icon: "◈" },
  { id: "portfolio", label: "พอร์ตของฉัน", icon: "▦" },
  { id: "social", label: "เพื่อนและกลุ่ม", icon: "♧" },
  { id: "notifications", label: "การแจ้งเตือน", icon: "◌" },
  { id: "profile", label: "โปรไฟล์", icon: "○" }
];

export function AuthenticatedApp({ user, onLogout, localPreview = false }: { user: SessionUser; onLogout: () => void; localPreview?: boolean }) {
  return <CachedApiProvider userId={user.id}><AuthenticatedAppContent user={user} onLogout={onLogout} localPreview={localPreview} /></CachedApiProvider>;
}

function AuthenticatedAppContent({ user, onLogout, localPreview }: { user: SessionUser; onLogout: () => void; localPreview: boolean }) {
  const [section, setSection] = useState<Section>("overview");
  const [assetKind, setAssetKind] = useState<AssetKind>("cash");
  const [socialTab, setSocialTab] = useState<"friends" | "groups" | "sharing">("friends");
  const [logoutBusy, setLogoutBusy] = useState(false);
  const notifications = useCachedApi("notifications/", 30_000);
  const hasUnreadNotifications = arrayOf(notifications.data, ["notifications", "data"])
    .some((item) => valueOf(item, "IsRead", "is_read") !== true);

  async function logout() {
    setLogoutBusy(true);
    clearCachedQueries();
    await onLogout();
    setLogoutBusy(false);
  }

  return (
    <div className="app-frame">
      <aside className="side-nav">
        <a className="brand brand-link" href="#overview" onClick={(event) => { event.preventDefault(); setSection("overview"); }}>
          <span className="brand-mark" aria-hidden="true">W</span><span className="brand-name">WealthVault</span>
        </a>
        <div className="side-label">เมนูหลัก</div>
        <nav className="nav-list" aria-label="เมนูหลัก">
          {navigation.map((item) => (
            <button key={item.id} className={`nav-item ${section === item.id ? "is-active" : ""}`} onClick={() => setSection(item.id)} type="button">
              <span className="nav-icon" aria-hidden="true">{item.icon}</span><span>{item.label}</span>
              {item.id === "notifications" && hasUnreadNotifications && <span className="nav-dot" aria-hidden="true" />}
            </button>
          ))}
        </nav>
        <button className="side-user" onClick={() => setSection("profile")} type="button">
          <span className="avatar">{(user.displayName || "W").slice(0, 1).toUpperCase()}</span>
          <span className="side-user-copy"><strong>{user.displayName || "สมาชิก WealthVault"}</strong><small>บัญชี LINE</small></span>
          <span className="side-chevron">⌄</span>
        </button>
      </aside>

      <div className="app-main">
        {localPreview && <div className="preview-banner" role="status">โหมดตัวอย่างในเครื่อง · ใช้ข้อมูลจำลองเท่านั้น · ไม่มีการเชื่อมต่อ LINE หรือ backend</div>}
        <header className="topbar">
          <div className="mobile-brand"><span className="brand-mark">W</span><span className="brand-name">WealthVault</span></div>
          <div className="topbar-context"><span className="live-indicator" />พื้นที่การเงินส่วนตัว</div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="ออกจากระบบ" onClick={() => void logout()} disabled={logoutBusy} type="button">⇥</button>
          </div>
        </header>
        <main className="main-content">
          {section === "overview" && <DashboardView onNavigate={setSection} onOpenSocial={(tab) => { setSocialTab(tab); setSection("social"); }} user={user} />}
          {section === "portfolio" && <PortfolioView kind={assetKind} setKind={setAssetKind} />}
          {section === "social" && <SocialView currentUserId={user.id} tab={socialTab} setTab={setSocialTab} />}
          {section === "notifications" && <NotificationsView query={notifications} />}
          {section === "profile" && <ProfileView user={user} />}
        </main>
        <nav className="mobile-nav" aria-label="เมนูหลักสำหรับมือถือ">
          {navigation.map((item) => (
            <button key={item.id} className={section === item.id ? "is-active" : ""} onClick={() => setSection(item.id)} type="button">
              <span aria-hidden="true">{item.icon}</span><small>{item.label}</small>
            </button>
          ))}
        </nav>
      </div>
      <button className="logout-link" onClick={() => void logout()} disabled={logoutBusy} type="button">ออกจากระบบ</button>
    </div>
  );
}
