"use client";

import { type ReactNode } from "react";

export function Card({
  children,
  className = "",
  soft = false,
  style,
}: {
  children: ReactNode;
  className?: string;
  soft?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={style}
      className={`${soft ? "v2-glass-soft rounded-3xl" : "v2-glass-card"} ${className}`}
    >
      {children}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[11px] uppercase tracking-[0.18em] mb-1"
      style={{ color: "var(--v2-faint)" }}
    >
      {children}
    </p>
  );
}

export function Btn({
  children,
  onClick,
  disabled,
  variant = "ghost",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "ghost";
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "v2-press inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-medium disabled:opacity-40 disabled:pointer-events-none";
  const styles =
    variant === "primary"
      ? { background: "var(--v2-ink)", color: "#0a0a0a" }
      : { background: "var(--v2-glass-strong)", color: "var(--v2-ink)", border: "1px solid var(--v2-line)" };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${className}`} style={styles}>
      {children}
    </button>
  );
}

export function Field({
  value,
  onChange,
  onBlur,
  placeholder,
  multiline = false,
  rows = 3,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}) {
  const cls =
    "w-full rounded-2xl px-3.5 py-3 text-sm leading-relaxed focus:outline-none";
  const style: React.CSSProperties = {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid var(--v2-line)",
    color: "var(--v2-ink)",
  };
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={rows}
        className={`${cls} resize-none`}
        style={style}
      />
    );
  }
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      className={cls}
      style={style}
    />
  );
}

/** Fire after writing self-model data so the layout can re-warm the aurora. */
export function notifySelfModelChanged() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("v2:selfmodel-changed"));
  }
}
