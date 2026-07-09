import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { systemApi, settingsApi, taskApi } from "../api/client";
import { formatSize, formatSpeed, formatUptime, formatDate } from "../utils";
import {
  Cpu, MemoryStick, Clock, HardDrive, Download, Upload, Server,
  RefreshCw, Loader2, Power, AlertTriangle, Activity, Database, Copy,
} from "lucide-react";

export default function SystemInfo() {
  const { showToast } = useApp();
  const [runtime, setRuntime] = useState<any>(null);
  const [running, setRunning] = useState<any>(null);
  const [taskCount, setTaskCount] = useState<any>(null);
  const [dirCacheSize, setDirCacheSize] = useState<any>(null);
  const [openHandles, setOpenHandles] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [devices, setDevices] = useState<any[]>([]);

  // Load static data (runtime info, task counts, cache, handles, devices) every 5s
  const loadStatic = useCallback(async () => {
    setLoading(true);
    try {
      const [rt, tc, dcs, oh, od] = await Promise.all([
        systemApi.getRuntimeInfo(),
        taskApi.allCount(),
        settingsApi.dirCacheDbSize(),
        taskApi.openHandles(),
        settingsApi.onlineDevices(),
      ]);
      setRuntime(rt);
      setTaskCount(tc);
      setDirCacheSize(dcs);
      setOpenHandles(oh);
      setDevices(od.devices || []);
    } catch (e: any) {
      showToast("error", `加载系统信息失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Load real-time running info every 1s
  const loadRunning = useCallback(async () => {
    try {
      const ri = await systemApi.getRunningInfo();
      setRunning(ri);
    } catch (e: any) {
 // silent fail for real-time polling
    }
  }, []);

  useEffect(() => {
    loadStatic();
    loadRunning();
    const staticInterval = setInterval(loadStatic, 5000);
    const realtimeInterval = setInterval(loadRunning, 1000);
    return () => { clearInterval(staticInterval); clearInterval(realtimeInterval); };
  }, [loadStatic, loadRunning]);

  const handleRestart = async () => {
    if (!confirm("确定重启 CloudDrive2 服务？")) return;
    try {
      await systemApi.restartService();
      showToast("success", "服务重启中...");
    } catch (e: any) {
      showToast("error", e.message);
    }
  };

  const handleShutdown = async () => {
    if (!confirm("确定关闭 CloudDrive2 服务？")) return;
    try {
      await systemApi.shutdownService();
      showToast("success", "服务已关闭");
    } catch (e: any) {
      showToast("error", e.message);
    }
  };

  if (loading && !runtime) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  return (
    <div className="max-w-4xl space-y-6">
      {/* Runtime info */}
      {runtime && (
        <div className="glass rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Server className="w-4 h-4" /> 运行时信息</h3>
            <button onClick={loadStatic} className="p-1.5 rounded hover:bg-slate-700 text-slate-400"><RefreshCw className="w-4 h-4" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<Server className="w-5 h-5 text-blue-400" />} label="产品名称" value={runtime.productName} />
            <StatCard icon={<Activity className="w-5 h-5 text-green-400" />} label="版本" value={runtime.productVersion} />
            <StatCard icon={<Database className="w-5 h-5 text-purple-400" />} label="API版本" value={runtime.CloudAPIVersion} />
            <StatCard icon={<HardDrive className="w-5 h-5 text-orange-400" />} label="操作系统" value={runtime.osInfo} />
          </div>
        </div>
      )}

      {/* Running stats */}
      {running && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> 实时监控</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard icon={<Cpu className="w-5 h-5 text-blue-400" />} label="CPU 使用率" value={`${running.cpuUsage?.toFixed(1)}%`} />
            <StatCard icon={<MemoryStick className="w-5 h-5 text-green-400" />} label="内存使用" value={formatSize(parseInt(running.memUsageKB) || 0)} />
            <StatCard icon={<Clock className="w-5 h-5 text-yellow-400" />} label="运行时间" value={formatUptime(running.uptime)} />
            <StatCard icon={<MemoryStick className="w-5 h-5 text-purple-400" />} label="总内存" value={formatSize(parseInt(running.totalMemoryKB) || 0)} />
            <StatCard icon={<Download className="w-5 h-5 text-green-400" />} label="下载速度" value={formatSpeed(running.downloadBytesPerSecond)} />
            <StatCard icon={<Upload className="w-5 h-5 text-blue-400" />} label="上传速度" value={formatSpeed(running.uploadBytesPerSecond)} />
          </div>
        </div>
      )}

      {/* Task counts */}
      {taskCount && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><Activity className="w-4 h-4" /> 任务统计</h3>
          <div className="grid grid-cols-3 gap-4">
            <StatCard icon={<Download className="w-5 h-5 text-green-400" />} label="下载任务" value={String(taskCount.downloadCount)} />
            <StatCard icon={<Upload className="w-5 h-5 text-blue-400" />} label="上传任务" value={String(taskCount.uploadCount)} />
            <StatCard icon={<Copy className="w-5 h-5 text-orange-400" />} label="复制任务" value={String(taskCount.copyTaskCount)} />
          </div>
        </div>
      )}

      {/* Other info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {dirCacheSize && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Database className="w-4 h-4" /> 目录缓存数据库</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-400">数据库大小</span><span className="text-slate-200">{formatSize(dirCacheSize.totalSizeBytes)}</span></div>
              <div className="flex justify-between"><span className="text-slate-400">正在清理</span><span className="text-slate-200">{dirCacheSize.isVacuuming ? "是" : "否"}</span></div>
            </div>
          </div>
        )}

        {openHandles && (
          <div className="glass rounded-xl p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><HardDrive className="w-4 h-4" /> 打开的文件句柄</h3>
            <div className="space-y-1 text-sm max-h-32 overflow-auto">
              {openHandles.openFileHandles && openHandles.openFileHandles.length > 0 ? (
                openHandles.openFileHandles.map((h: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-slate-400 truncate">
                    <span className="text-slate-500">PID:{h.processId}</span>
                    <span className="truncate">{h.filePath}</span>
                  </div>
                ))
              ) : (
                <div className="text-slate-500">无打开的文件句柄</div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Online devices */}
      {devices.length > 0 && (
        <div className="glass rounded-xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">在线设备</h3>
          <div className="space-y-2">
            {devices.map((d, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <div>
                    <div className="text-sm text-slate-200">{d.deviceName} ({d.deviceId})</div>
                    <div className="text-xs text-slate-500">{d.osType} • {d.ipAddress} • {d.version}</div>
                  </div>
                </div>
                <div className="text-xs text-slate-500">{formatDate(d.lastUpdateTime)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Service controls */}
      <div className="glass rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Power className="w-4 h-4" /> 服务控制</h3>
        <div className="flex gap-3">
          <button onClick={handleRestart} className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg text-sm">
            <RefreshCw className="w-4 h-4" /> 重启服务
          </button>
          <button onClick={handleShutdown} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
            <Power className="w-4 h-4" /> 关闭服务
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <div className="text-sm text-slate-200 font-medium truncate">{value}</div>
    </div>
  );
}
