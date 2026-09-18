"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_THEME_ID, THEMES, computeThemeRoles, getThemeById } from "@/lib/theme";

const STORAGE_KEY = "ielts-app-theme";

function readStoredThemeId(): string {
  if (typeof window === "undefined") return DEFAULT_THEME_ID;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored && THEMES.some((t) => t.id === stored) ? stored : DEFAULT_THEME_ID;
  } catch {
    return DEFAULT_THEME_ID; // localStorage can throw in a private window / blocked storage
  }
}

function applyTheme(themeId: string) {
  const theme = getThemeById(themeId);
  const roles = computeThemeRoles(theme.colors);
  const root = document.documentElement;
  root.style.setProperty("--background", roles.background);
  root.style.setProperty("--foreground", roles.foreground);
  root.style.setProperty("--surface", roles.surface);
  root.style.setProperty("--border", roles.border);
  root.style.setProperty("--primary", roles.primary);
  root.style.setProperty("--primary-foreground", roles.primaryForeground);
  root.style.setProperty("--input", roles.input);
  root.style.setProperty("--input-foreground", roles.inputForeground);
}

interface ThemeContextValue {
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Lazy initializer: reads localStorage once, synchronously, on first render.
  // On the server (and the pre-hydration client pass) `window` is undefined
  // so this returns the default — the app's actual CSS-variable application
  // (below) happens only in an effect, after hydration, so this never causes
  // rendered markup to differ between server and client.
  const [themeId, setThemeIdState] = useState<string>(() => readStoredThemeId());

  // "Update an external system (the DOM) with React state" — the effect
  // shape this project's set-state-in-effect lint rule explicitly allows,
  // since it calls no setState. An earlier version of this same effect also
  // read localStorage and called setState to sync it into state; that
  // tripped the rule (see git history) — moving the read into the lazy
  // initializer above and keeping this effect DOM-only fixed it.
  useEffect(() => {
    applyTheme(themeId);
  }, [themeId]);

  function setThemeId(id: string) {
    setThemeIdState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Theme still applies for this session via React state; it just won't persist.
    }
  }

  return <ThemeContext.Provider value={{ themeId, setThemeId }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within a ThemeProvider");
  return ctx;
}
