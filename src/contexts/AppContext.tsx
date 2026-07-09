import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { systemApi, authApi } from "../api/client";
import type { CloudDriveSystemInfo, AccountStatusResult } from "../types";

export interface Toast {
  id: number;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface AppContextType {
  systemInfo: CloudDriveSystemInfo | null;
  refreshSystemInfo: () => Promise<void>;
  accountStatus: AccountStatusResult | null;
  refreshAccountStatus: () => Promise<void>;
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  serverUrl: string;
  setServerUrl: (url: string) => void;
  apiKey: string;
  setApiKey: (key: string) => void;
  applyConnectionConfig: (url: string, key: string) => Promise<void>;
  logout: () => Promise<void>;
  toasts: Toast[];
  showToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: number) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [systemInfo, setSystemInfo] = useState<CloudDriveSystemInfo | null>(null);
  const [accountStatus, setAccountStatus] = useState<AccountStatusResult | null>(null);
  // Login state: only true if WE have a valid token that works
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("happycd2_serverUrl") || "http://localhost:19798");
  const [apiKey, setApiKeyState] = useState(() => localStorage.getItem("happycd2_apiKey") || "");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { localStorage.setItem("happycd2_serverUrl", serverUrl); }, [serverUrl]);

  const setApiKey = useCallback((key: string) => {
    localStorage.setItem("happycd2_apiKey", key);
    setApiKeyState(key);
  }, []);

  const applyConnectionConfig = useCallback(async (url: string, key: string) => {
    await systemApi.setConfig(url, key || undefined);
    if (key) { await systemApi.setToken(key); }
  }, []);

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => { setToasts((prev) => prev.filter((t) => t.id !== id)); }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Logout: best-effort server logout + always clear local state
  const logout = useCallback(async () => {
    try {
      await authApi.logout(true);
    } catch (e) {
      // Ignore server-side errors - we're clearing local state regardless
      console.error("Server logout failed (ignoring):", e);
    }
    // Always clear local token and go to login page
    setApiKey("");
    try { await systemApi.setToken(""); } catch {}
    setIsLoggedIn(false);
    setSystemInfo(null);
    setAccountStatus(null);
  }, [setApiKey]);

  const refreshSystemInfo = useCallback(async () => {
    try {
      const info = await systemApi.getSystemInfo();
      setSystemInfo(info);
      // Do NOT change isLoggedIn based on GetSystemInfo.IsLogin
      // That field reflects server-side session from ANY client, not our token
    } catch (e: any) {
      // If we get UNAUTHENTICATED, our token is invalid
      const msg = e.message || String(e);
      if (msg.includes("UNAUTHENTICATED")) {
        setIsLoggedIn(false);
      }
      console.error("Failed to get system info:", e);
    }
  }, []);

  const refreshAccountStatus = useCallback(async () => {
    try {
      const status = await authApi.getAccountStatus();
      setAccountStatus(status);
    } catch (e) {
      console.error("Failed to get account status:", e);
    }
  }, []);

  // On mount: configure gRPC connection, then verify token
  useEffect(() => {
    (async () => {
      try {
        // 1. Always configure the gRPC channel first
        await systemApi.setConfig(serverUrl, apiKey || undefined);
        if (apiKey) {
          await systemApi.setToken(apiKey);
        }

        // 2. Get system info (public API, no auth needed)
        try {
          const info = await systemApi.getSystemInfo();
          setSystemInfo(info);
        } catch (e) {
          console.error("GetSystemInfo failed:", e);
        }

        // 3. If we have a stored token, verify it with an authenticated API call
        if (apiKey) {
          try {
            await authApi.getAccountStatus();
            // Token works! We're logged in.
            setIsLoggedIn(true);
          } catch (e: any) {
            // Token is invalid/expired
            console.error("Token verification failed:", e);
            setIsLoggedIn(false);
          }
        } else {
          // No token = show login page
          setIsLoggedIn(false);
        }
      } catch (e) {
        console.error("Init failed:", e);
        setIsLoggedIn(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider
      value={{
        systemInfo, refreshSystemInfo, accountStatus, refreshAccountStatus,
        isLoggedIn, setIsLoggedIn, serverUrl, setServerUrl, apiKey, setApiKey,
        applyConnectionConfig, logout, toasts, showToast, removeToast, loading, setLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
