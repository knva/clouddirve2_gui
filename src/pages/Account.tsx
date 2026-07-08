import React, { useState, useEffect, useCallback } from "react";
import { useApp } from "../contexts/AppContext";
import { authApi, twoFAApi, sessionApi, miscApi, systemApi } from "../api/client";
import {
  UserCircle, Shield, Smartphone, Key, Gift, DollarSign, LogOut,
  Loader2, RefreshCw, Lock, Unlock, AlertCircle, CheckCircle, X,
} from "lucide-react";

export default function Account() {
  const { showToast, accountStatus, refreshAccountStatus, setIsLoggedIn, systemInfo } = useApp();
  const [loading, setLoading] = useState(false);
  const [twoFAStatus, setTwoFAStatus] = useState<any>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [show2FASetup, setShow2FASetup] = useState<any>(null);
  const [balanceLog, setBalanceLog] = useState<any[]>([]);
  const [referralCode, setReferralCode] = useState("");
  const [tab, setTab] = useState<"info" | "security" | "billing">("info");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await refreshAccountStatus();
      const [status, sess, bl, rc] = await Promise.all([
        twoFAApi.status(),
        sessionApi.list(),
        miscApi.balanceLog().catch(() => ({ logs: [] })),
        miscApi.referralCode().catch(() => ({ result: "" })),
      ]);
      setTwoFAStatus(status);
      setSessions(sess.sessions || []);
      setBalanceLog(bl.logs || []);
      setReferralCode(rc.result || "");
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setLoading(false);
    }
  }, [showToast, refreshAccountStatus]);

  useEffect(() => { load(); }, [load]);

  const handleLogout = async () => {
    if (!confirm("确定退出登录？")) return;
    try {
      await authApi.logout(true);
      showToast("success", "已退出登录");
      setIsLoggedIn(false);
    } catch (e: any) {
      showToast("error", e.message);
    }
  };

  if (loading && !accountStatus) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>;
  }

  const tabs = [
    { id: "info", label: "账户信息", icon: <UserCircle className="w-4 h-4" /> },
    { id: "security", label: "安全设置", icon: <Shield className="w-4 h-4" /> },
    { id: "billing", label: "账单余额", icon: <DollarSign className="w-4 h-4" /> },
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <UserCircle className="w-9 h-9 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">{accountStatus?.userName || systemInfo?.UserName || "用户"}</h2>
          {accountStatus?.accountPlan && (
            <p className="text-sm text-blue-400">{accountStatus.accountPlan.planName} - {accountStatus.accountPlan.description}</p>
          )}
        </div>
        <div className="flex-1" />
        <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm">
          <LogOut className="w-4 h-4" /> 退出登录
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-800 rounded-lg p-1 mb-4 w-fit">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id as any)} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === t.id ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {tab === "info" && (
          <div className="max-w-2xl space-y-4">
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-4">基本信息</h3>
              <div className="space-y-3 text-sm">
                <Row label="用户名" value={accountStatus?.userName || "-"} />
                <Row label="邮箱已验证" value={accountStatus?.emailConfirmed === "true" ? "是" : "否"} />
                <Row label="账户余额" value={`¥${accountStatus?.accountBalance?.toFixed(2) || "0.00"}`} />
                <Row label="信任设备" value={accountStatus?.trustedDevice ? "是" : "否"} />
                {referralCode && <Row label="推荐码" value={referralCode} />}
              </div>
            </div>

            {accountStatus?.accountPlan && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">当前套餐</h3>
                <div className="space-y-3 text-sm">
                  <Row label="套餐名称" value={accountStatus.accountPlan.planName} />
                  <Row label="描述" value={accountStatus.accountPlan.description} />
                  <Row label="时长" value={accountStatus.accountPlan.durationDescription} />
                  <Row label="到期时间" value={accountStatus.accountPlan.endTime ? new Date(parseInt(String(accountStatus.accountPlan.endTime)) * 1000).toLocaleString("zh-CN") : "永久"} />
                </div>
              </div>
            )}

            {accountStatus?.accountRoles && accountStatus.accountRoles.length > 0 && (
              <div className="glass rounded-xl p-5">
                <h3 className="text-sm font-semibold text-white mb-4">账户角色</h3>
                <div className="flex flex-wrap gap-2">
                  {accountStatus.accountRoles.map((r, i) => (
                    <span key={i} className="px-3 py-1 bg-blue-500/20 text-blue-400 rounded-full text-xs">{r.roleName}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "security" && (
          <div className="max-w-2xl space-y-4">
            {/* 2FA */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Shield className="w-4 h-4" /> 两步验证 (2FA)</h3>
                <span className={`px-2 py-0.5 rounded text-xs ${twoFAStatus?.two_factor_enabled ? "bg-green-500/20 text-green-400" : "bg-slate-700 text-slate-400"}`}>
                  {twoFAStatus?.two_factor_enabled ? "已启用" : "未启用"}
                </span>
              </div>
              {twoFAStatus?.two_factor_enabled ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-400">两步验证已启用，您的账户受到额外保护。</p>
                  <div className="flex gap-2">
                    <button onClick={async () => { const code = prompt("输入 TOTP 码以查看恢复码"); if (code) { try { const r = await twoFAApi.recoveryCodes(code); showToast("success", `恢复码: ${r.recoveryCodes?.join(", ")}`); } catch (e: any) { showToast("error", e.message); } } }} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">查看恢复码</button>
                    <button onClick={async () => { const code = prompt("输入 TOTP 码以禁用 2FA"); if (code) { try { await twoFAApi.disable(code); showToast("success", "2FA 已禁用"); load(); } catch (e: any) { showToast("error", e.message); } } }} className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white rounded">禁用 2FA</button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-slate-400 mb-2">启用两步验证以提高账户安全性。</p>
                  <button onClick={async () => { const pwd = prompt("输入密码以设置 2FA"); if (pwd) { try { const r = await twoFAApi.setup(pwd); setShow2FASetup(r); } catch (e: any) { showToast("error", e.message); } } }} className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded">设置 2FA</button>
                </div>
              )}
            </div>

            {/* Password */}
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><Key className="w-4 h-4" /> 密码管理</h3>
              <button onClick={() => setShowChangePassword(true)} className="px-3 py-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-white rounded">修改密码</button>
            </div>

            {/* Sessions */}
            <div className="glass rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2"><Smartphone className="w-4 h-4" /> 活跃会话</h3>
                <button onClick={() => sessionApi.revokeOthers().then(() => { showToast("success", "已撤销其他会话"); load(); }).catch((e) => showToast("error", e.message))} className="px-2 py-1 text-xs text-red-400 hover:bg-slate-700 rounded">撤销其他</button>
              </div>
              <div className="space-y-2">
                {sessions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <Smartphone className="w-4 h-4 text-slate-400" />
                      <div>
                        <div className="text-sm text-slate-200">{s.device_name || s.device_id}</div>
                        <div className="text-xs text-slate-500">{s.device_os_type} • {s.last_ip_address}</div>
                      </div>
                    </div>
                    <button onClick={() => sessionApi.revoke(s.id).then(() => { showToast("success", "已撤销"); load(); }).catch((e) => showToast("error", e.message))} className="text-red-400 hover:text-red-300 text-xs">撤销</button>
                  </div>
                ))}
                {sessions.length === 0 && <p className="text-sm text-slate-500">暂无活跃会话</p>}
              </div>
            </div>
          </div>
        )}

        {tab === "billing" && (
          <div className="max-w-2xl space-y-4">
            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> 账户余额</h3>
              <div className="text-3xl font-bold text-green-400">¥{accountStatus?.accountBalance?.toFixed(2) || "0.00"}</div>
            </div>

            <div className="glass rounded-xl p-5">
              <h3 className="text-sm font-semibold text-white mb-3">余额记录</h3>
              {balanceLog.length > 0 ? (
                <div className="space-y-2">
                  {balanceLog.map((log, i) => (
                    <div key={i} className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg text-sm">
                      <div>
                        <div className="text-slate-200">{log.operation_source || "未知"}</div>
                        <div className="text-xs text-slate-500">{new Date(parseInt(String(log.operation_time?.seconds)) * 1000).toLocaleString("zh-CN")}</div>
                      </div>
                      <div className={`font-medium ${log.balance_change > 0 ? "text-green-400" : "text-red-400"}`}>
                        {log.balance_change > 0 ? "+" : ""}¥{log.balance_change?.toFixed(2)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-slate-500">暂无记录</p>}
            </div>
          </div>
        )}
      </div>

      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
      {show2FASetup && <TwoFASetupModal data={show2FASetup} onClose={() => setShow2FASetup(null)} onSuccess={() => load()} />}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between"><span className="text-slate-400">{label}</span><span className="text-slate-200">{value}</span></div>;
}

function ChangePasswordModal({ onClose }: any) {
  const { showToast } = useApp();
  const [oldPwd, setOldPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [totp, setTotp] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await authApi.changePassword(oldPwd, newPwd, totp || undefined);
      showToast("success", "密码已修改");
      onClose();
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">修改密码</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          <div><label className="text-xs text-slate-400 mb-1.5 block">当前密码</label><input type="password" value={oldPwd} onChange={(e) => setOldPwd(e.target.value)} className="input" /></div>
          <div><label className="text-xs text-slate-400 mb-1.5 block">新密码</label><input type="password" value={newPwd} onChange={(e) => setNewPwd(e.target.value)} className="input" /></div>
          <div><label className="text-xs text-slate-400 mb-1.5 block">TOTP 码 (如已启用 2FA)</label><input value={totp} onChange={(e) => setTotp(e.target.value)} className="input" /></div>
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "确认"}</button>
            <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TwoFASetupModal({ data, onClose, onSuccess }: any) {
  const { showToast } = useApp();
  const [code, setCode] = useState("");
  const [saving, setSaving] = useState(false);

  const handleEnable = async () => {
    setSaving(true);
    try {
      await twoFAApi.enable(code);
      showToast("success", "2FA 已启用");
      onSuccess();
      onClose();
    } catch (e: any) {
      showToast("error", e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">设置两步验证</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-4">
          {data.qr_code && <img src={data.qr_code} alt="QR Code" className="w-48 h-48 mx-auto rounded-lg bg-white p-2" />}
          <div className="text-sm text-slate-400 text-center">扫描二维码或手动输入密钥:</div>
          <div className="text-center text-sm text-slate-200 font-mono bg-slate-800 p-2 rounded">{data.manual_entry_key || data.secret}</div>
          <div><label className="text-xs text-slate-400 mb-1.5 block">输入验证码</label><input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6位验证码" className="input" /></div>
          <div className="flex gap-3">
            <button onClick={handleEnable} disabled={saving} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50">{saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "启用"}</button>
            <button onClick={onClose} className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium">取消</button>
          </div>
        </div>
      </div>
    </div>
  );
}
