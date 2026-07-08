import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { systemApi, authApi } from "../api/client";
import type { CloudDriveSystemInfo, AccountStatusResult } from "../types";

export interface Toast {
  id: number;
  type: "success" | "error" | "info" | "warning";
  message: string;
}

interface AppContextType {
  // System info
  systemInfo: CloudDriveSystemInfo | null;
  refreshSystemInfo: () => Promise<void>;
  
  // Account
  accountStatus: AccountStatusResult | null;
  refreshAccountStatus: () => Promise<void>;
  
  // Auth
  isLoggedIn: boolean;
  setIsLoggedIn: (v: boolean) => void;
  
  // Server config
  serverUrl: string;
  setServerUrl: (url: string) => void;
  
  // Toasts
  toasts: Toast[];
  showToast: (type: Toast["type"], message: string) => void;
  removeToast: (id: number) => void;
  
  // Loading
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
  const [serverUrl, setServerUrl] = useState("http://localhost:19798");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(false);

  const showToast = useCallback((type: Toast["type"], message: string) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const refreshSystemInfo = useCallback(async () => {
    try {
      const info = await systemApi.getSystemInfo();
      setSystemInfo(info);
      setIsLoggedIn(info.IsLogin);
    } catch (e) {
      // Backend might not be running
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

  // On mount, configure backend and check system info
  useEffect(() => {
    (async () => {
      try {
        await systemApi.setConfig(serverUrl);
        await refreshSystemInfo();
        if (isLoggedIn) {
          await refreshAccountStatus();
        }
      } catch (e) {
        console.error("Init failed:", e);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AppContext.Provider
      value={{
        systemInfo,
        refreshSystemInfo,
        accountStatus,
        refreshAccountStatus,
        isLoggedIn,
        setIsLoggedIn,
        serverUrl,
        setServerUrl,
        toasts,
        showToast,
        removeToast,
        loading,
        setLoading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
