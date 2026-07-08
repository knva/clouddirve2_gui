import React, { useState, useEffect } from "react";
import { useApp } from "../contexts/AppContext";
import { authApi, systemApi } from "../api/client";
import { HardDrive, Loader2, Server, User, Lock, KeyRound, ShieldCheck } from "lucide-react";

export default function Login() {
  const { setIsLoggedIn, serverUrl, setServerUrl, apiKey, setApiKey, refreshSystemInfo, refreshAccountStatus, showToast } = useApp();
  const [mode, setMode] = useState<"login" | "register" | "token">("login");
  const [userName, setUserName] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [token, setToken] = useState(apiKey || "");
  const [loading, setLoading] = useState(false);
  const [showTotp, setShowTotp] = useState(false);
  const [backendOk, setBackendOk] = useState(false);
  const [editingServer, setEditingServer] = useState(false);
  const [serverInput, setServerInput] = useState(serverUrl);

  useEffect(() => {
    // Check backend health
    systemApi.health().then(() => setBackendOk(true)).catch(() => setBackendOk(false));
  }, []);

  const handleLogin = async () => {
    if (!userName || !password) {
      showToast("warning", "请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      // First try to get token
      const tokenResult = await authApi.getToken(userName, password, totpCode || undefined);
      
      if (tokenResult.success && tokenResult.token) {
        await systemApi.setToken(tokenResult.token);
        setApiKey(tokenResult.token);
        showToast("success", "登录成功！");
        setIsLoggedIn(true);
        await refreshSystemInfo();
        await refreshAccountStatus();
      } else if (tokenResult.errorMessage) {
        // Check if 2FA is required
        if (tokenResult.errorMessage.includes("2FA") || tokenResult.errorMessage.includes("TOTP") || tokenResult.errorMessage.includes("2fa")) {
          setShowTotp(true);
          showToast("info", "请输入两步验证码");
        } else {
          showToast("error", tokenResult.errorMessage);
        }
      }
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("2FA") || msg.includes("2fa") || msg.includes("TOTP") || msg.includes("totp")) {
        setShowTotp(true);
        showToast("info", "请输入两步验证码");
      } else {
        showToast("error", `登录失败: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLoginWith2FA = async () => {
    if (!totpCode) {
      showToast("warning", "请输入验证码");
      return;
    }
    setLoading(true);
    try {
      const result = await authApi.login2FA(userName, password, totpCode);
      if (result.token) {
        await systemApi.setToken(result.token);
        setApiKey(result.token);
        showToast("success", "登录成功！");
        setIsLoggedIn(true);
        await refreshSystemInfo();
        await refreshAccountStatus();
      } else {
        showToast("error", result.errorMessage || "登录失败");
      }
    } catch (e: any) {
      showToast("error", `登录失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!userName || !password) {
      showToast("warning", "请输入用户名和密码");
      return;
    }
    setLoading(true);
    try {
      await authApi.register(userName, password);
      showToast("success", "注册成功，正在登录...");
      // Auto login after register
      await handleLogin();
    } catch (e: any) {
      showToast("error", `注册失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenLogin = async () => {
    if (!token) {
      showToast("warning", "请输入 Token");
      return;
    }
    setLoading(true);
    try {
      await systemApi.setToken(token);
      setApiKey(token);
      const info = await systemApi.getSystemInfo();
      if (info.IsLogin) {
        showToast("success", "Token 登录成功！");
        setIsLoggedIn(true);
        await refreshSystemInfo();
        await refreshAccountStatus();
      } else {
        showToast("error", "Token 无效");
      }
    } catch (e: any) {
      showToast("error", `Token 登录失败: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleServerChange = async () => {
    setServerUrl(serverInput);
    await systemApi.setConfig(serverInput);
    setEditingServer(false);
    showToast("success", "服务器地址已更新");
  };

  return (
    <div className="min-h-screen w-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-600/30 mb-4">
            <HardDrive className="w-9 h-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">HappyCD2</h1>
          <p className="text-slate-400 mt-1">CloudDrive2 管理器</p>
        </div>

        {/* Backend status */}
        <div className="flex items-center justify-center gap-2 mb-6 text-xs">
          {backendOk ? (
            <span className="flex items-center gap-1.5 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" /> 后端服务已连接
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-400" /> 后端服务未连接
            </span>
          )}
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl">
          {/* Server config */}
          {editingServer ? (
            <div className="mb-6">
              <label className="text-xs text-slate-400 mb-1.5 block">gRPC 服务器地址</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={serverInput}
                  onChange={(e) => setServerInput(e.target.value)}
                  placeholder="http://localhost:19798"
                  className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                />
                <button
                  onClick={handleServerChange}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  确定
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingServer(true)}
              className="mb-6 flex items-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors"
            >
              <Server className="w-3.5 h-3.5" />
              服务器: {serverUrl}
            </button>
          )}

          {/* Mode tabs */}
          <div className="flex gap-1 mb-6 bg-slate-800/50 rounded-lg p-1">
            {([
              { id: "login", label: "登录" },
              { id: "register", label: "注册" },
              { id: "token", label: "Token" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMode(tab.id)}
                className={`flex-1 py-2 rounded-md text-sm font-medium transition-all ${
                  mode === tab.id
                    ? "bg-blue-600 text-white shadow-lg"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Login form */}
          {mode === "login" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">用户名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !showTotp && handleLogin()}
                    placeholder="输入用户名"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !showTotp && handleLogin()}
                    placeholder="输入密码"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              {showTotp && (
                <div>
                  <label className="text-xs text-slate-400 mb-1.5 block">两步验证码</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleLoginWith2FA()}
                      placeholder="6位验证码或8位恢复码"
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
              <button
                onClick={showTotp ? handleLoginWith2FA : handleLogin}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {showTotp ? "验证并登录" : "登录"}
              </button>
            </div>
          )}

          {/* Register form */}
          {mode === "register" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">用户名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    placeholder="输入用户名"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="输入密码"
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleRegister}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                注册并登录
              </button>
            </div>
          )}

          {/* Token login */}
          {mode === "token" && (
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">API Token</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <textarea
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder="输入 Bearer Token"
                    rows={3}
                    className="w-full pl-10 pr-4 py-2.5 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none resize-none"
                  />
                </div>
              </div>
              <button
                onClick={handleTokenLogin}
                disabled={loading}
                className="w-full py-2.5 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white rounded-lg font-medium transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Token 登录
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          CloudDrive2 gRPC API • Tauri + React + Node.js
        </p>
      </div>
    </div>
  );
}
