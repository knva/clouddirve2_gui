import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { cloudApi } from "../api/client";
import {
  Cloud, Plus, Trash2, RefreshCw, Loader2, X, Settings as SettingsIcon,
  Lock, Server, HardDrive, Globe, Folder, Link2,
} from "lucide-react";

export default function CloudAPIs() {
  const { showToast } = useApp();
  const [clouds, setClouds] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [addType, setAddType] = useState<string>("");
  const [showConfig, setShowConfig] = useState<any>(null);

  const loadClouds = useCallback(async () => {
    setLoading(true);
    try {
      const result = await cloudApi.list();
      setClouds(result.apis || []);
    } catch (e: any) {
      showToast("error", `加载云盘失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadClouds();
  }, [loadClouds]);

  const handleRemove = async (cloud: any) => {
    if (!confirm(`确定删除云盘: ${cloud.name}？`)) return;
    try {
      await cloudApi.remove(cloud.name, cloud.userName, true);
      showToast("success", "删除成功");
      loadClouds();
    } catch (e: any) {
      showToast("error", `删除失败: ${e.message}`);
    }
  };

  const cloudTypes = [
    { id: "115-editthiscookie", label: "115网盘 (Cookie)", icon: "🍪" },
    { id: "115-open-oauth", label: "115网盘 (OAuth)", icon: "115" },
    { id: "aliyundrive-oauth", label: "阿里云盘 (OAuth)", icon: "☁️" },
    { id: "aliyundrive-refreshtoken", label: "阿里云盘 (Token)", icon: "☁️" },
    { id: "baidupan-oauth", label: "百度网盘", icon: "🌐" },
    { id: "onedrive-oauth", label: "OneDrive", icon: "💠" },
    { id: "google-drive-oauth", label: "Google Drive (OAuth)", icon: "📁" },
    { id: "google-drive-refreshtoken", label: "Google Drive (Token)", icon: "📁" },
    { id: "xunlei-oauth", label: "迅雷云盘", icon: "⚡" },
    { id: "123pan-oauth", label: "123云盘", icon: "🔢" },
    { id: "webdav", label: "WebDAV", icon: "🔗" },
    { id: "s3", label: "S3 / 兼容存储", icon: "🗄️" },
    { id: "sftp", label: "SFTP", icon: "🔐" },
    { id: "ftp", label: "FTP / FTPS", icon: "📂" },
    { id: "smb", label: "SMB / CIFS", icon: "💻" },
    { id: "local-folder", label: "本地文件夹", icon: "📁" },
    { id: "clouddrive", label: "远程 CloudDrive", icon: "☁️" },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" /> 添加云盘
        </button>
        <button
          onClick={loadClouds}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Cloud list */}
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : clouds.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Cloud className="w-16 h-16 mb-3 opacity-50" />
            <p>暂无云盘，点击"添加云盘"开始</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {clouds.map((cloud) => (
              <div
                key={cloud.name + cloud.userName}
                className="glass rounded-xl p-5 hover:border-slate-600 transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/20 to-purple-500/20 flex items-center justify-center">
                      <Cloud className="w-5 h-5 text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-white font-medium">{cloud.name}</h3>
                      <p className="text-xs text-slate-500">{cloud.userName}</p>
                    </div>
                  </div>
                  {cloud.isLocked && <Lock className="w-4 h-4 text-yellow-500" />}
                </div>

                <div className="space-y-1.5 text-xs text-slate-400">
                  {cloud.nickName && <div>昵称: <span className="text-slate-300">{cloud.nickName}</span></div>}
                  {cloud.path && <div>路径: <span className="text-slate-300">{cloud.path}</span></div>}
                  {cloud.supportMultiThreadUploading && <div>✓ 支持多线程上传</div>}
                  {cloud.readOnly && <div className="text-yellow-500">⚠ 只读</div>}
                  {cloud.hasPromotions && <div className="text-green-400">有促销活动</div>}
                </div>

                <div className="flex gap-2 mt-4 pt-3 border-t border-slate-700">
                  <button
                    onClick={() => setShowConfig(cloud)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-slate-300 hover:bg-slate-700 rounded"
                  >
                    <SettingsIcon className="w-3.5 h-3.5" /> 配置
                  </button>
                  <button
                    onClick={() => handleRemove(cloud)}
                    className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-slate-700 rounded"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> 删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add modal */}
      {showAdd && (
        <AddCloudModal
          cloudTypes={cloudTypes}
          onClose={() => setShowAdd(false)}
          onAdd={async (type: string, data: any) => {
            try {
              let result;
              switch (type) {
                case "115-editthiscookie":
                  result = await cloudApi.login115Editthiscookie(data.editThiscookieString);
                  break;
                case "aliyundrive-refreshtoken":
                  result = await cloudApi.loginAliyundriveRefreshtoken(data.refreshToken, data.useOpenAPI);
                  break;
                case "webdav":
                  result = await cloudApi.loginWebDav(data);
                  break;
                case "s3":
                  result = await cloudApi.loginS3(data);
                  break;
                case "sftp":
                  result = await cloudApi.loginSftp(data);
                  break;
                case "ftp":
                  result = await cloudApi.loginFtp(data);
                  break;
                case "smb":
                  result = await cloudApi.loginSmb(data);
                  break;
                case "local-folder":
                  result = await cloudApi.loginLocalFolder(data.localFolderPath);
                  break;
                case "clouddrive":
                  result = await cloudApi.loginCloudDrive(data);
                  break;
                default:
                  showToast("info", "该登录方式需要OAuth流程，请通过Web界面操作");
                  return;
              }
              if (result?.success !== false) {
                showToast("success", "添加云盘成功");
                setShowAdd(false);
                loadClouds();
              } else {
                showToast("error", result?.errorMessage || "添加失败");
              }
            } catch (e: any) {
              showToast("error", `添加失败: ${e.message}`);
            }
          }}
        />
      )}

      {/* Config modal */}
      {showConfig && (
        <CloudConfigModal
          cloud={showConfig}
          onClose={() => setShowConfig(null)}
        />
      )}
    </div>
  );
}

function AddCloudModal({ cloudTypes, onClose, onAdd }: any) {
  const [type, setType] = useState("");
  const [data, setData] = useState<any>({});

  if (!type) {
    return (
      <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
        <div className="glass rounded-2xl p-6 w-full max-w-2xl mx-4 max-h-[80vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">选择云盘类型</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {cloudTypes.map((t: any) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className="flex items-center gap-3 p-4 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors text-left"
              >
                <span className="text-2xl">{t.icon}</span>
                <span className="text-sm text-slate-200">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const selectedType = cloudTypes.find((t: any) => t.id === type);

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">添加 {selectedType?.label}</h3>
          <button onClick={() => setType("")} className="p-1 rounded hover:bg-slate-700 text-slate-400 text-sm">← 返回</button>
        </div>

        <div className="space-y-4">
          {type === "115-editthiscookie" && (
            <Field label="EditThisCookie 字符串">
              <textarea value={data.editThiscookieString || ""} onChange={(e) => setData({ ...data, editThiscookieString: e.target.value })} rows={3} className="input" />
            </Field>
          )}
          {type === "aliyundrive-refreshtoken" && (
            <>
              <Field label="Refresh Token"><input value={data.refreshToken || ""} onChange={(e) => setData({ ...data, refreshToken: e.target.value })} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={data.useOpenAPI || false} onChange={(e) => setData({ ...data, useOpenAPI: e.target.checked })} className="rounded bg-slate-700" />
                使用 Open API
              </label>
            </>
          )}
          {type === "webdav" && (
            <>
              <Field label="服务器 URL"><input value={data.serverUrl || ""} onChange={(e) => setData({ ...data, serverUrl: e.target.value })} placeholder="https://..." className="input" /></Field>
              <Field label="用户名"><input value={data.userName || ""} onChange={(e) => setData({ ...data, userName: e.target.value })} className="input" /></Field>
              <Field label="密码"><input type="password" value={data.password || ""} onChange={(e) => setData({ ...data, password: e.target.value })} className="input" /></Field>
            </>
          )}
          {type === "s3" && (
            <>
              <Field label="Access Key ID"><input value={data.accessKeyId || ""} onChange={(e) => setData({ ...data, accessKeyId: e.target.value })} className="input" /></Field>
              <Field label="Secret Access Key"><input type="password" value={data.secretAccessKey || ""} onChange={(e) => setData({ ...data, secretAccessKey: e.target.value })} className="input" /></Field>
              <Field label="Region"><input value={data.region || ""} onChange={(e) => setData({ ...data, region: e.target.value })} placeholder="us-east-1" className="input" /></Field>
              <Field label="Bucket"><input value={data.bucket || ""} onChange={(e) => setData({ ...data, bucket: e.target.value })} className="input" /></Field>
              <Field label="自定义 Endpoint (可选)"><input value={data.endpoint || ""} onChange={(e) => setData({ ...data, endpoint: e.target.value })} className="input" /></Field>
            </>
          )}
          {type === "sftp" && (
            <>
              <Field label="主机"><input value={data.host || ""} onChange={(e) => setData({ ...data, host: e.target.value })} className="input" /></Field>
              <Field label="端口"><input type="number" value={data.port || 22} onChange={(e) => setData({ ...data, port: parseInt(e.target.value) })} className="input" /></Field>
              <Field label="用户名"><input value={data.userName || ""} onChange={(e) => setData({ ...data, userName: e.target.value })} className="input" /></Field>
              <Field label="密码"><input type="password" value={data.password || ""} onChange={(e) => setData({ ...data, password: e.target.value })} className="input" /></Field>
            </>
          )}
          {type === "ftp" && (
            <>
              <Field label="主机"><input value={data.host || ""} onChange={(e) => setData({ ...data, host: e.target.value })} className="input" /></Field>
              <Field label="端口"><input type="number" value={data.port || 21} onChange={(e) => setData({ ...data, port: parseInt(e.target.value) })} className="input" /></Field>
              <Field label="用户名"><input value={data.userName || ""} onChange={(e) => setData({ ...data, userName: e.target.value })} className="input" /></Field>
              <Field label="密码"><input type="password" value={data.password || ""} onChange={(e) => setData({ ...data, password: e.target.value })} className="input" /></Field>
              <label className="flex items-center gap-2 text-sm text-slate-300">
                <input type="checkbox" checked={data.useTls || false} onChange={(e) => setData({ ...data, useTls: e.target.checked })} className="rounded bg-slate-700" /> 使用 TLS (FTPS)
              </label>
            </>
          )}
          {type === "smb" && (
            <>
              <Field label="服务器"><input value={data.server || ""} onChange={(e) => setData({ ...data, server: e.target.value })} className="input" /></Field>
              <Field label="共享名"><input value={data.share || ""} onChange={(e) => setData({ ...data, share: e.target.value })} className="input" /></Field>
              <Field label="用户名"><input value={data.userName || ""} onChange={(e) => setData({ ...data, userName: e.target.value })} className="input" /></Field>
              <Field label="密码"><input type="password" value={data.password || ""} onChange={(e) => setData({ ...data, password: e.target.value })} className="input" /></Field>
            </>
          )}
          {type === "local-folder" && (
            <Field label="本地文件夹路径"><input value={data.localFolderPath || ""} onChange={(e) => setData({ ...data, localFolderPath: e.target.value })} placeholder="D:\MyFolder" className="input" /></Field>
          )}
          {type === "clouddrive" && (
            <>
              <Field label="gRPC URL"><input value={data.grpcUrl || ""} onChange={(e) => setData({ ...data, grpcUrl: e.target.value })} placeholder="http://localhost:19798" className="input" /></Field>
              <Field label="Token"><input value={data.token || ""} onChange={(e) => setData({ ...data, token: e.target.value })} className="input" /></Field>
            </>
          )}
          {(type.includes("oauth") || type.includes("refreshtoken")) && !data.refreshToken && type !== "aliyundrive-refreshtoken" && (
            <div className="text-sm text-slate-400 bg-slate-800/50 p-3 rounded-lg">
              此云盘需要通过 OAuth 流程登录。请在浏览器中访问 CloudDrive2 Web 界面完成授权。
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => onAdd(type, data)} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium">添加</button>
            <button onClick={() => setType("")} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">返回</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudConfigModal({ cloud, onClose }: any) {
  const { showToast } = useApp();
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const result = await cloudApi.getConfig(cloud.name, cloud.userName);
        setConfig(result);
      } catch (e: any) {
        showToast("error", `加载配置失败: ${e.message}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [cloud]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await cloudApi.setConfig(cloud.name, cloud.userName, config);
      showToast("success", "配置已保存");
      onClose();
    } catch (e: any) {
      showToast("error", `保存失败: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">配置 - {cloud.name}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        {loading ? (
          <div className="text-center py-8"><Loader2 className="w-6 h-6 text-blue-500 animate-spin mx-auto" /></div>
        ) : config ? (
          <div className="space-y-4">
            <Field label="最大下载线程数">
              <input type="number" value={config.maxDownloadThreads || 1} onChange={(e) => setConfig({ ...config, maxDownloadThreads: parseInt(e.target.value) })} className="input" />
            </Field>
            <Field label="最大上传线程数">
              <input type="number" value={config.maxUploadThreads || 1} onChange={(e) => setConfig({ ...config, maxUploadThreads: parseInt(e.target.value) })} className="input" />
            </Field>
            <Field label="最大缓冲池大小 (MB)">
              <input type="number" value={config.maxBufferPoolSizeMB || 0} onChange={(e) => setConfig({ ...config, maxBufferPoolSizeMB: parseInt(e.target.value) })} className="input" />
            </Field>
            <Field label="最大 QPS">
              <input type="number" step="0.1" value={config.maxQueriesPerSecond || 0} onChange={(e) => setConfig({ ...config, maxQueriesPerSecond: parseFloat(e.target.value) })} className="input" />
            </Field>
            <label className="flex items-center gap-2 text-sm text-slate-300">
              <input type="checkbox" checked={config.forceIpv4 || false} onChange={(e) => setConfig({ ...config, forceIpv4: e.target.checked })} className="rounded bg-slate-700" /> 强制 IPv4
            </label>
            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "保存"}
              </button>
              <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
            </div>
          </div>
        ) : (
          <div className="text-slate-500 text-center py-8">无法加载配置</div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-slate-400 mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
