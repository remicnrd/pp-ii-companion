"use client";

import { useEffect } from "react";

type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const effective =
    theme === "system"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : theme;
  root.classList.toggle("dark", effective === "dark");
  root.dataset.theme = theme;
}

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  return (localStorage.getItem("theme") as Theme | null) ?? "system";
}

export function setStoredTheme(theme: Theme) {
  localStorage.setItem("theme", theme);
  applyTheme(theme);
}

export function ThemeProvider() {
  useEffect(() => {
    applyTheme(getStoredTheme());
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return null;
}

// Inline script that runs before paint to avoid theme flash.
export const NO_FLASH_SCRIPT = `
(function(){try{
  var t=localStorage.getItem('theme')||'system';
  var dark=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);
  if(dark)document.documentElement.classList.add('dark');
}catch(e){}})();
`;
