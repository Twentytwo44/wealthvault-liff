import { formatMoney, numberOf, record, textOf, valueOf } from "@/lib/api-client";
import { assetKinds, type AssetKind } from "./assetKinds";

export function AssetRow({ item, onClick }: { item: Record<string, unknown>; onClick?: () => void }) {
  const name = textOf(item, "name", "title") || "รายการทรัพย์สิน";
  const type = textOf(item, "asset_kind", "type", "asset_type") || "ทรัพย์สิน";
  const value = type.toLowerCase() === "liability"
    ? numberOf(item, "principal", "amount", "value", "total_value")
    : numberOf(item, "amount", "value", "total_value", "coverage_amount");
  const id = textOf(item, "id", "ID");
  return <button className="asset-row" type="button" onClick={onClick} disabled={!onClick}>
    <AssetIdentityIcon item={item} fallbackType={type} /><span className="asset-row-main"><strong>{name}</strong><small>{assetLabelForItem(item, type)}{id ? ` · ${id.slice(0, 8)}` : ""}</small></span><strong className="asset-amount">{formatMoney(value)}</strong><span className="row-chevron">›</span>
  </button>;
}

const cryptoMarks: Record<string, string> = { BTC: "₿", XBT: "₿", ETH: "Ξ", SOL: "◎", XRP: "✕", DOGE: "Ð", LTC: "Ł", BNB: "◆", ADA: "₳", USDT: "₮" };

function assetClass(item: Record<string, unknown>, fallbackType = ""): "stock" | "crypto" | "" {
  const symbol = textOf(item, "symbol", "ticker", "code").toUpperCase();
  const type = [
    textOf(item, "investment_type", "instrument_type", "asset_subtype", "security_type", "sub_type"),
    textOf(item, "type", "asset_type", "item_type"),
    textOf(item, "asset_kind", "asset_category", "category"),
    fallbackType
  ].join(" ").toLowerCase();
  if (/crypto|cryptocurrency|digital[ _-]?asset|digital[ _-]?currency|coin|คริปโต|สินทรัพย์ดิจิทัล/.test(type)) return "crypto";
  if (/stock|equity|share|หุ้น/.test(type)) return "stock";
  const investment = /invest|investment|การลงทุน/.test(type);
  return investment && cryptoMarks[symbol] ? "crypto" : "";
}

function assetSymbol(type: string): string {
  const key = type.toLowerCase();
  if (key.includes("cash")) return "฿";
  if (key.includes("account")) return "▤";
  if (key.includes("invest")) return "⌁";
  if (key.includes("insurance")) return "◇";
  if (key.includes("land") || key.includes("building")) return "⌂";
  if (key.includes("liab") || key.includes("debt")) return "↘";
  return "◈";
}

function assetLabel(type: string): string {
  const labels: Record<string, string> = { account: "บัญชีธนาคาร", cash: "เงินสด", invest: "การลงทุน", investment: "การลงทุน", insurance: "ประกัน", land: "ที่ดิน", building: "อสังหาริมทรัพย์", liability: "หนี้สิน", expense: "หนี้สิน" };
  return labels[type.toLowerCase()] || type;
}

export function assetLabelForItem(item: Record<string, unknown>, fallbackType = "ทรัพย์สิน"): string {
  const category = textOf(item, "asset_kind", "asset_category", "category", "type", "asset_type", "item_type") || fallbackType;
  const kind = assetClass(item, fallbackType);
  const symbol = textOf(item, "symbol", "ticker", "code").toUpperCase();
  const isInvestment = kind !== "" || /invest|investment|การลงทุน/.test(category.toLowerCase());
  const base = kind === "crypto" ? "คริปโต" : kind === "stock" ? "หุ้น" : assetLabel(category);
  return isInvestment && symbol ? `${base} · ${symbol}` : base;
}

export function AssetIdentityIcon({ item, fallbackType = "ทรัพย์สิน" }: { item: Record<string, unknown>; fallbackType?: string }) {
  const category = textOf(item, "asset_kind", "asset_category", "category", "type", "asset_type", "item_type") || fallbackType;
  const kind = assetClass(item, fallbackType);
  const symbol = textOf(item, "symbol", "ticker", "code").toUpperCase();
  const investment = /invest|investment|การลงทุน/.test(category.toLowerCase());
  const mark = kind === "stock" ? "↗" : kind === "crypto" ? cryptoMarks[symbol] || "◉" : assetSymbol(category);
  const variant = kind || (investment ? "investment" : "");
  return <span className={`asset-type-icon${variant ? ` is-${variant}` : ""}`} aria-hidden="true" title={assetLabelForItem(item, fallbackType)}>{mark}</span>;
}

export function sharedAssetKind(asset: Record<string, unknown>): AssetKind | null {
  const type = textOf(asset, "asset_kind", "item_type", "type").toLowerCase();
  const kind = type === "investment" ? "invest" : type;
  return assetKinds.find((entry) => entry.id === kind)?.id ?? null;
}

export function sharedAssetValue(asset: Record<string, unknown>): number | null {
  const value = valueOf(asset, "amount", "value", "coverage_amount", "principal");
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

export function sharedAssetFromResponse(share: Record<string, unknown>): Record<string, unknown> | null {
  const detail = record(valueOf(share, "asset_detail"));
  if (!detail) return null;
  return {
    ...detail,
    id: textOf(detail, "id", "ID"),
    name: textOf(detail, "name", "title") || "รายการทรัพย์สิน",
    asset_kind: textOf(share, "type"),
    shared_item_id: textOf(share, "shared_item_id", "group_item_id"),
    shared_by: textOf(share, "shared_by"),
    shared_at: textOf(share, "shared_at")
  };
}

export function sharedAssetDetailText(label: string, value: string): string {
  if (!["วันหมดอายุ", "บันทึกเมื่อ", "แก้ไขล่าสุด", "แชร์เมื่อ"].includes(label) || !/^\d{4}-\d{2}-\d{2}(?:T|$)/.test(value)) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("th-TH", { dateStyle: "medium", timeStyle: value.includes("T") ? "short" : undefined }).format(date);
}
