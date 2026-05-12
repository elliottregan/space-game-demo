// Theme preference stored in localStorage and reflected on <html data-theme>.
// Values: "dark" | "light" | "auto" (auto = follow prefers-color-scheme).

import { ref, watch } from "vue";

export type ThemePref = "dark" | "light" | "auto";

const STORAGE_KEY = "deck-demo-theme";

function readInitial(): ThemePref {
  if (typeof localStorage === "undefined") return "auto";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "dark" || raw === "light" || raw === "auto") return raw;
  } catch {
    // ignore
  }
  return "auto";
}

export const themePref = ref<ThemePref>(readInitial());

function applyToDom(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (pref === "auto") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", pref);
  }
}

function persist(pref: ThemePref): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, pref);
  } catch {
    // ignore
  }
}

watch(
  themePref,
  (v) => {
    applyToDom(v);
    persist(v);
  },
  { immediate: true },
);

export function cycleTheme(): void {
  const next: Record<ThemePref, ThemePref> = {
    auto: "light",
    light: "dark",
    dark: "auto",
  };
  themePref.value = next[themePref.value];
}

export function themeLabel(pref: ThemePref): string {
  if (pref === "dark") return "Dark";
  if (pref === "light") return "Light";
  return "Auto";
}
