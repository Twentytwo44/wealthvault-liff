type Entry = { value: unknown; updatedAt: number };

const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const latestRequest = new Map<string, number>();
const MAX_ENTRIES = 100;
let revision = 0;
let requestId = 0;

function putEntry(key: string, value: unknown): void {
  entries.delete(key);
  entries.set(key, { value, updatedAt: Date.now() });
  if (entries.size > MAX_ENTRIES) {
    const oldest = entries.keys().next().value;
    if (oldest !== undefined) entries.delete(oldest);
  }
}

export function readCachedQuery<T>(key: string, staleAfterMs: number): { value: T; fresh: boolean } | null {
  const entry = entries.get(key);
  if (!entry) return null;
  return { value: entry.value as T, fresh: Date.now() - entry.updatedAt < staleAfterMs };
}

export async function loadCachedQuery<T>(
  key: string,
  staleAfterMs: number,
  loader: () => Promise<T>,
  force = false
): Promise<T> {
  const cached = readCachedQuery<T>(key, staleAfterMs);
  if (!force && cached?.fresh) return cached.value;
  const existing = pending.get(key);
  if (!force && existing) return existing as Promise<T>;

  const startedAtRevision = revision;
  const thisRequest = ++requestId;
  latestRequest.set(key, thisRequest);
  const request = loader().then((value) => {
    if (revision === startedAtRevision && latestRequest.get(key) === thisRequest) {
      putEntry(key, value);
    }
    return value;
  }).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  pending.set(key, request);
  return request;
}

export function writeCachedQuery<T>(key: string, value: T): void {
  latestRequest.set(key, ++requestId);
  pending.delete(key);
  putEntry(key, value);
}

export function invalidateCachedQueries(prefixes?: readonly string[]): void {
  const keys = new Set([...entries.keys(), ...pending.keys()]);
  for (const key of keys) {
    const path = key.slice(key.indexOf(":") + 1).replace(/^\/+/, "");
    if (prefixes && !prefixes.some((prefix) => path.startsWith(prefix))) continue;
    const entry = entries.get(key);
    if (entry) entry.updatedAt = Number.NEGATIVE_INFINITY;
    latestRequest.set(key, ++requestId);
    pending.delete(key);
  }
}

export function clearCachedQueries(): void {
  revision += 1;
  entries.clear();
  pending.clear();
  latestRequest.clear();
}
