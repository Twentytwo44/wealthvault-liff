/** The browser never receives this URL. Plain HTTP is allowed only to local Docker in dev. */
export function backendBaseUrl(): URL | null {
  const raw = process.env.WEALTHVAULT_BACKEND_URL;
  if (!raw) return null;

  try {
    const url = new URL(raw);
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/api/") return null;
    if (url.protocol === "https:") return url;
    if (
      process.env.NODE_ENV === "development" &&
      process.env.ALLOW_LOCAL_HTTP_BACKEND === "true" &&
      url.protocol === "http:" &&
      (url.hostname === "127.0.0.1" || url.hostname === "localhost")
    ) return url;
    return null;
  } catch {
    return null;
  }
}
