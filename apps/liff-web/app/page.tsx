import { LiffEntry } from "@/features/auth/LiffEntry";

// The nonce CSP is generated per request at the proxy boundary, so the LIFF shell must not be prerendered.
export const dynamic = "force-dynamic";

export default function HomePage() {
  return <LiffEntry />;
}
