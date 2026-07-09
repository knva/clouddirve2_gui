import React, { createContext, useContext, useState, useEffect, useCallback } from "react";

type ThemeMode = "dark" | "light" | "auto";

interface ThemeContextType {
  theme: ThemeMode;
  effectiveTheme: "dark" | "light";
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

function getSystemTheme(): "dark" | "light" {
  if (typeof window !== "undefined" && window.matchMedia) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return "dark";
}

function applyTheme(theme: "dark" | "light") {
  const html = document.documentElement;
  html.classList.remove("dark", "light");
  html.classList.add(theme);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    return (localStorage.getItem("happycd2_theme") as ThemeMode) || "dark";
  });
  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">(() => {
    const saved = (localStorage.getItem("happycd2_theme") as ThemeMode) || "dark";
    return saved === "auto" ? getSystemTheme() : saved;
  });

  const applyAndSet = useCallback((t: ThemeMode) => {
    const eff = t === "auto" ? getSystemTheme() : t;
    applyTheme(eff);
    setEffectiveTheme(eff);
  }, []);

  const setTheme = useCallback((t: ThemeMode) => {
    localStorage.setItem("happycd2_theme", t);
    setThemeState(t);
    applyAndSet(t);
  }, [applyAndSet]);

  const toggleTheme = useCallback(() => {
    setTheme(effectiveTheme === "dark" ? "light" : "dark");
  }, [effectiveTheme, setTheme]);

  // Apply theme on mount
  useEffect(() => {
    applyAndSet(theme);
  }, [theme, applyAndSet]);

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyAndSet("auto");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, applyAndSet]);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
