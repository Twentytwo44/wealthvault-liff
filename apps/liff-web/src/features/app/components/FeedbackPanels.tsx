import type { ReactNode } from "react";

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action && <div className="heading-action">{action}</div>}</div>;
}

export function LoadingPanel({ label }: { label: string }) {
  return <div className="loading-panel"><span className="spinner" aria-hidden="true" />{label}</div>;
}

export function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <div className="error-panel"><span className="error-symbol">!</span><div><strong>โหลดข้อมูลไม่สำเร็จ</strong><p>{message}</p></div><button className="button button-quiet" onClick={onRetry} type="button">ลองอีกครั้ง</button></div>;
}

export function EmptyPanel({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="empty-panel"><span className="empty-orbit" aria-hidden="true">◈</span><strong>{title}</strong><p>{description}</p>{action}</div>;
}
