import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { offlineApi, cloudApi } from "../api/client";
import { formatSize, formatDate } from "../utils";
import type { OfflineFile } from "../types";
import {
  Plus, Trash2, RefreshCw, Loader2, Download, Link2, X, Magnet,
} from "lucide-react";

export default function OfflineTasks() {
  const { showToast } = useApp();
  const [clouds, setClouds] = useState<any[]>([]);
  const [selectedCloud, setSelectedCloud] = useState<string>("");
  const [offlineFiles, setOfflineFiles] = useState<OfflineFile[]>([]);
  const [quota, setQuota] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [addFolder, setAddFolder] = useState("/");

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
