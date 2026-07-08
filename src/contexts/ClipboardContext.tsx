import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { readClipboard } from "../api/tauri";

export interface PendingLink {
  id: string;
  url: string;
  type: "magnet" | "ed2k";
  addedAt: number;
}

interface ClipboardContextType {
  // Monitor toggle
  clipboardMonitorEnabled: boolean;
  setClipboardMonitorEnabled: (v: boolean) => void;

  // Pending links
  pendingLinks: PendingLink[];
  removePendingLink: (id: string) => void;
  clearPendingLinks: () => void;
  addPendingLink: (url: string) => void;

  // Stats
  lastClipboardText: string;
}

const ClipboardContext = createContext<ClipboardContextType | null>(null);

export function useClipboard() {
  const ctx = useContext(ClipboardContext);
  if (!ctx) throw new Error("useClipboard must be used within ClipboardProvider");
  return ctx;
}

/// Extract magnet and ed2k links from a text string.
function extractLinks(text: string): { url: string; type: "magnet" | "ed2k" }[] {
  const links: { url: string; type: "magnet" | "ed2k" }[] = [];
  
  // Match magnet links: magnet:?xt=...
  const magnetRegex = /magnet:\?[^\s<>"']+/gi;
  let match;
  while ((match = magnetRegex.exec(text)) !== null) {
    links.push({ url: match[0], type: "magnet" });
  }

  // Match ed2k links: ed2k://|file|...
  const ed2kRegex = /ed2k:\/\/[^\s<>"']+/gi;
  while ((match = ed2kRegex.exec(text)) !== null) {
    links.push({ url: match[0], type: "ed2k" });
  }

  return links;
}

export function ClipboardProvider({ children }: { children: React.ReactNode }) {
  const [clipboardMonitorEnabled, setClipboardMonitorEnabled] = useState(() => {
    return localStorage.getItem("happycd2_clipboard_monitor") === "true";
  });
  const [pendingLinks, setPendingLinks] = useState<PendingLink[]>(() => {
    try {
      const stored = localStorage.getItem("happycd2_pending_links");
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [lastClipboardText, setLastClipboardText] = useState("");
  const lastTextRef = useRef("");

  // Persist monitor toggle
  useEffect(() => {
    localStorage.setItem("happycd2_clipboard_monitor", String(clipboardMonitorEnabled));
  }, [clipboardMonitorEnabled]);

  // Persist pending links
  useEffect(() => {
    localStorage.setItem("happycd2_pending_links", JSON.stringify(pendingLinks));
  }, [pendingLinks]);

  // Clipboard polling
  useEffect(() => {
    if (!clipboardMonitorEnabled) return;

    const pollClipboard = async () => {
      try {
        const text = await readClipboard();
        if (!text || text === lastTextRef.current) return;
        lastTextRef.current = text;
        setLastClipboardText(text);

        const links = extractLinks(text);
        if (links.length === 0) return;

        setPendingLinks((prev) => {
          const existingUrls = new Set(prev.map((l) => l.url));
          const newLinks: PendingLink[] = links
            .filter((l) => !existingUrls.has(l.url))
            .map((l) => ({
              id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              url: l.url,
              type: l.type,
              addedAt: Date.now(),
            }));
          return [...newLinks, ...prev];
        });
      } catch {
        // Silently ignore clipboard errors
      }
    };

    // Poll immediately and then every 2 seconds
    pollClipboard();
    const interval = setInterval(pollClipboard, 2000);
    return () => clearInterval(interval);
  }, [clipboardMonitorEnabled]);

  const removePendingLink = useCallback((id: string) => {
    setPendingLinks((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const clearPendingLinks = useCallback(() => {
    setPendingLinks([]);
  }, []);

  const addPendingLink = useCallback((url: string) => {
    const type: "magnet" | "ed2k" = url.toLowerCase().startsWith("magnet:") ? "magnet" : "ed2k";
    setPendingLinks((prev) => {
      if (prev.some((l) => l.url === url)) return prev;
      return [
        {
          id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          url,
          type,
          addedAt: Date.now(),
        },
        ...prev,
      ];
    });
  }, []);

  return (
    <ClipboardContext.Provider
      value={{
        clipboardMonitorEnabled,
        setClipboardMonitorEnabled,
        pendingLinks,
        removePendingLink,
        clearPendingLinks,
        addPendingLink,
        lastClipboardText,
      }}
    >
      {children}
    </ClipboardContext.Provider>
  );
}
