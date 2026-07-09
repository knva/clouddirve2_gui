import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { settingsApi, diskCacheApi, systemApi, davApi, webServerApi, tokenApi } from "../api/client";
import { formatSize } from "../utils";
import {
  Settings as SettingsIcon, Save, Loader2, RefreshCw, Database, Server,
  HardDrive, Globe, Key, ShieldCheck, Trash2, Plus, X, Download, Monitor, ExternalLink,
} from "lucide-react";
import { getDefaultVideoPlayer, setDefaultVideoPlayer } from "../components/MediaViewer";
import { checkAvailablePlayers } from "../api/tauri";

type Tab = "connection" | "general" | "player" | "cache" | "dav" | "tokens" | "webserver";

export default function Settings() {
  const { showToast } = useApp();
  const [tab, setTab] = useState<Tab>("general");
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const result = await settingsApi.get();
      setSettings(result);
    } catch (e: any) {
      showToast("error", `加载设置失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (tab === "general") loadSettings();
  }, [tab, loadSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await settingsApi.set(settings);
      showToast("success", "设置已保存");
    } catch (e: any) {
      showToast("error", `保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: "connection", label: "连接配置", icon: <Server className="w-4 h-4" /> },
    { id: "general", label: "通用设置", icon: <SettingsIcon className="w-4 h-4" /> },
    { id: "player", label: "播放器", icon: <Monitor className="w-4 h-4" /> },
    { id: "cache", label: "磁盘缓存", icon: <Database className="w-4 h-4" /> },
    { id: "dav", label: "WebDAV", icon: <Server className="w-4 h-4" /> },
    { id: "tokens", label: "API Token", icon: <Key className="w-4 h-4" /> },
    { id: "webserver", label: "Web 服务", icon: <Globe className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id as Tab)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "connection" && <ConnectionSettings />}
        {tab === "general" && (
          <GeneralSettings settings={settings} setSettings={setSettings} loading={loading} saving={saving} onSave={handleSave} onReload={loadSettings} />
        )}
        {tab === "player" && <PlayerSettings />}
        {tab === "cache" && <CacheSettings />}
        {tab === "dav" && <DavSettings />}
        {tab === "tokens" && <TokenSettings />}
        {tab === "webserver" && <WebServerSettings />}
      </div>
    </div>
  );
}

function ConnectionSettings() {
  const { showToast, serverUrl, setServerUrl, apiKey, setApiKey, applyConnectionConfig, refreshSystemInfo } = useApp();
  const [urlInput, setUrlInput] = useState(serverUrl);
  const [keyInput, setKeyInput] = useState(apiKey);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      setServerUrl(urlInput);
      setApiKey(keyInput);
      await applyConnectionConfig(urlInput, keyInput);
      await refreshSystemInfo();
      showToast("success", "连接配置已保存并应用");
    } catch (e: any) {
      showToast("error", `保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      await applyConnectionConfig(urlInput, keyInput);
      const info = await systemApi.getSystemInfo();
      if (info.IsLogin) {
        showToast("success", `连接成功！用户: ${info.UserName || "已登录"}`);
      } else {
        showToast("warning", "已连接到服务器，但未登录（请检查 API Key）");
      }
    } catch (e: any) {
      showToast("error", `连接失败: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  const handleClearKey = () => {
    setKeyInput("");
    setApiKey("");
    showToast("info", "API Key 已清除，请保存以生效");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="gRPC 服务器配置">
        <Field label="CloudDrive2 gRPC 服务器地址">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="http://localhost:19798"
            className="input"
          />
        </Field>
        <p className="text-xs text-slate-500">CloudDrive2 默认 gRPC 端口为 19798，如果服务端运行在其他地址请修改。</p>
      </Section>

      <Section title="API Key (Bearer Token)">
        <Field label="API Key / Bearer Token">
          <div className="flex gap-2">
            <input
              type={showKey ? "text" : "password"}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="输入 Bearer Token（可留空，使用用户名密码登录）"
              className="flex-1 input"
            />
            <button
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm whitespace-nowrap"
            >
              {showKey ? "隐藏" : "显示"}
            </button>
            <button
              onClick={handleClearKey}
              className="px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-sm whitespace-nowrap"
            >
              清除
            </button>
          </div>
        </Field>
        <p className="text-xs text-slate-500">
          API Key 是 CloudDrive2 的 Bearer Token，用于身份验证。可以通过登录页面获取，或在 CloudDrive2 Web 界面中生成。
          配置后所有功能将使用此 Key 进行认证。留空则需通过登录页面使用用户名密码登录。
        </p>
      </Section>

      <div className="flex gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存并应用
        </button>
        <button
          onClick={handleTest}
          disabled={testing}
          className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm disabled:opacity-50"
        >
          {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />} 测试连接
        </button>
      </div>
    </div>
  );
}

function GeneralSettings({ settings, setSettings, loading, saving, onSave, onReload }: any) {
  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  if (!settings) return <div className="text-slate-500 text-center py-12">无法加载设置</div>;

  const update = (key: string, value: any) => setSettings({ ...settings, [key]: value });

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="目录缓存">
        <Field label="目录缓存时间 (秒)"><input type="number" value={settings.dirCacheTimeToLiveSecs || ""} onChange={(e) => update("dirCacheTimeToLiveSecs", e.target.value ? parseInt(e.target.value) : undefined)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={settings.dirCachePersistence || false} onChange={(e) => update("dirCachePersistence", e.target.checked)} className="rounded bg-slate-700" /> 启用缓存持久化</label>
      </Section>

      <Section title="任务处理">
        <Field label="最大预处理任务数"><input type="number" value={settings.maxPreProcessTasks || ""} onChange={(e) => update("maxPreProcessTasks", e.target.value ? parseInt(e.target.value) : undefined)} className="input" /></Field>
        <Field label="最大处理任务数"><input type="number" value={settings.maxProcessTasks || ""} onChange={(e) => update("maxProcessTasks", e.target.value ? parseInt(e.target.value) : undefined)} className="input" /></Field>
        <Field label="上传延迟 (秒)"><input type="number" value={settings.uploadDelaySecs || ""} onChange={(e) => update("uploadDelaySecs", e.target.value ? parseInt(e.target.value) : undefined)} className="input" /></Field>
        <Field label="读取下载超时 (秒)"><input type="number" value={settings.readDownloaderTimeoutSecs || ""} onChange={(e) => update("readDownloaderTimeoutSecs", e.target.value ? parseInt(e.target.value) : undefined)} className="input" /></Field>
      </Section>

      <Section title="速度限制">
        <Field label="最大下载速度 (KB/s, 0=不限)"><input type="number" step="0.1" value={settings.maxDownloadSpeedKBytesPerSecond || ""} onChange={(e) => update("maxDownloadSpeedKBytesPerSecond", e.target.value ? parseFloat(e.target.value) : undefined)} className="input" /></Field>
        <Field label="最大上传速度 (KB/s, 0=不限)"><input type="number" step="0.1" value={settings.maxUploadSpeedKBytesPerSecond || ""} onChange={(e) => update("maxUploadSpeedKBytesPerSecond", e.target.value ? parseFloat(e.target.value) : undefined)} className="input" /></Field>
      </Section>

      <Section title="其他">
        <Field label="临时文件位置"><input value={settings.tempFileLocation || ""} onChange={(e) => update("tempFileLocation", e.target.value)} className="input" /></Field>
        <Field label="设备名称"><input value={settings.deviceName || ""} onChange={(e) => update("deviceName", e.target.value)} className="input" /></Field>
        <Field label="更新通道">
          <select value={settings.updateChannel || "Release"} onChange={(e) => update("updateChannel", e.target.value)} className="input">
            <option value="Release">Release</option>
            <option value="Beta">Beta</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={settings.syncWithCloud || false} onChange={(e) => update("syncWithCloud", e.target.checked)} className="rounded bg-slate-700" /> 与云端同步</label>
      </Section>

      <div className="flex gap-3">
        <button onClick={onSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存设置
        </button>
        <button onClick={onReload} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
          <RefreshCw className="w-4 h-4" /> 重新加载
        </button>
      </div>
    </div>
  );
}

function PlayerSettings() {
  const { showToast } = useApp();
  const [defaultPlayer, setDefaultPlayerState] = useState(getDefaultVideoPlayer());
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);

  useEffect(() => {
    checkAvailablePlayers().then(setAvailablePlayers).catch(() => setAvailablePlayers([]));
  }, []);

  const playerLabels: Record<string, string> = {
    internal: "内置播放器（支持倍速/静音/全屏）",
    vlc: "VLC 播放器",
    potplayer: "PotPlayer",
    "mpc-hc": "MPC-HC",
    mpv: "MPV",
    ask: "每次询问",
  };

  const handleChange = (value: string) => {
    setDefaultVideoPlayer(value);
    setDefaultPlayerState(value);
    showToast("success", "默认播放器已设置");
  };

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="视频播放器配置">
        <Field label="默认视频播放器">
          <select
            value={defaultPlayer}
            onChange={(e) => handleChange(e.target.value)}
            className="input"
          >
            <option value="internal">内置播放器（支持倍速/静音/全屏）</option>
            <option value="ask">每次询问</option>
            {availablePlayers.map((p) => (
              <option key={p} value={p}>{playerLabels[p] || p}</option>
            ))}
          </select>
        </Field>
        <p className="text-xs text-slate-500">
          设置后，在文件列表中点击视频文件将自动使用选定的播放器播放。
          内置播放器支持倍速播放（0.25x ~ 4x）、静音切换、全屏等快捷操作。
        </p>
      </Section>

      <Section title="已安装的外部播放器">
        {availablePlayers.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-yellow-400">
            <ExternalLink className="w-4 h-4" />
            未检测到已安装的外部播放器。请安装 VLC、PotPlayer、MPC-HC 或 MPV。
          </div>
        ) : (
          <div className="space-y-2">
            {availablePlayers.map((p) => (
              <div key={p} className="flex items-center gap-3 p-3 bg-slate-800/50 rounded-lg">
                <Monitor className="w-4 h-4 text-blue-400" />
                <span className="text-sm text-slate-200">{playerLabels[p] || p}</span>
                {defaultPlayer === p && <span className="text-xs text-green-400 ml-auto">已设为默认</span>}
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title="内置播放器快捷键">
        <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
          <div><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">空格/K</kbd> 播放/暂停</div>
          <div><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">←/→</kbd> 快退/快进 10秒</div>
          <div><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">M</kbd> 静音切换</div>
          <div><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">F</kbd> 全屏切换</div>
          <div><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">&lt;/&gt;</kbd> 减速/加速</div>
          <div><kbd className="px-1.5 py-0.5 bg-slate-700 rounded">Esc</kbd> 退出播放器</div>
        </div>
      </Section>
    </div>
  );
}

function CacheSettings() {
  const { showToast } = useApp();
  const [stats, setStats] = useState<any>(null);
  const [folders, setFolders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, f] = await Promise.all([diskCacheApi.stats(), diskCacheApi.folders()]);
      setStats(s);
      setFolders(f.folders || []);
    } catch (e: any) {
      showToast("error", `加载缓存信息失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handlePurge = async () => {
    if (!confirm("确定清空所有磁盘缓存？")) return;
    try {
      await diskCacheApi.purge();
      showToast("success", "缓存已清空");
      load();
    } catch (e: any) { showToast("error", e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="缓存统计">
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="状态" value={stats.enabled ? "已启用" : "已禁用"} />
            <StatCard label="总大小" value={formatSize(stats.totalBytes)} />
            <StatCard label="最大限制" value={formatSize(stats.maxBytes)} />
            <StatCard label="条目数" value={String(stats.entryCount)} />
            <StatCard label="分段数" value={String(stats.segmentCount)} />
            <StatCard label="扫描完成" value={stats.scanCompleted ? "是" : "否"} />
            <StatCard label="根目录" value={stats.rootDir || "-"} />
          </div>
        )}
        <button onClick={handlePurge} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm mt-3">
          <Trash2 className="w-4 h-4" /> 清空缓存
        </button>
      </Section>

      <Section title="缓存文件夹规则">
        {folders.length === 0 ? (
          <p className="text-slate-500 text-sm">暂无缓存文件夹</p>
        ) : (
          <div className="space-y-2">
            {folders.map((f, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div className="text-sm text-slate-200">{f.path}</div>
                <button onClick={async () => { await diskCacheApi.removeFolder(f.path); showToast("success", "已移除"); load(); }} className="text-red-400 hover:text-red-300">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  );
}

function DavSettings() {
  const { showToast } = useApp();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await davApi.config();
      setConfig(result);
    } catch (e: any) { showToast("error", e.message); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await davApi.setConfig(config);
      showToast("success", "WebDAV 配置已保存");
    } catch (e: any) { showToast("error", e.message); }
    finally { setSaving(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  if (!config) return null;

  const update = (key: string, value: any) => setConfig({ ...config, [key]: value });

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="WebDAV 服务器">
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.davServerEnabled || false} onChange={(e) => update("davServerEnabled", e.target.checked)} className="rounded bg-slate-700" /> 启用 WebDAV 服务器</label>
        <Field label="DAV 路径"><input value={config.davServerPath || "/dav"} onChange={(e) => update("davServerPath", e.target.value)} className="input" disabled /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.enableClouddriveAccount || false} onChange={(e) => update("enableClouddriveAccount", e.target.checked)} className="rounded bg-slate-700" /> 启用 CloudDrive 账户</label>
        <Field label="CloudDrive 账户根路径"><input value={config.clouddriveAccountRootPath || ""} onChange={(e) => update("clouddriveAccountRootPath", e.target.value)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.clouddriveAccountReadOnly || false} onChange={(e) => update("clouddriveAccountReadOnly", e.target.checked)} className="rounded bg-slate-700" /> CloudDrive 账户只读</label>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.enableAnonymousAccess || false} onChange={(e) => update("enableAnonymousAccess", e.target.checked)} className="rounded bg-slate-700" /> 启用匿名访问</label>
        <Field label="匿名根路径"><input value={config.anonymousRootPath || ""} onChange={(e) => update("anonymousRootPath", e.target.value)} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.anonymousReadOnly || false} onChange={(e) => update("anonymousReadOnly", e.target.checked)} className="rounded bg-slate-700" /> 匿名只读</label>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.enableAccessLog || false} onChange={(e) => update("enableAccessLog", e.target.checked)} className="rounded bg-slate-700" /> 启用访问日志</label>
      </Section>

      <Section title="DAV 用户">
        {config.users && config.users.length > 0 ? (
          <div className="space-y-2">
            {config.users.map((u: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                <div>
                  <span className="text-sm text-slate-200">{u.userName}</span>
                  <span className="text-xs text-slate-500 ml-2">根: {u.rootPath}</span>
                  {u.readOnly && <span className="text-xs text-yellow-500 ml-2">只读</span>}
                  {!u.enabled && <span className="text-xs text-red-500 ml-2">已禁用</span>}
                </div>
                <button onClick={async () => { await davApi.removeUser(u.userName); showToast("success", "已删除"); load(); }} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        ) : <p className="text-slate-500 text-sm">暂无 DAV 用户</p>}
      </Section>

      <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存配置
      </button>
    </div>
  );
}

function TokenSettings() {
  const { showToast } = useApp();
  const [tokens, setTokens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await tokenApi.list();
      setTokens(result.tokens || []);
    } catch (e: any) { showToast("error", e.message); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (token: string) => {
    if (!confirm("确定删除此 Token？")) return;
    try { await tokenApi.remove(token); showToast("success", "已删除"); load(); }
    catch (e: any) { showToast("error", e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">API Token 管理</h3>
        <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> 创建 Token
        </button>
      </div>

      {tokens.length === 0 ? (
        <p className="text-slate-500 text-center py-8">暂无 Token</p>
      ) : (
        <div className="space-y-2">
          {tokens.map((t, i) => (
            <div key={i} className="glass rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="text-sm text-slate-200 font-mono">{t.token?.substring(0, 20)}...</div>
                  <div className="text-xs text-slate-500 mt-1">{t.friendly_name || "未命名"} • 根目录: {t.rootDir}</div>
                  {t.expires_in && <div className="text-xs text-slate-500">过期: {t.expires_in} 秒后</div>}
                </div>
                <button onClick={() => handleRemove(t.token)} className="text-red-400 hover:text-red-300 ml-2"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateTokenModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateTokenModal({ onClose, onCreated }: any) {
  const { showToast } = useApp();
  const [rootDir, setRootDir] = useState("/");
  const [friendlyName, setFriendlyName] = useState("");
  const [expiresIn, setExpiresIn] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await tokenApi.create({
        rootDir,
        friendly_name: friendlyName,
        expires_in: expiresIn ? parseInt(expiresIn) : 0,
        permissions: {},
      });
      showToast("success", "Token 创建成功");
      onCreated();
    } catch (e: any) { showToast("error", e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">创建 API Token</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <Field label="名称"><input value={friendlyName} onChange={(e) => setFriendlyName(e.target.value)} className="input" /></Field>
          <Field label="根目录"><input value={rootDir} onChange={(e) => setRootDir(e.target.value)} className="input" /></Field>
          <Field label="过期时间 (秒, 0=永不过期)"><input type="number" value={expiresIn} onChange={(e) => setExpiresIn(e.target.value)} className="input" /></Field>
          <div className="flex gap-3">
            <button onClick={handleCreate} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "创建"}
            </button>
            <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WebServerSettings() {
  const { showToast } = useApp();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try { setConfig(await webServerApi.config()); }
    catch (e: any) { showToast("error", e.message); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    setSaving(true);
    try { await webServerApi.setConfig(config); showToast("success", "配置已保存"); }
    catch (e: any) { showToast("error", e.message); }
    finally { setSaving(false); }
  };

  const handleGenerateCert = async () => {
    try { await webServerApi.generateCert(true); showToast("success", "自签名证书已生成"); load(); }
    catch (e: any) { showToast("error", e.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  if (!config) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <Section title="Web 服务器配置">
        <Field label="HTTP 端口"><input type="number" value={config.http_port || 0} onChange={(e) => setConfig({ ...config, http_port: parseInt(e.target.value) })} className="input" /></Field>
        <Field label="HTTPS 端口"><input type="number" value={config.https_port || 0} onChange={(e) => setConfig({ ...config, https_port: parseInt(e.target.value) })} className="input" /></Field>
        <label className="flex items-center gap-2 text-sm text-slate-300"><input type="checkbox" checked={config.enable_https || false} onChange={(e) => setConfig({ ...config, enable_https: e.target.checked })} className="rounded bg-slate-700" /> 启用 HTTPS</label>
        <Field label="证书文件路径 (可选)"><input value={config.cert_file || ""} onChange={(e) => setConfig({ ...config, cert_file: e.target.value })} className="input" /></Field>
        <Field label="密钥文件路径 (可选)"><input value={config.key_file || ""} onChange={(e) => setConfig({ ...config, key_file: e.target.value })} className="input" /></Field>
      </Section>

      <div className="flex gap-3">
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} 保存
        </button>
        <button onClick={handleGenerateCert} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm">
          <ShieldCheck className="w-4 h-4" /> 生成自签名证书
        </button>
      </div>
    </div>
  );
}

// Helper components
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl p-5">
      <h3 className="text-sm font-semibold text-white mb-4">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-slate-400 mb-1.5 block">{label}</label>{children}</div>;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-800/50 rounded-lg p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-sm text-slate-200 mt-1">{value}</div>
    </div>
  );
}
