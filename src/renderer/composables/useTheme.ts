import { ref } from "vue";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "theme-preference";
const VALID_THEMES: Theme[] = ["light", "dark", "system"];

function isValidTheme(value: string | null): value is Theme {
  return value !== null && VALID_THEMES.includes(value as Theme);
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return isValidTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

const theme = ref<Theme>(getStoredTheme());

function applyTheme(newTheme: Theme) {
  if (newTheme === "system") {
    document.documentElement.removeAttribute("data-theme");
  } else {
    document.documentElement.setAttribute("data-theme", newTheme);
  }
}

export function setTheme(newTheme: Theme) {
  theme.value = newTheme;

  try {
    if (newTheme === "system") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, newTheme);
    }
  } catch {
    // localStorage unavailable (incognito, storage disabled, etc.)
  }

  applyTheme(newTheme);
}

export function initTheme() {
  const stored = getStoredTheme();
  if (stored !== "system") {
    applyTheme(stored);
    theme.value = stored;
  }
}

export function useTheme() {
  return { theme, setTheme };
}
