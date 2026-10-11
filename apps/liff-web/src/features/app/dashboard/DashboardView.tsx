"use client";

import type { SessionUser } from "@wealthvault/contracts/auth";
import { arrayOf, formatMoney, numberOf, record, textOf, valueOf } from "@/lib/api-client";
import { useCachedApi } from "@/lib/use-cached-api";
import type { Section } from "../types";
import { AssetRow } from "../assets/AssetPresentation";
import { EmptyPanel, ErrorPanel, LoadingPanel, PageHeading } from "../components/FeedbackPanels";

export function DashboardView({ onNavigate, onOpenSocial, user }: { onNavigate: (section: Section) => void; onOpenSocial: (tab: "friends" | "sharing") => void; user: SessionUser }) {
  const { data, loading, refreshing, error, refresh } = useCachedApi("dashboard", 2 * 60_000);

  const payload = record(valueOf(data, "data")) ?? record(data);
  const netWorth = record(valueOf(payload, "net_worth"));
  const assets = arrayOf(payload, ["assets"]);
  const liabilities = arrayOf(payload, ["liabilities"]);
  const totalAssets = numberOf(netWorth, "total_assets");
  const totalDebt = numberOf(netWorth, "total_liabilities");
  const balance = numberOf(netWorth, "value");

  return <>
    <PageHeading eyebrow="ภาพรวมการเงิน" title={`สวัสดี${user.displayName ? ` คุณ${user.displayName}` : ""}`} description="มองเห็นภาพรวมทรัพย์สินและเป้าหมายทางการเงินของคุณในที่เดียว" action={<button className="button button-quiet" onClick={() => void refresh()} type="button">↻ <span>รีเฟรช</span></button>} />
    {loading && <LoadingPanel label="กำลังโหลดภาพรวมการเงิน…" />}
    {refreshing && <div className="inline-notice" role="status">กำลังอัปเดตข้อมูลล่าสุด…</div>}
    {error && <ErrorPanel message={error} onRetry={() => void refresh()} />}
    {!loading && data !== null && <>
      <section className="net-worth-card">
        <div className="net-worth-top"><div><span className="card-overline">มูลค่าสุทธิรวม</span><span className="privacy-pill"><span /> ส่วนตัว</span></div><span className="period-label">ข้อมูลล่าสุดจากบัญชีของคุณ</span></div>
        <div className="net-worth-value">{formatMoney(balance)}</div>
        <div className="net-worth-breakdown">
          <div><span className="metric-marker positive" /><span>ทรัพย์สิน</span><strong>{formatMoney(totalAssets)}</strong></div>
          <div><span className="metric-marker negative" /><span>หนี้สิน</span><strong>{formatMoney(totalDebt)}</strong></div>
        </div>
        <div className="net-worth-watermark" aria-hidden="true">W</div>
      </section>
      <section className="metric-grid">
        <MetricCard label="รายการทรัพย์สิน" value={String(assets.length)} suffix="รายการ" note="ทรัพย์สินทั้งหมดของคุณ" icon="▤" tone="green" onClick={() => onNavigate("portfolio")} />
        <MetricCard label="เพื่อน" value={String(numberOf(payload, "friend_count"))} suffix="คน" note="เครือข่ายที่เชื่อมต่อ" icon="♧" tone="blue" onClick={() => onOpenSocial("friends")} />
        <MetricCard label="รายการที่แชร์" value={String(numberOf(payload, "unique_shared_item_count"))} suffix="รายการ" note="แชร์กับคนที่คุณเลือก" icon="↗" tone="violet" onClick={() => onOpenSocial("sharing")} />
      </section>
      <div className="content-grid dashboard-lower">
        <section className="panel">
          <div className="panel-heading"><div><span className="eyebrow">รายการล่าสุด</span><h2>ทรัพย์สินของคุณ</h2></div><button className="text-button" onClick={() => onNavigate("portfolio")} type="button">ดูทั้งหมด <span>→</span></button></div>
          {assets.length ? <div className="asset-list compact-list">{assets.slice(0, 5).map((asset, index) => <AssetRow key={textOf(asset, "id", "ID") || index} item={asset} />)}</div> : <EmptyPanel title="ยังไม่มีรายการทรัพย์สิน" description="เพิ่มเงินสด บัญชี หรือรายการลงทุนเพื่อเริ่มต้น" action={<button className="button button-primary" onClick={() => onNavigate("portfolio")} type="button">เพิ่มรายการ <span>＋</span></button>} />}
        </section>
        <section className="panel wellness-panel">
          <div className="panel-heading"><div><span className="eyebrow">ภาพรวม</span><h2>สุขภาพทางการเงิน</h2></div><span className="wellness-icon">✳</span></div>
          <div className="wellness-stat"><strong>{assets.length + liabilities.length}</strong><span>รายการที่บันทึกไว้</span></div>
          <div className="wellness-line"><span style={{ width: `${Math.min(100, Math.round((totalAssets / Math.max(totalAssets + totalDebt, 1)) * 100))}%` }} /></div>
          <div className="wellness-foot"><span>ทรัพย์สิน {Math.round((totalAssets / Math.max(totalAssets + totalDebt, 1)) * 100)}%</span><span>หนี้สิน {Math.round((totalDebt / Math.max(totalAssets + totalDebt, 1)) * 100)}%</span></div>
          <p className="wellness-copy">อัปเดตข้อมูลให้เป็นปัจจุบัน เพื่อเห็นภาพรวมที่แม่นยำของคุณ</p>
          <button className="button button-secondary full-width" onClick={() => onNavigate("portfolio")} type="button">จัดการพอร์ตของฉัน <span>→</span></button>
        </section>
      </div>
    </>}
  </>;
}

function MetricCard({ label, value, suffix, note, icon, tone, onClick }: { label: string; value: string; suffix: string; note: string; icon: string; tone: string; onClick: () => void }) {
  return <button className="metric-card" onClick={onClick} type="button" aria-label={`เปิด${label}`}><span className={`metric-icon ${tone}`}>{icon}</span><span className="metric-copy"><span>{label}</span><strong>{value}<small> {suffix}</small></strong><span className="metric-note">{note}</span></span><span className="metric-arrow" aria-hidden="true">↗</span></button>;
}
