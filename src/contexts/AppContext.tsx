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
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [serverUrl, setServerUrl] = useState(() => localStorage.getItem("happycd2_serverUrl") || "http://localhost:19798");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("happycd2_apiKey") || "");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { localStorage.setItem("happycd2_serverUrl", serverUrl); }, [serverUrl]);
  useEffect(() => { localStorage.setItem("happycd2_apiKey", apiKey); }, [apiKey]);

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

  const refreshSystemInfo = useCallback(async () => {
    try {
      const info = await systemApi.getSystemInfo();
      setSystemInfo(info);
      setIsLoggedIn(!!info.IsLogin);
    } catch (e: any) {
      // If UNAUTHENTICATED or any other error, ensure login page shows
      console.error("Failed to get system info:", e);
      setIsLoggedIn(false);
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

  // On mount: configure gRPC connection, then check system info
  useEffect(() => {
    (async () => {
      try {
        // Configure the Rust gRPC client with persisted server URL and token
        await systemApi.setConfig(serverUrl, apiKey || undefined);
        if (apiKey) {
          await systemApi.setToken(apiKey);
        }
        // Check if we're logged in - this is a public API, should work without token
        await refreshSystemInfo();
      } catch (e) {
        // If config fails, just show the login page
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
        applyConnectionConfig, toasts, showToast, removeToast, loading, setLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
