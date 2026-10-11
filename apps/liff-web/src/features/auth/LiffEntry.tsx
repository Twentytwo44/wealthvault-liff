"use client";

import liff from "@line/liff";
import { useEffect, useState, type FormEvent } from "react";
import type { PublicLiffSession, SessionUser } from "@wealthvault/contracts/auth";
import { AuthenticatedApp } from "@/features/app/AuthenticatedApp";
import { disableLocalPreview, enableLocalPreview } from "@/lib/api-client";

type EntryState =
  | { kind: "loading"; message: string }
  | { kind: "error"; message: string }
  | { kind: "local_login" }
  | { kind: "signed_out"; message: string }
  | { kind: "result"; result: PublicLiffSession };

class LoginRequestError extends Error {}

export function LiffEntry() {
  const [state, setState] = useState<EntryState>({ kind: "loading", message: "กำลังตรวจสอบการเข้าสู่ระบบ…" });
  const [localPreview, setLocalPreview] = useState(false);
  const localTestLogin = process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_LOCAL_TEST_LOGIN === "true";

  async function signOut() {
    setState({ kind: "loading", message: "กำลังออกจากระบบ…" });
    if (localPreview) {
      disableLocalPreview();
      setLocalPreview(false);
      setState({ kind: "signed_out", message: "ปิดโหมดตัวอย่างแล้ว รีเฟรชหน้าเพื่อเปิดใหม่" });
      return;
    }
    try {
      const response = await fetch("/api/auth/session", { method: "DELETE", cache: "no-store" });
      if (!response.ok) throw new Error("logout failed");
      setState({ kind: "signed_out", message: "ออกจากระบบแล้ว" });
    } catch {
      setState({ kind: "error", message: "ออกจากระบบไม่สำเร็จ กรุณาลองอีกครั้ง" });
    }
  }

  useEffect(() => {
    let active = true;

    async function start() {
      if (enableLocalPreview()) {
        setLocalPreview(true);
        setState({
          kind: "result",
          result: { status: "authenticated", user: { id: "local-preview-user", displayName: "ผู้ใช้ตัวอย่าง" } }
        });
        return;
      }

      if (localTestLogin) {
        try {
          const existingSession = await fetch("/api/auth/session", { cache: "no-store" });
          if (!existingSession.ok) throw new Error("session lookup failed");
          const session = (await existingSession.json()) as { status?: string; user?: SessionUser };
          if (!active) return;
          setState(session.status === "authenticated" && session.user
            ? { kind: "result", result: { status: "authenticated", user: session.user } }
            : { kind: "local_login" });
        } catch {
          if (active) setState({ kind: "error", message: "ระบบทดสอบในเครื่องไม่พร้อม กรุณาตรวจ Redis และ backend" });
        }
        return;
      }

      const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
      if (!liffId) {
        setState({ kind: "error", message: "ยังไม่ได้ตั้งค่า LIFF ID สำหรับ environment นี้" });
        return;
      }

      try {
        await liff.init({ liffId, withLoginOnExternalBrowser: true });
        if (!active) return;

        if (!liff.isLoggedIn()) {
          setState({ kind: "error", message: "ยังไม่ได้เข้าสู่ระบบ LINE กรุณาลองเปิดลิงก์ LIFF ใหม่" });
          return;
        }

        const existingSession = await fetch("/api/auth/session", { cache: "no-store" });
        if (!existingSession.ok) throw new Error("session lookup failed");
        const session = (await existingSession.json()) as { status?: string; user?: SessionUser };
        if (session.status === "authenticated" && session.user) {
          setState({ kind: "result", result: { status: "authenticated", user: session.user } });
          return;
        }

        const idToken = liff.getIDToken();
        const accessToken = liff.getAccessToken();
        if (!idToken && !accessToken) {
          setState({ kind: "error", message: "LINE ไม่ส่งข้อมูลยืนยันตัวตน กรุณาเปิดผ่านลิงก์ LIFF ในแชท LINE อีกครั้ง" });
          return;
        }

        setState({ kind: "loading", message: "กำลังตรวจสอบบัญชีอย่างปลอดภัย…" });
        const response = await fetch("/api/auth/liff/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          cache: "no-store",
          body: JSON.stringify({ idToken, accessToken })
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null) as { code?: string } | null;
          const message = response.status === 401
            ? "ข้อมูลยืนยันจาก LINE หมดอายุหรือใช้ไม่ได้ กรุณาเปิดลิงก์ LIFF จากแชท LINE ใหม่"
            : response.status === 429
              ? "ลองเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่แล้วลองใหม่"
              : payload?.code === "invalid_origin"
                ? "ที่อยู่เว็บไม่ตรงกับการตั้งค่า LIFF กรุณาตรวจ Endpoint URL"
                : "ระบบยืนยันตัวตนยังไม่พร้อม กรุณาลองใหม่อีกครั้ง";
          throw new LoginRequestError(message);
        }
        const result = (await response.json()) as PublicLiffSession;
        if (active) setState({ kind: "result", result });
      } catch (error) {
        if (active) setState({ kind: "error", message: error instanceof LoginRequestError
          ? error.message
          : "เชื่อมต่อ LINE ไม่สำเร็จ กรุณาตรวจอินเทอร์เน็ตแล้วลองอีกครั้ง" });
      }
    }

    void start();
    return () => { active = false; };
  }, [localTestLogin]);

  const result = state.kind === "result" ? state.result : null;
  if (result?.status === "authenticated") {
    return <AuthenticatedApp user={result.user} onLogout={signOut} localPreview={localPreview} />;
  }
  if (result?.status === "link_required" || result?.status === "onboarding_required") {
    return <ChallengeForm key={`${result.status}:${result.challengeId}`} result={result} onComplete={(next) => setState({ kind: "result", result: next })} />;
  }
  if (state.kind === "local_login") {
    return <LocalTestLogin onComplete={(user) => setState({ kind: "result", result: { status: "authenticated", user } })} />;
  }

  const message = state.kind === "loading"
    ? state.message
    : state.kind === "error"
      ? state.message
      : state.kind === "signed_out"
        ? state.message
        : "";

  return (
    <main className="shell">
      <section className="card" aria-live="polite">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">W</div>
          <div className="brand-name">WealthVault</div>
        </div>
        <h1>จัดการการเงินของคุณ</h1>
        <p className="description">พื้นที่ส่วนตัวสำหรับดูแลทรัพย์สิน หนี้สิน และการแชร์ข้อมูลกับคนที่คุณเลือก</p>
        <div className="status" data-kind={state.kind === "error" ? "error" : result || state.kind === "signed_out" ? "success" : "loading"}>
          {state.kind === "loading" && <span className="spinner" aria-hidden="true" />}
          {message}
        </div>
        {state.kind === "error" && <button className="sign-out" onClick={() => window.location.reload()} type="button">ลองเชื่อมต่ออีกครั้ง</button>}
        {state.kind === "signed_out" && <button className="sign-out" onClick={() => window.location.reload()} type="button">{localTestLogin ? "เข้าสู่ระบบทดสอบอีกครั้ง" : "เข้าสู่ระบบด้วย LINE อีกครั้ง"}</button>}
      </section>
    </main>
  );
}

function LocalTestLogin({ onComplete }: { onComplete: (user: SessionUser) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/local-test/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ email: String(form.get("email") ?? "").trim(), password: String(form.get("password") ?? "") })
      });
      const payload = (await response.json()) as { status?: string; user?: SessionUser };
      if (!response.ok || payload.status !== "authenticated" || !payload.user) throw new Error("login failed");
      onComplete(payload.user);
    } catch {
      setError("เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจบัญชีทดสอบและ backend");
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell"><section className="card challenge-card">
    <div className="brand"><div className="brand-mark" aria-hidden="true">W</div><div className="brand-name">WealthVault</div></div>
    <div className="eyebrow">ทดสอบบนเครื่อง · ไม่ใช้ LINE</div>
    <h1>เข้าสู่ระบบด้วยบัญชีทดสอบ</h1>
    <p className="description">หน้านี้ใช้ backend และฐานข้อมูล local จริง ไม่ใช่ข้อมูลตัวอย่าง</p>
    <form className="challenge-form" onSubmit={(event) => void submit(event)}>
      <label className="field"><span>อีเมล</span><input type="email" name="email" autoComplete="username" required /></label>
      <label className="field"><span>รหัสผ่าน</span><input type="password" name="password" autoComplete="current-password" required /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full-width" disabled={busy} type="submit">{busy ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบทดสอบ"}</button>
    </form>
  </section></main>;
}

function ChallengeForm({ result, onComplete }: { result: Extract<PublicLiffSession, { status: "link_required" | "onboarding_required" }>; onComplete: (result: PublicLiffSession) => void }) {
  const [linking, setLinking] = useState(result.status === "link_required");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const body: Record<string, string> = {
      action: linking ? "link" : "register",
      challengeId: result.challengeId,
      email: String(form.get("email") ?? "").trim()
    };
    if (linking) {
      body.password = String(form.get("password") ?? "");
    } else {
      body.username = String(form.get("username") ?? "").trim();
      body.firstName = String(form.get("firstName") ?? "").trim();
      body.lastName = String(form.get("lastName") ?? "").trim();
      body.password = String(form.get("password") ?? "");
    }
    try {
      const response = await fetch("/api/auth/liff/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify(body)
      });
      const payload = await response.json() as PublicLiffSession & { code?: string };
      if (response.ok && (payload.status === "authenticated" || payload.status === "link_required" || payload.status === "onboarding_required")) {
        onComplete(payload);
        return;
      }
      setError(payload.code === "challenge_rejected" ? "ข้อมูลยืนยันไม่ถูกต้อง หรือรหัสใช้ได้ไม่นาน กรุณาตรวจสอบแล้วลองใหม่" : "ยืนยันบัญชีไม่สำเร็จ กรุณาลองอีกครั้ง");
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  }

  return <main className="shell"><section className="card challenge-card">
    <div className="brand"><div className="brand-mark" aria-hidden="true">W</div><div className="brand-name">WealthVault</div></div>
    <div className="eyebrow">{linking ? "ยืนยันบัญชีเดิม" : "สร้างบัญชีใหม่"}</div>
    <h1>{linking ? "เชื่อมต่อบัญชีกับ LINE" : "เริ่มต้นใช้งาน WealthVault"}</h1>
    <p className="description">{linking ? "เพื่อปกป้องข้อมูลทางการเงิน กรุณายืนยันด้วยรหัสผ่านของบัญชีเดิมก่อนเชื่อมกับ LINE" : "กรอกข้อมูลบัญชีเพื่อเริ่มจัดการทรัพย์สินและหนี้สินของคุณ"}</p>
    <form className="challenge-form" onSubmit={(event) => void submit(event)}>
      <label className="field"><span>อีเมลบัญชี</span><input type="email" name="email" autoComplete="email" required /></label>
      {linking ? <>
        <label className="field"><span>รหัสผ่านของบัญชีเดิม</span><input type="password" name="password" autoComplete="current-password" minLength={8} maxLength={72} required /></label>
      </> : <>
        <label className="field"><span>ชื่อผู้ใช้</span><input name="username" autoComplete="username" minLength={3} maxLength={60} required /></label>
        <div className="form-grid"><label className="field"><span>ชื่อ</span><input name="firstName" autoComplete="given-name" /></label><label className="field"><span>นามสกุล</span><input name="lastName" autoComplete="family-name" /></label></div>
        <label className="field"><span>ตั้งรหัสผ่าน</span><input type="password" name="password" autoComplete="new-password" minLength={8} maxLength={72} required /></label>
      </>}
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary full-width" disabled={busy} type="submit">{busy ? "กำลังยืนยัน…" : linking ? "ยืนยันและเชื่อมบัญชี" : "สร้างบัญชี"}</button>
    </form>
    {result.status === "onboarding_required" && <button className="button button-quiet full-width" onClick={() => { setLinking((current) => !current); setError(""); }} type="button">{linking ? "สร้างบัญชีใหม่" : "มีบัญชีอยู่แล้ว? เชื่อมบัญชีเดิม"}</button>}
    <p className="security-footnote"><span>🔒</span> ข้อมูลยืนยันจะส่งผ่านระบบอย่างปลอดภัยและไม่ถูกบันทึกในเบราว์เซอร์</p>
  </section></main>;
}
