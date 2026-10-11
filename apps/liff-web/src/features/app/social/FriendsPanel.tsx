"use client";

import { useState, type FormEvent } from "react";
import { apiRequest, arrayOf, errorMessage, textOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import { useConfirmation } from "../ConfirmationDialog";
import { EmptyPanel, ErrorPanel, LoadingPanel } from "../components/FeedbackPanels";
import { FriendDetailPanel, FriendProfilePanel } from "./FriendDetailPanel";

export function FriendsPanel({ currentUserId }: { currentUserId: string }) {
  const friendsQuery = useCachedApi("friend/", 30_000, false);
  const pendingQuery = useCachedApi("friend/pending", 30_000, false);
  const friends = arrayOf(friendsQuery.data, ["friends", "data"]);
  const pending = arrayOf(pendingQuery.data, ["friends", "data"]);
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<Record<string, unknown> | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Record<string, unknown> | null>(null);
  const [profileFriend, setProfileFriend] = useState<Record<string, unknown> | null>(null);
  const [profileFromChat, setProfileFromChat] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mutationError, setMutationError] = useState("");
  const [notice, setNotice] = useState("");
  const { confirm, confirmationDialog } = useConfirmation();
  const loading = friendsQuery.loading || pendingQuery.loading;
  const error = friendsQuery.error || pendingQuery.error || mutationError;

  async function load() {
    setMutationError("");
    await Promise.all([friendsQuery.refresh(), pendingQuery.refresh()]);
  }

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMutationError("");
    setSearchResult(null);
    const body = new FormData();
    body.set("email", query.trim());
    try {
      const response = await apiRequest("user/search", { method: "POST", body, invalidatesCache: false });
      const found = arrayOf(response, ["data"])[0] ?? null;
      setSearchResult(found);
      if (!found) setNotice("ไม่พบบัญชีที่ตรงกับอีเมลนี้");
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function addFriend() {
    if (!searchResult) return;
    const targetId = textOf(searchResult, "id", "ID");
    const body = new FormData();
    body.set("requester_id", targetId);
    setBusy(true);
    setMutationError("");
    try {
      await apiRequest("friend", { method: "POST", body });
      setNotice("ส่งคำขอเป็นเพื่อนแล้ว");
      setSearchResult(null);
      setQuery("");
      await pendingQuery.refresh();
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function acceptRequest(item: Record<string, unknown>, action: "accept" | "reject") {
    const requesterId = textOf(item, "id", "sender_id", "requester_id");
    if (!requesterId) return;
    setBusy(true);
    setMutationError("");
    try {
      await apiRequest("friend/accept", { method: "POST", body: { requester_id: requesterId, action: action === "accept" ? "ACCEPT" : "DECLINE" } });
      await load();
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  async function removeFriend(item: Record<string, unknown>) {
    const id = textOf(item, "id", "ID");
    const name = textOf(item, "username", "first_name") || "เพื่อนคนนี้";
    if (!id || !await confirm({
      title: "ลบเพื่อนคนนี้?",
      itemName: name,
      description: "คุณจะไม่เห็นเพื่อนคนนี้ในรายชื่ออีก และไม่สามารถเปิดแชตจากรายการเพื่อนได้",
      confirmLabel: "ลบเพื่อน"
    })) return;
    setBusy(true);
    try {
      await apiRequest(`friend/${id}`, { method: "DELETE" });
      await load();
      if (textOf(selectedFriend, "id", "ID") === id) setSelectedFriend(null);
    } catch (cause) { setMutationError(errorMessage(cause)); }
    finally { setBusy(false); }
  }

  if (profileFriend) return <FriendProfilePanel
    friend={profileFriend}
    fromChat={profileFromChat}
    onBack={() => {
      setProfileFriend(null);
      setProfileFromChat(false);
      if (!profileFromChat) void load();
    }}
    onOpenChat={(friend) => { setSelectedFriend(friend); setProfileFriend(null); setProfileFromChat(false); }}
  />;

  if (selectedFriend) return <FriendDetailPanel
    friend={selectedFriend}
    currentUserId={currentUserId}
    onBack={() => { setSelectedFriend(null); void load(); }}
    onOpenProfile={() => { setProfileFriend(selectedFriend); setProfileFromChat(true); }}
  />;

  return <div className="social-layout">
    <section className="panel social-primary-panel">
      <div className="panel-heading"><div><span className="eyebrow">เครือข่ายของฉัน</span><h2>เพื่อน <span className="count-badge">{friends.length}</span></h2></div><button className="icon-button" onClick={() => void load()} aria-label="รีเฟรชเพื่อน" type="button">↻</button></div>
      {(friendsQuery.refreshing || pendingQuery.refreshing) && <div className="inline-notice" role="status">กำลังอัปเดตรายชื่อ…</div>}
      {error && <ErrorPanel message={error} onRetry={() => void load()} />}
      {loading ? <LoadingPanel label="กำลังโหลดรายชื่อเพื่อน…" /> : friends.length ? <div className="people-list">{friends.map((friend, index) => {
        const id = textOf(friend, "id", "ID") || String(index);
        const name = [textOf(friend, "first_name"), textOf(friend, "last_name")].filter(Boolean).join(" ") || textOf(friend, "username") || textOf(friend, "email") || "สมาชิก WealthVault";
        return <article className="person-row" key={id}><button className="friend-open" onClick={() => setSelectedFriend(friend)} type="button" aria-label={`เปิดแชตกับ ${name}`}><span className="avatar">{name.slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{name}</strong><small>{textOf(friend, "email") || "เชื่อมต่อแล้ว"}</small></span><span className="row-chevron">›</span></button><button className="profile-inline-action" onClick={() => { setProfileFriend(friend); setProfileFromChat(false); }} type="button" aria-label={`ดูโปรไฟล์ ${name}`}>โปรไฟล์</button><button className="subtle-action" onClick={() => void removeFriend(friend)} disabled={busy} type="button">จัดการ <span>⌄</span></button></article>;
      })}</div> : !error ? <EmptyPanel title="ยังไม่มีเพื่อน" description="ค้นหาจากอีเมลเพื่อส่งคำขอเชื่อมต่อ" /> : null}
    </section>
    <div className="social-side-stack">
      <section className="panel search-panel"><div className="panel-heading"><div><span className="eyebrow">เชื่อมต่อผู้คน</span><h2>ค้นหาเพื่อน</h2></div><span className="search-decoration">⌕</span></div>
        <form className="search-form" onSubmit={(event) => void search(event)}><label className="field"><span>อีเมลบัญชี WealthVault</span><input type="email" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="name@example.com" required /></label><button className="button button-primary full-width" disabled={busy}>{busy ? "กำลังค้นหา…" : "ค้นหาเพื่อน"}</button></form>
        {searchResult && <div className="search-result"><span className="avatar">{(textOf(searchResult, "username", "first_name") || "W").slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{textOf(searchResult, "username", "first_name") || "สมาชิก WealthVault"}</strong><small>{textOf(searchResult, "email")}</small></span><button className="button button-secondary" onClick={() => void addFriend()} disabled={busy} type="button">＋ เพิ่ม</button></div>}
        {notice && <p className="inline-caption" role="status">{notice}</p>}
      </section>
      <section className="panel pending-panel"><div className="panel-heading"><div><span className="eyebrow">รอการตอบกลับ</span><h2>คำขอเป็นเพื่อน <span className="count-badge">{pending.length}</span></h2></div></div>
        {pending.length ? <div className="people-list">{pending.map((item, index) => {
          const id = textOf(item, "id", "sender_id", "requester_id") || String(index);
          const name = textOf(item, "username", "first_name", "email") || "ผู้ใช้ WealthVault";
          return <article className="person-row pending-person" key={id}><span className="avatar avatar-warm">{name.slice(0, 1).toUpperCase()}</span><span className="person-copy"><strong>{name}</strong><small>ส่งคำขอเป็นเพื่อน</small></span><div className="person-actions"><button className="mini-accept" onClick={() => void acceptRequest(item, "accept")} disabled={busy} aria-label="ยอมรับ" type="button">✓</button><button className="mini-reject" onClick={() => void acceptRequest(item, "reject")} disabled={busy} aria-label="ปฏิเสธ" type="button">×</button></div></article>;
        })}</div> : <p className="muted-copy">ไม่มีคำขอใหม่ในขณะนี้</p>}
      </section>
    </div>
    {confirmationDialog}
  </div>;
}
