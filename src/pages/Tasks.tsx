import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { taskApi } from "../api/client";
import { formatSize, formatSpeed, formatPercent, formatDate } from "../utils";
import type { UploadFileInfo, DownloadFileInfo, CopyTask } from "../types";
import {
  Upload, Download, Copy, Pause, Play, X, Loader2, RefreshCw,
  ChevronDown, ChevronRight, Clock, AlertCircle, CheckCircle,
} from "lucide-react";

type Tab = "download" | "upload" | "copy";

export default function Tasks() {
  const { showToast } = useApp();
  const [tab, setTab] = useState<Tab>("upload");
  const [downloads, setDownloads] = useState<DownloadFileInfo[]>([]);
  const [uploads, setUploads] = useState<UploadFileInfo[]>([]);
  const [copyTasks, setCopyTasks] = useState<CopyTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [globalDownloadSpeed, setGlobalDownloadSpeed] = useState(0);
  const [globalUploadSpeed, setGlobalUploadSpeed] = useState(0);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "download") {
        const result = await taskApi.downloadList();
        setDownloads(result.downloadFiles || []);
        setGlobalDownloadSpeed(result.globalBytesPerSecond || 0);
      } else if (tab === "upload") {
        const result = await taskApi.uploadList(true, 200, 1, "");
        setUploads(result.uploadFiles || []);
        setGlobalUploadSpeed(result.globalBytesPerSecond || 0);
      } else if (tab === "copy") {
        const result = await taskApi.copyList();
        setCopyTasks(result.copyTasks || []);
      }
    } catch (e: any) {
      showToast("error", `加载任务失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [tab, showToast]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [loadData]);

  const handleUploadAction = async (action: string, keys?: string[]) => {
    try {
      switch (action) {
        case "cancelAll": await taskApi.cancelAllUploads(); break;
        case "pauseAll": await taskApi.pauseAllUploads(); break;
        case "resumeAll": await taskApi.resumeAllUploads(); break;
        case "cancel": if (keys) await taskApi.cancelUploads(keys); break;
        case "pause": if (keys) await taskApi.pauseUploads(keys); break;
        case "resume": if (keys) await taskApi.resumeUploads(keys); break;
      }
      showToast("success", "操作成功");
      loadData();
    } catch (e: any) {
      showToast("error", `操作失败: ${e.message}`);
    }
  };

  const handleCopyAction = async (action: string, sourcePath?: string, destPath?: string) => {
    try {
      switch (action) {
        case "pauseAll": await taskApi.pauseAllCopy(true); break;
        case "resumeAll": await taskApi.resumeAllCopy(); break;
        case "removeCompleted": await taskApi.removeCompletedCopy(); break;
        case "removeAll": await taskApi.removeAllCopy(); break;
        case "cancel": if (sourcePath && destPath) await taskApi.cancelCopy(sourcePath, destPath); break;
        case "pause": if (sourcePath && destPath) await taskApi.pauseCopy(sourcePath, destPath, true); break;
        case "resume": if (sourcePath && destPath) await taskApi.pauseCopy(sourcePath, destPath, false); break;
        case "restart": if (sourcePath && destPath) await taskApi.restartCopy(sourcePath, destPath); break;
      }
      showToast("success", "操作成功");
      loadData();
    } catch (e: any) {
      showToast("error", `操作失败: ${e.message}`);
    }
  };

  const statusColors: Record<number, string> = {
    0: "text-slate-400", 1: "text-blue-400", 2: "text-red-400", 3: "text-green-400",
    4: "text-yellow-400", 5: "text-green-400", 6: "text-slate-500", 7: "text-slate-400",
    8: "text-slate-500", 9: "text-red-400", 10: "text-red-500",
  };
  const statusLabels: Record<number, string> = {
    0: "等待预处理", 1: "预处理中", 2: "已取消", 3: "传输中", 4: "已暂停",
    5: "已完成", 6: "已跳过", 7: "排队中", 8: "已忽略", 9: "错误", 10: "致命错误",
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {([
            { id: "upload", label: "上传", icon: <Upload className="w-4 h-4" />, count: uploads.length },
            { id: "download", label: "下载", icon: <Download className="w-4 h-4" />, count: downloads.length },
            { id: "copy", label: "复制", icon: <Copy className="w-4 h-4" />, count: copyTasks.length },
          ] as const).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {t.icon}
              {t.label}
              {t.count > 0 && (
                <span className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">{t.count}</span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={loadData}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Speed indicator */}
      {tab === "download" && globalDownloadSpeed > 0 && (
        <div className="mb-3 text-sm text-slate-400">
          总下载速度: <span className="text-green-400 font-medium">{formatSpeed(globalDownloadSpeed)}</span>
        </div>
      )}
      {tab === "upload" && globalUploadSpeed > 0 && (
        <div className="mb-3 text-sm text-slate-400">
          总上传速度: <span className="text-green-400 font-medium">{formatSpeed(globalUploadSpeed)}</span>
        </div>
      )}

      {/* Batch actions */}
      {tab === "upload" && uploads.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => handleUploadAction("pauseAll")} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm">全部暂停</button>
          <button onClick={() => handleUploadAction("resumeAll")} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">全部继续</button>
          <button onClick={() => handleUploadAction("cancelAll")} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm">全部取消</button>
        </div>
      )}
      {tab === "copy" && copyTasks.length > 0 && (
        <div className="flex gap-2 mb-3">
          <button onClick={() => handleCopyAction("pauseAll")} className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-sm">全部暂停</button>
          <button onClick={() => handleCopyAction("resumeAll")} className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm">全部继续</button>
          <button onClick={() => handleCopyAction("removeCompleted")} className="px-3 py-1.5 bg-slate-600 hover:bg-slate-500 text-white rounded text-sm">清除已完成</button>
          <button onClick={() => handleCopyAction("removeAll")} className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm">清除全部</button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-800">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : tab === "upload" ? (
          uploads.length === 0 ? (
            <EmptyState icon={<Upload className="w-12 h-12" />} text="暂无上传任务" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 sticky top-0">
                <tr className="text-slate-400 text-xs">
                  <th className="text-left px-3 py-2">文件路径</th>
                  <th className="text-right px-3 py-2 w-32">大小</th>
                  <th className="text-right px-3 py-2 w-32">进度</th>
                  <th className="text-center px-3 py-2 w-20">状态</th>
                  <th className="text-center px-3 py-2 w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {uploads.map((u) => {
                  const size = parseInt(String(u.size)) || 0;
                  const transferred = parseInt(String(u.transferedBytes)) || 0;
                  return (
                    <tr key={u.key} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="px-3 py-2">
                        <div className="text-slate-200 truncate max-w-md" title={u.destPath}>{u.destPath}</div>
                        {u.errorMessage && <div className="text-xs text-red-400">{u.errorMessage}</div>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-400">{formatSize(u.size)}</td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {formatPercent(transferred, size)}
                        <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: `${size > 0 ? (transferred / size) * 100 : 0}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs ${statusColors[u.statusEnum] || "text-slate-400"}`}>
                          {u.status || statusLabels[u.statusEnum] || "未知"}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {(u.statusEnum === 3 || u.statusEnum === 0 || u.statusEnum === 7) && (
                            <button onClick={() => handleUploadAction("pause", [u.key])} className="p-1 hover:bg-slate-700 rounded text-yellow-400" title="暂停">
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {u.statusEnum === 4 && (
                            <button onClick={() => handleUploadAction("resume", [u.key])} className="p-1 hover:bg-slate-700 rounded text-green-400" title="继续">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleUploadAction("cancel", [u.key])} className="p-1 hover:bg-slate-700 rounded text-red-400" title="取消">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        ) : tab === "download" ? (
          downloads.length === 0 ? (
            <EmptyState icon={<Download className="w-12 h-12" />} text="暂无下载任务" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 sticky top-0">
                <tr className="text-slate-400 text-xs">
                  <th className="text-left px-3 py-2">文件路径</th>
                  <th className="text-right px-3 py-2 w-32">大小</th>
                  <th className="text-right px-3 py-2 w-32">缓冲</th>
                  <th className="text-right px-3 py-2 w-24">速度</th>
                  <th className="text-center px-3 py-2 w-20">线程</th>
                </tr>
              </thead>
              <tbody>
                {downloads.map((d, i) => (
                  <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                    <td className="px-3 py-2">
                      <div className="text-slate-200 truncate max-w-md" title={d.filePath}>{d.filePath}</div>
                      {d.lastDownloadError && <div className="text-xs text-red-400">{d.lastDownloadError}</div>}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-400">{formatSize(d.fileLength)}</td>
                    <td className="px-3 py-2 text-right text-slate-400">{formatSize(d.totalBufferUsed)}</td>
                    <td className="px-3 py-2 text-right text-green-400">{formatSpeed(d.bytesPerSecond)}</td>
                    <td className="px-3 py-2 text-center text-slate-400">{d.downloadThreadCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          copyTasks.length === 0 ? (
            <EmptyState icon={<Copy className="w-12 h-12" />} text="暂无复制任务" />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-800/80 sticky top-0">
                <tr className="text-slate-400 text-xs">
                  <th className="text-left px-3 py-2">源路径</th>
                  <th className="text-left px-3 py-2">目标路径</th>
                  <th className="text-right px-3 py-2 w-24">进度</th>
                  <th className="text-center px-3 py-2 w-20">状态</th>
                  <th className="text-center px-3 py-2 w-24">操作</th>
                </tr>
              </thead>
              <tbody>
                {copyTasks.map((t, i) => {
                  const total = parseInt(String(t.totalBytes)) || 0;
                  const uploaded = parseInt(String(t.uploadedBytes)) || 0;
                  const statusLabels: Record<string, string> = {
                    Pending: "等待中", Scanning: "扫描中", Scanned: "已扫描", Completed: "已完成", Failed: "失败",
                  };
                  return (
                    <tr key={i} className="border-t border-slate-800 hover:bg-slate-800/30">
                      <td className="px-3 py-2 text-slate-200 truncate max-w-xs" title={t.sourcePath}>{t.sourcePath}</td>
                      <td className="px-3 py-2 text-slate-200 truncate max-w-xs" title={t.destPath}>{t.destPath}</td>
                      <td className="px-3 py-2 text-right text-slate-400">
                        {formatPercent(uploaded, total)}
                        <div className="mt-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-full bg-green-500 rounded-full" style={{ width: `${total > 0 ? (uploaded / total) * 100 : 0}%` }} />
                        </div>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs ${t.status === "Completed" ? "text-green-400" : t.status === "Failed" ? "text-red-400" : t.paused ? "text-yellow-400" : "text-blue-400"}`}>
                          {t.paused ? "已暂停" : statusLabels[t.status] || t.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-center gap-1">
                          {!t.paused && t.status !== "Completed" && (
                            <button onClick={() => handleCopyAction("pause", t.sourcePath, t.destPath)} className="p-1 hover:bg-slate-700 rounded text-yellow-400" title="暂停">
                              <Pause className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {t.paused && (
                            <button onClick={() => handleCopyAction("resume", t.sourcePath, t.destPath)} className="p-1 hover:bg-slate-700 rounded text-green-400" title="继续">
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button onClick={() => handleCopyAction("cancel", t.sourcePath, t.destPath)} className="p-1 hover:bg-slate-700 rounded text-red-400" title="取消">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="h-full flex flex-col items-center justify-center text-slate-600">
      {icon}
      <p className="mt-3">{text}</p>
    </div>
  );
}
