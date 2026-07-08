import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { mountApi } from "../api/client";
import {
  Mountain, Plus, Trash2, RefreshCw, Loader2, X, Play, Square, HardDrive,
} from "lucide-react";

export default function MountPoints() {
  const { showToast } = useApp();
  const [mounts, setMounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [hasDriveLetters, setHasDriveLetters] = useState(false);

  const loadMounts = useCallback(async () => {
    setLoading(true);
    try {
      const result = await mountApi.list();
      setMounts(result.mountPoints || []);
    } catch (e: any) {
      showToast("error", `加载挂载点失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadMounts();
    mountApi.hasDriveLetters().then((r) => setHasDriveLetters(r.hasDriveLetters)).catch(() => {});
  }, [loadMounts]);

  const handleMount = async (mp: string) => {
    try {
      await mountApi.mount(mp);
      showToast("success", "挂载成功");
      loadMounts();
    } catch (e: any) {
      showToast("error", `挂载失败: ${e.message}`);
    }
  };

  const handleUnmount = async (mp: string) => {
    try {
      await mountApi.unmount(mp);
      showToast("success", "卸载成功");
      loadMounts();
    } catch (e: any) {
      showToast("error", `卸载失败: ${e.message}`);
    }
  };

  const handleRemove = async (mp: string) => {
    if (!confirm(`确定删除挂载点: ${mp}？`)) return;
    try {
      await mountApi.remove(mp);
      showToast("success", "删除成功");
      loadMounts();
    } catch (e: any) {
      showToast("error", `删除失败: ${e.message}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> 添加挂载点
        </button>
        <button onClick={loadMounts} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : mounts.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Mountain className="w-16 h-16 mb-3 opacity-50" />
            <p>暂无挂载点</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mounts.map((m, i) => (
              <div key={i} className="glass rounded-xl p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${m.isMounted ? "bg-green-500/20" : "bg-slate-700"}`}>
                      <HardDrive className={`w-5 h-5 ${m.isMounted ? "text-green-400" : "text-slate-500"}`} />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{m.name || m.mountPoint}</h3>
                      <p className="text-xs text-slate-500">{m.mountPoint}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${m.isMounted ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                    {m.isMounted ? "已挂载" : "未挂载"}
                  </span>
                </div>

                <div className="space-y-1.5 text-xs text-slate-400 mb-4">
                  <div>源目录: <span className="text-slate-300">{m.sourceDir}</span></div>
                  <div>本地挂载: <span className="text-slate-300">{m.localMount ? "是" : "否"}</span></div>
                  <div>只读: <span className="text-slate-300">{m.readOnly ? "是" : "否"}</span></div>
                  <div>自动挂载: <span className="text-slate-300">{m.autoMount ? "是" : "否"}</span></div>
                  {m.failReason && <div className="text-red-400">错误: {m.failReason}</div>}
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-700">
                  {m.isMounted ? (
                    <button onClick={() => handleUnmount(m.mountPoint)} className="flex items-center gap-1 px-2 py-1 text-xs text-yellow-400 hover:bg-slate-700 rounded">
                      <Square className="w-3.5 h-3.5" /> 卸载
                    </button>
                  ) : (
                    <button onClick={() => handleMount(m.mountPoint)} className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:bg-slate-700 rounded">
                      <Play className="w-3.5 h-3.5" /> 挂载
                    </button>
                  )}
                  <button onClick={() => handleRemove(m.mountPoint)} className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-slate-700 rounded">
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && <AddMountModal onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); loadMounts(); }} hasDriveLetters={hasDriveLetters} />}
    </div>
  );
}

function AddMountModal({ onClose, onAdded, hasDriveLetters }: any) {
  const { showToast } = useApp();
  const [mountPoint, setMountPoint] = useState("");
  const [sourceDir, setSourceDir] = useState("");
  const [localMount, setLocalMount] = useState(false);
  const [readOnly, setReadOnly] = useState(false);
  const [autoMount, setAutoMount] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    if (!mountPoint || !sourceDir) {
      showToast("warning", "请填写挂载点和源目录");
      return;
    }
    setSaving(true);
    try {
      await mountApi.add({ mountPoint, sourceDir, localMount, readOnly, autoMount, name });
      showToast("success", "添加挂载点成功");
      onAdded();
    } catch (e: any) {
      showToast("error", `添加失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">添加挂载点</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">挂载点</label>
            <input value={mountPoint} onChange={(e) => setMountPoint(e.target.value)} placeholder="Z: 或 /mnt/cloud" className="input" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">源目录</label>
            <input value={sourceDir} onChange={(e) => setSourceDir(e.target.value)} placeholder="/阿里云盘" className="input" />
          </div>
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">名称 (可选)</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className="input" />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={localMount} onChange={(e) => setLocalMount(e.target.checked)} className="rounded bg-slate-700" /> 本地挂载
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={readOnly} onChange={(e) => setReadOnly(e.target.checked)} className="rounded bg-slate-700" /> 只读
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input type="checkbox" checked={autoMount} onChange={(e) => setAutoMount(e.target.checked)} className="rounded bg-slate-700" /> 自动挂载
          </label>
          <div className="flex gap-3">
            <button onClick={handleAdd} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "添加"}
            </button>
            <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}
