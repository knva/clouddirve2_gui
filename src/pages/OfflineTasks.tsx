import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { useClipboard, type PendingLink } from "../contexts/ClipboardContext";
import { offlineApi, cloudApi } from "../api/client";
import { formatSize, formatDate } from "../utils";
import type { OfflineFile } from "../types";
import {
  Plus, Trash2, RefreshCw, Loader2, Download, Link2, X, Magnet,
  ClipboardCheck, ClipboardList, CheckSquare, Square, Send, Zap,
} from "lucide-react";

export default function OfflineTasks() {
  const { showToast } = useApp();
  const {
    clipboardMonitorEnabled, setClipboardMonitorEnabled,
    pendingLinks, removePendingLink, clearPendingLinks,
  } = useClipboard();
  const [clouds, setClouds] = useState<any[]>([]);
  const [selectedCloud, setSelectedCloud] = useState<string>("");
  const [offlineFiles, setOfflineFiles] = useState<OfflineFile[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addFolder, setAddFolder] = useState("/");
  const [selectedLinks, setSelectedLinks] = useState<Set<string>>(new Set());
  const [pushFolder, setPushFolder] = useState("/");
  const [pushing, setPushing] = useState(false);

  const loadClouds = useCallback(async () => {
    try {
      const result = await cloudApi.list();
      setClouds(result.apis || []);
      if (result.apis && result.apis.length > 0 && !selectedCloud) {
        setSelectedCloud(result.apis[0].name);
      }
    } catch (e: any) {
      showToast("error", `加载云盘列表失败: ${e.message}`);
    }
  }, [showToast, selectedCloud]);

  const loadOfflineFiles = useCallback(async () => {
    if (!selectedCloud) return;
    setLoading(true);
    try {
      const result = await offlineApi.listAll(selectedCloud, "", 1);
      setOfflineFiles(result.offlineFiles || []);
      setQuota(result.status);
    } catch (e: any) {
      showToast("error", `加载离线文件失败: ${e.message}`);
      setOfflineFiles([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCloud, showToast]);

  useEffect(() => {
    loadClouds();
  }, [loadClouds]);

  useEffect(() => {
    loadOfflineFiles();
    const interval = setInterval(loadOfflineFiles, 5000);
    return () => clearInterval(interval);
  }, [loadOfflineFiles]);

  const handleAdd = async () => {
    if (!addUrl.trim()) {
      showToast("warning", "请输入URL或磁力链接");
      return;
    }
    try {
      await offlineApi.add(addUrl, addFolder);
      showToast("success", "离线下载任务已添加");
      setAddUrl("");
      setShowAdd(false);
      loadOfflineFiles();
    } catch (e: any) {
      showToast("error", `添加失败: ${e.message}`);
    }
  };

  const handleRemove = async (file: OfflineFile) => {
    if (!confirm(`确定删除离线任务: ${file.name}？`)) return;
    try {
      await offlineApi.remove(selectedCloud, "", false, [file.infoHash]);
      showToast("success", "删除成功");
      loadOfflineFiles();
    } catch (e: any) {
      showToast("error", `删除失败: ${e.message}`);
    }
  };

  const handleClear = async (filter: string) => {
    try {
      await offlineApi.clear(selectedCloud, "", filter, false);
      showToast("success", "清理成功");
      loadOfflineFiles();
    } catch (e: any) {
      showToast("error", `清理失败: ${e.message}`);
    }
  };

  // Push a single pending link to offline download
  const handlePushSingle = async (link: PendingLink) => {
    try {
      await offlineApi.add(link.url, pushFolder);
      showToast("success", `已推送: ${link.url.substring(0, 50)}...`);
      removePendingLink(link.id);
      loadOfflineFiles();
    } catch (e: any) {
      showToast("error", `推送失败: ${e.message}`);
    }
  };

  // Push selected pending links in batch
  const handlePushBatch = async () => {
    const linksToPush = pendingLinks.filter((l) => selectedLinks.has(l.id));
    if (linksToPush.length === 0) {
      showToast("warning", "请先选择要推送的链接");
      return;
    }
    setPushing(true);
    let successCount = 0;
    let failCount = 0;
    for (const link of linksToPush) {
      try {
        await offlineApi.add(link.url, pushFolder);
        removePendingLink(link.id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setPushing(false);
    setSelectedLinks(new Set());
    if (successCount > 0) {
      showToast("success", `成功推送 ${successCount} 个链接${failCount > 0 ? `，失败 ${failCount} 个` : ""}`);
    } else {
      showToast("error", `全部推送失败 (${failCount} 个)`);
    }
    loadOfflineFiles();
  };

  // Push all pending links
  const handlePushAll = async () => {
    if (pendingLinks.length === 0) {
      showToast("warning", "没有待推送的链接");
      return;
    }
    setPushing(true);
    let successCount = 0;
    let failCount = 0;
    for (const link of [...pendingLinks]) {
      try {
        await offlineApi.add(link.url, pushFolder);
        removePendingLink(link.id);
        successCount++;
      } catch {
        failCount++;
      }
    }
    setPushing(false);
    if (successCount > 0) {
      showToast("success", `成功推送 ${successCount} 个链接${failCount > 0 ? `，失败 ${failCount} 个` : ""}`);
    } else {
      showToast("error", `全部推送失败 (${failCount} 个)`);
    }
    loadOfflineFiles();
  };

  const toggleSelect = (id: string) => {
    setSelectedLinks((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLinks.size === pendingLinks.length) {
      setSelectedLinks(new Set());
    } else {
      setSelectedLinks(new Set(pendingLinks.map((l) => l.id)));
    }
  };

  const statusLabels: Record<number, { label: string; color: string }> = {
    0: { label: "初始化", color: "text-slate-400" },
    1: { label: "下载中", color: "text-blue-400" },
    2: { label: "已完成", color: "text-green-400" },
    3: { label: "错误", color: "text-red-400" },
    4: { label: "未知", color: "text-slate-500" },
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <select
          value={selectedCloud}
          onChange={(e) => setSelectedCloud(e.target.value)}
          className="px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
        >
          <option value="">选择云盘</option>
          {clouds.map((c) => (
            <option key={c.name} value={c.name}>{c.name}</option>
          ))}
        </select>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> 添加离线任务
        </button>
        <button
          onClick={loadOfflineFiles}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <div className="flex-1" />
        <button onClick={() => handleClear("Finished")} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">清除已完成</button>
        <button onClick={() => handleClear("Error")} className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded text-sm">清除错误</button>
        <button onClick={() => handleClear("All")} className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm">清除全部</button>
      </div>

      {/* Clipboard Monitor Toggle + Pending Links */}
      <div className="mb-4 glass rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <ClipboardList className="w-5 h-5 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">剪贴板监听</h3>
            <span className="text-xs text-slate-500">
              自动捕获 magnet / ed2k 链接
            </span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className={`text-xs ${clipboardMonitorEnabled ? "text-green-400" : "text-slate-500"}`}>
              {clipboardMonitorEnabled ? "已开启" : "已关闭"}
            </span>
            <div
              onClick={() => setClipboardMonitorEnabled(!clipboardMonitorEnabled)}
              className={`relative w-11 h-6 rounded-full transition-colors ${clipboardMonitorEnabled ? "bg-blue-600" : "bg-slate-700"}`}
            >
              <div
                className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${clipboardMonitorEnabled ? "translate-x-5" : ""}`}
              />
            </div>
          </label>
        </div>

        {pendingLinks.length > 0 && (
          <>
            {/* Push controls */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <input
                type="text"
                value={pushFolder}
                onChange={(e) => setPushFolder(e.target.value)}
                placeholder="保存到文件夹"
                className="flex-1 min-w-[200px] px-3 py-1.5 bg-slate-800 rounded-lg text-white text-xs border border-slate-700 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs"
              >
                {selectedLinks.size === pendingLinks.length && pendingLinks.length > 0 ? (
                  <CheckSquare className="w-3.5 h-3.5" />
                ) : (
                  <Square className="w-3.5 h-3.5" />
                )}
                {selectedLinks.size === pendingLinks.length && pendingLinks.length > 0 ? "取消全选" : "全选"}
              </button>
              <button
                onClick={handlePushBatch}
                disabled={pushing || selectedLinks.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs disabled:opacity-50"
              >
                {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                推送选中 ({selectedLinks.size})
              </button>
              <button
                onClick={handlePushAll}
                disabled={pushing}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs disabled:opacity-50"
              >
                {pushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                全部推送 ({pendingLinks.length})
              </button>
              <button
                onClick={clearPendingLinks}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs"
              >
                <Trash2 className="w-3.5 h-3.5" /> 清空列表
              </button>
            </div>

            {/* Pending links list */}
            <div className="space-y-1.5 max-h-48 overflow-auto">
              {pendingLinks.map((link) => (
                <div
                  key={link.id}
                  className="flex items-center gap-2 p-2 bg-slate-800/50 rounded-lg hover:bg-slate-800/80 transition-colors"
                >
                  <button
                    onClick={() => toggleSelect(link.id)}
                    className="text-slate-400 hover:text-white"
                  >
                    {selectedLinks.has(link.id) ? (
                      <CheckSquare className="w-4 h-4 text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    {link.type === "magnet" ? (
                      <Magnet className="w-3.5 h-3.5 text-purple-400" />
                    ) : (
                      <Link2 className="w-3.5 h-3.5 text-cyan-400" />
                    )}
                    <span className={`text-xs font-medium ${link.type === "magnet" ? "text-purple-400" : "text-cyan-400"}`}>
                      {link.type === "magnet" ? "磁力" : "ED2K"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-slate-300 truncate" title={link.url}>{link.url}</div>
                    <div className="text-xs text-slate-600">{new Date(link.addedAt).toLocaleTimeString("zh-CN")}</div>
                  </div>
                  <button
                    onClick={() => handlePushSingle(link)}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-600/80 hover:bg-blue-600 text-white rounded text-xs whitespace-nowrap"
                    title="推送离线下载"
                  >
                    <Send className="w-3 h-3" /> 推送
                  </button>
                  <button
                    onClick={() => removePendingLink(link.id)}
                    className="p-1 text-red-400 hover:text-red-300"
                    title="移除"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}

        {pendingLinks.length === 0 && clipboardMonitorEnabled && (
          <div className="flex items-center gap-2 text-xs text-slate-500 py-2">
            <ClipboardCheck className="w-4 h-4 text-green-400" />
            监听中... 复制 magnet 或 ed2k 链接后将自动出现在此列表
          </div>
        )}

        {pendingLinks.length === 0 && !clipboardMonitorEnabled && (
          <p className="text-xs text-slate-500 py-2">开启剪贴板监听后，复制的 magnet/ed2k 链接将自动添加到待离线下载列表</p>
        )}
      </div>

      {/* Quota */}
      {quota && (
        <div className="mb-4 text-sm text-slate-400">
          离线下载配额: <span className="text-white">{quota.used}</span> / {quota.total} (剩余: {quota.left})
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-800">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : !selectedCloud ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Download className="w-12 h-12 mb-3 opacity-50" />
            <p>请选择云盘</p>
          </div>
        ) : offlineFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Download className="w-12 h-12 mb-3 opacity-50" />
            <p>暂无离线下载任务</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80 sticky top-0">
              <tr className="text-slate-400 text-xs">
                <th className="text-left px-3 py-2">文件名</th>
                <th className="text-right px-3 py-2 w-32">大小</th>
                <th className="text-right px-3 py-2 w-24">进度</th>
                <th className="text-center px-3 py-2 w-20">状态</th>
                <th className="text-center px-3 py-2 w-16">操作</th>
              </tr>
            </thead>
            <tbody>
              {offlineFiles.map((f, i) => {
                const st = statusLabels[f.status] || statusLabels[4];
                return (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <div className="text-slate-200 truncate max-w-md" title={f.name}>{f.name}</div>
                      <div className="text-xs text-slate-500 truncate" title={f.url}>{f.url}</div>
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">{formatSize(f.size)}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{f.percendDone?.toFixed(1)}%</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`text-xs ${st.color}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => handleRemove(f)}
                        className="p-1 hover:bg-slate-700 rounded text-red-400"
                        title="删除"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">添加离线下载</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded hover:bg-slate-700 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">URL / 磁力链接</label>
                <textarea
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  placeholder="magnet:?xt=... 或 https://..."
                  rows={3}
                  className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">保存到文件夹</label>
                <input
                  type="text"
                  value={addFolder}
                  onChange={(e) => setAddFolder(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button onClick={handleAdd} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">添加</button>
                <button onClick={() => setShowAdd(false)} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
