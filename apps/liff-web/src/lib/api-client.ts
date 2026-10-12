import { invalidateCachedQueries } from "./query-cache";

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "ApiError";
  }
}

let localPreviewEnabled = false;

function invalidateAfterMutation(path: string): void {
  const normalized = path.replace(/^\/+/, "");
  if (normalized.startsWith("asset/") || normalized.startsWith("lia")) {
    invalidateCachedQueries(["dashboard", "asset/", "lia"]);
  } else if (normalized.startsWith("friend")) {
    invalidateCachedQueries(["dashboard", "friend/"]);
  } else if (normalized.startsWith("group")) {
    invalidateCachedQueries(["dashboard", "group/"]);
  } else if (normalized.startsWith("notifications")) {
    invalidateCachedQueries(["notifications/"]);
  } else if (normalized.startsWith("user")) {
    invalidateCachedQueries(["user/", "dashboard"]);
  } else {
    invalidateCachedQueries();
  }
}

export function enableLocalPreview(): boolean {
  const available = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_PREVIEW === "true";
  localPreviewEnabled = available;
  return available;
}

export function disableLocalPreview(): void {
  localPreviewEnabled = false;
}

export async function apiRequest<T = unknown>(path: string, options: {
  method?: string;
  body?: FormData | Record<string, unknown> | string;
  invalidatesCache?: boolean;
} = {}): Promise<T> {
  if (localPreviewEnabled && process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_PREVIEW === "true") {
    const { requestLocalPreview } = await import("./local-preview-api");
    const method = options.method ?? (options.body ? "POST" : "GET");
    const result = await requestLocalPreview(path, method, options.body) as T;
    if (options.invalidatesCache !== false && method !== "GET" && method !== "HEAD") invalidateAfterMutation(path);
    return result;
  }

  const safePath = path.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  const headers = new Headers({ Accept: "application/json" });
  const method = options.method ?? (options.body ? "POST" : "GET");
  if (method !== "GET") headers.set("Idempotency-Key", crypto.randomUUID());
  let body: BodyInit | undefined;
  if (options.body instanceof FormData || typeof options.body === "string") {
    body = options.body;
  } else if (options.body) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(options.body);
  }

  let response: Response;
  try {
    response = await fetch(`/api/backend/${safePath}`, {
      method,
      headers,
      body,
      credentials: "same-origin",
      cache: "no-store"
    });
  } catch {
    throw new ApiError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองอีกครั้ง", 0);
  }

  const result: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const code = record(result)?.code;
    if (response.status === 401 && (code === "unauthenticated" || code === "session_expired")) {
      window.dispatchEvent(new Event("wealthvault:session-expired"));
    }
    const message = typeof code === "string" ? errorText(code, response.status) : "ทำรายการไม่สำเร็จ กรุณาลองอีกครั้ง";
    throw new ApiError(message, response.status);
  }
  if (options.invalidatesCache !== false && method !== "GET" && method !== "HEAD") invalidateAfterMutation(path);
  return result as T;
}

function errorText(code: string, status: number): string {
  switch (code) {
    case "unauthenticated":
    case "session_expired": return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่";
    case "session_unavailable": return "ระบบยืนยันตัวตนขัดข้องชั่วคราว";
    case "backend_unavailable": return "ระบบ WealthVault ไม่พร้อมใช้งานชั่วคราว";
    case "request_too_large": return "ไฟล์มีขนาดใหญ่เกินไป (จำกัด 8 MB)";
    case "rate_limited": return "มีการทำรายการถี่เกินไป กรุณารอสักครู่แล้วลองใหม่";
    default: return status >= 500 ? "ระบบขัดข้องชั่วคราว กรุณาลองใหม่" : "ไม่สามารถทำรายการนี้ได้ กรุณาตรวจสอบข้อมูล";
  }
}

export function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function valueOf(source: unknown, ...keys: string[]): unknown {
  const object = record(source);
  if (!object) return undefined;
  for (const key of keys) {
    if (key in object && object[key] !== null && object[key] !== undefined) return object[key];
    const camel = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    if (camel in object && object[camel] !== null && object[camel] !== undefined) return object[camel];
  }
  return undefined;
}

export function textOf(source: unknown, ...keys: string[]): string {
  const value = valueOf(source, ...keys);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function numberOf(source: unknown, ...keys: string[]): number {
  const value = valueOf(source, ...keys);
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(number) ? number : 0;
}

export function arrayOf(source: unknown, preferredKeys: string[] = []): Record<string, unknown>[] {
  const visited = new Set<unknown>();
  const walk = (value: unknown, depth: number): unknown[] | null => {
    if (Array.isArray(value)) return value;
    if (depth > 4) return null;
    const object = record(value);
    if (!object || visited.has(object)) return null;
    visited.add(object);
    for (const key of preferredKeys) {
      if (key in object) {
        const match = walk(object[key], depth + 1);
        if (match) return match;
      }
    }
    for (const key of ["data", "items", "results", "content"]) {
      if (key in object) {
        const match = walk(object[key], depth + 1);
        if (match) return match;
      }
    }
    return null;
  };
  return (walk(source, 0) ?? []).map(record).filter((item): item is Record<string, unknown> => item !== null);
}

export function formatMoney(value: number, currency = "THB"): string {
  return new Intl.NumberFormat("th-TH", { style: "currency", currency, maximumFractionDigits: 2 }).format(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "เกิดข้อผิดพลาด กรุณาลองใหม่";
}
