import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { backupApi, fileApi } from "../api/client";
import { formatDate } from "../utils";
import {
  ShieldCheck, Plus, Trash2, RefreshCw, Loader2, X, Play, Pause,
  Folder, CheckCircle, AlertCircle, Clock,
} from "lucide-react";

export default function Backup() {
  const { showToast } = useApp();
  const [backups, setBackups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const result = await backupApi.all();
      setBackups(result.backups || []);
    } catch (e: any) {
      showToast("error", `加载备份失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  const handleToggle = async (sourcePath: string, enabled: boolean) => {
    try {
      await backupApi.setEnabled(sourcePath, !enabled);
      showToast("success", enabled ? "已禁用" : "已启用");
      loadBackups();
    } catch (e: any) {
      showToast("error", `操作失败: ${e.message}`);
    }
  };

  const handleRestart = async (sourcePath: string) => {
    try {
      await backupApi.restartWalk(sourcePath);
      showToast("success", "已重新开始扫描");
      loadBackups();
    } catch (e: any) {
      showToast("error", `操作失败: ${e.message}`);
    }
  };

  const handleRemove = async (sourcePath: string) => {
    if (!confirm(`确定删除备份任务: ${sourcePath}？`)) return;
    try {
      await backupApi.remove(sourcePath);
      showToast("success", "删除成功");
      loadBackups();
    } catch (e: any) {
      showToast("error", `删除失败: ${e.message}`);
    }
  };

  const statusInfo: Record<number, { label: string; color: string; icon: React.ReactNode }> = {
    0: { label: "空闲", color: "text-slate-400", icon: <Clock className="w-4 h-4" /> },
    1: { label: "扫描中", color: "text-blue-400", icon: <Loader2 className="w-4 h-4 animate-spin" /> },
    2: { label: "错误", color: "text-red-400", icon: <AlertCircle className="w-4 h-4" /> },
    3: { label: "已禁用", color: "text-slate-500", icon: <Pause className="w-4 h-4" /> },
    4: { label: "已扫描", color: "text-yellow-400", icon: <CheckCircle className="w-4 h-4" /> },
    5: { label: "已完成", color: "text-green-400", icon: <CheckCircle className="w-4 h-4" /> },
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> 添加备份
        </button>
        <button onClick={loadBackups} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : backups.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <ShieldCheck className="w-16 h-16 mb-3 opacity-50" />
            <p>暂无备份任务</p>
          </div>
        ) : (
          <div className="space-y-3">
            {backups.map((b, i) => {
              const status = statusInfo[b.status] || statusInfo[0];
              const backup = b.backup;
              return (
                <div key={i} className="glass rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{backup?.sourcePath}</h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={status.color}>{status.icon}</span>
                          <span className={`text-xs ${status.color}`}>{b.statusMessage || status.label}</span>
                        </div>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-xs ${backup?.isEnabled ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                      {backup?.isEnabled ? "已启用" : "已禁用"}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                    <div>目标: {(backup?.destinations || []).map((d: any) => d.destinationPath).join(", ") || "-"}</div>
                    <div>文件系统监听: <span className="text-slate-300">{backup?.fileSystemWatchEnabled ? "是" : "否"}</span></div>
                    {backup?.walkingThroughIntervalSecs > 0 && <div>扫描间隔: {Math.floor(parseInt(backup.walkingThroughIntervalSecs) / 60)} 分钟</div>}
                  </div>

                  <div className="flex gap-2 pt-3 border-t border-slate-700">
                    <button onClick={() => handleToggle(backup.sourcePath, backup.isEnabled)} className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 rounded">
                      {backup.isEnabled ? <><Pause className="w-3.5 h-3.5" /> 禁用</> : <><Play className="w-3.5 h-3.5" /> 启用</>}
                    </button>
                    <button onClick={() => handleRestart(backup.sourcePath)} className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 hover:bg-slate-700 rounded">
                      <RefreshCw className="w-3.5 h-3.5" /> 重新扫描
                    </button>
                    <button onClick={() => handleRemove(backup.sourcePath)} className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-slate-700 rounded">
                      <Trash2 className="w-3.5 h-3.5" /> 删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showAdd && <AddBackupModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); loadBackups(); }} />}
    </div>
  );
}

function AddBackupModal({ onClose, onAdded }: any) {
  const { showToast } = useApp();
  const [sourcePath, setSourcePath] = useState("");
  const [destPath, setDestPath] = useState("");
  const [currentPath, setCurrentPath] = useState("/");
  const [subFiles, setSubFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<"source" | "dest">("source");

  const loadSubFiles = async (path: string) => {
    setLoading(true);
    try {
      const result = await fileApi.list(path, false);
      setSubFiles((result || []).filter((f: any) => f.isDirectory));
    } catch { setSubFiles([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadSubFiles(currentPath); }, [currentPath]);

  const handleAdd = async () => {
    if (!sourcePath || !destPath) {
      showToast("warning", "请选择源路径和目标路径");
      return;
    }
    setSaving(true);
    try {
      await backupApi.add({
        sourcePath,
        destinations: [{ destinationPath: destPath, isEnabled: true }],
        isEnabled: true,
        fileSystemWatchEnabled: true,
        walkingThroughIntervalSecs: 0,
      });
      showToast("success", "备份任务添加成功");
      onAdded();
    } catch (e: any) {
      showToast("error", `添加失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const parentPathFn = (path: string) => {
    const parts = path.split("/").filter((p) => p);
    parts.pop();
    return "/" + parts.join("/");
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-lg mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">添加备份任务</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">源路径</label>
            <div className="flex gap-2">
              <input value={sourcePath} onChange={(e) => setSourcePath(e.target.value)} placeholder="选择或输入源路径" className="input" />
              <button onClick={() => { setStep("source"); setCurrentPath("/"); }} className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">浏览</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">目标路径</label>
            <div className="flex gap-2">
              <input value={destPath} onChange={(e) => setDestPath(e.target.value)} placeholder="选择或输入目标路径" className="input" />
              <button onClick={() => { setStep("dest"); setCurrentPath("/"); }} className="px-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">浏览</button>
            </div>
          </div>

          {/* Path browser */}
          <div className="max-h-48 overflow-auto rounded-lg border border-slate-700">
            <div className="text-xs text-slate-500 px-3 py-1.5 bg-slate-800 border-b border-slate-700">浏览{step === "source" ? "源" : "目标"}路径: {currentPath}</div>
            {currentPath !== "/" && (
              <button onClick={() => setCurrentPath(parentPathFn(currentPath))} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-sm text-slate-300">
                ← 返回上级
              </button>
            )}
            {loading ? (
              <div className="p-3 text-center"><Loader2 className="w-4 h-4 text-blue-500 animate-spin mx-auto" /></div>
            ) : (
              subFiles.map((f) => (
                <button key={f.fullPathName} onClick={() => setCurrentPath(f.fullPathName)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-slate-800 text-sm text-slate-300">
                  <Folder className="w-4 h-4 text-blue-400" /> {f.name}
                </button>
              ))
            )}
            <button onClick={() => { if (step === "source") setSourcePath(currentPath); else setDestPath(currentPath); }} className="w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/30 text-sm text-blue-400 border-t border-slate-700">
              选择当前路径: {currentPath}
            </button>
          </div>

          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "添加备份"}
            </button>
            <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}
