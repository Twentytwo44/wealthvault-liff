"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

export type ConfirmationOptions = {
  title: string;
  description: string;
  itemName?: string;
  confirmLabel: string;
  tone?: "danger" | "warning";
};

function ConfirmationDialog({ options, onCancel, onConfirm }: {
  options: ConfirmationOptions;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
      if (event.key !== "Tab") return;
      const buttons = dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])");
      if (!buttons?.length) return;
      const first = buttons[0];
      const last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  const tone = options.tone ?? "danger";

  return <div className="modal-backdrop confirmation-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
    <section className="modal-card confirmation-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirmation-title" aria-describedby="confirmation-description" ref={dialogRef}>
      <button className="confirmation-close" onClick={onCancel} type="button" aria-label="ปิดหน้าต่างยืนยัน">×</button>
      <div className={`confirmation-icon is-${tone}`} aria-hidden="true">{tone === "danger" ? "×" : "!"}</div>
      <span className="confirmation-eyebrow">กรุณายืนยันอีกครั้ง</span>
      <h2 id="confirmation-title">{options.title}</h2>
      {options.itemName && <div className="confirmation-subject"><span>รายการที่เลือก</span><strong>{options.itemName}</strong></div>}
      <p id="confirmation-description">{options.description}</p>
      <div className="confirmation-actions">
        <button className="confirmation-cancel" onClick={onCancel} autoFocus type="button">เก็บไว้ก่อน</button>
        <button className={`confirmation-submit is-${tone}`} onClick={onConfirm} type="button">{options.confirmLabel}</button>
      </div>
    </section>
  </div>;
}

export function useConfirmation(): { confirm: (options: ConfirmationOptions) => Promise<boolean>; confirmationDialog: ReactNode } {
  const [options, setOptions] = useState<ConfirmationOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const previousFocus = useRef<HTMLElement | null>(null);

  const confirm = useCallback((nextOptions: ConfirmationOptions) => new Promise<boolean>((resolve) => {
    resolver.current?.(false);
    previousFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resolver.current = resolve;
    setOptions(nextOptions);
  }), []);

  const respond = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
    const focusTarget = previousFocus.current;
    previousFocus.current = null;
    window.requestAnimationFrame(() => focusTarget?.focus());
  }, []);

  useEffect(() => () => {
    resolver.current?.(false);
    resolver.current = null;
  }, []);

  return {
    confirm,
    confirmationDialog: options ? <ConfirmationDialog options={options} onCancel={() => respond(false)} onConfirm={() => respond(true)} /> : null
  };
}
