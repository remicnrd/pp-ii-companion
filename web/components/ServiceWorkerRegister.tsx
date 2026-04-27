"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const base = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/$/, "");
    navigator.serviceWorker.register(`${base}/sw.js`, { scope: `${base}/` }).catch(() => {
      /* swallow */
    });
  }, []);
  return null;
}
