import React, { useState, useEffect } from "react";
import { AppProvider, useApp } from "./contexts/AppContext";
import { ClipboardProvider } from "./contexts/ClipboardContext";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import ToastContainer from "./components/Toast";
import Login from "./pages/Login";
import FileBrowser from "./pages/FileBrowser";
import Tasks from "./pages/Tasks";
import CloudAPIs from "./pages/CloudAPIs";
import MountPoints from "./pages/MountPoints";
import Backup from "./pages/Backup";
import Settings from "./pages/Settings";
import SystemInfo from "./pages/SystemInfo";
import Account from "./pages/Account";
import OfflineTasks from "./pages/OfflineTasks";
import {
  Cloud,
  FolderTree,
  ListChecks,
  HardDrive,
  Mountain,
  ShieldCheck,
  Settings as SettingsIcon,
  Monitor,
  UserCircle,
  Download,
  Menu,
  X,
  LogOut,
  Sun,
  Moon,
  MonitorSmartphone,
} from "lucide-react";

type Page =
  | "files"
  | "tasks"
  | "offline"
  | "clouds"
  | "mounts"
  | "backup"
  | "settings"
  | "system"
  | "account";

const navItems: { id: Page; label: string; icon: React.ReactNode }[] = [
  { id: "files", label: "文件浏览", icon: <FolderTree className="w-5 h-5" /> },
  { id: "tasks", label: "传输任务", icon: <ListChecks className="w-5 h-5" /> },
  { id: "offline", label: "离线下载", icon: <Download className="w-5 h-5" /> },
  { id: "clouds", label: "云盘管理", icon: <Cloud className="w-5 h-5" /> },
  { id: "mounts", label: "挂载管理", icon: <Mountain className="w-5 h-5" /> },
  { id: "backup", label: "备份管理", icon: <ShieldCheck className="w-5 h-5" /> },
  { id: "settings", label: "系统设置", icon: <SettingsIcon className="w-5 h-5" /> },
  { id: "system", label: "系统信息", icon: <Monitor className="w-5 h-5" /> },
  { id: "account", label: "账户中心", icon: <UserCircle className="w-5 h-5" /> },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const options = [
    { id: "dark" as const, label: "夜间", icon: <Moon className="w-4 h-4" /> },
    { id: "light" as const, label: "日间", icon: <Sun className="w-4 h-4" /> },
    { id: "auto" as const, label: "自动", icon: <MonitorSmartphone className="w-4 h-4" /> },
  ];

  const current = options.find((o) => o.id === theme) || options[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-2 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200"
        title="切换主题"
      >
        {current.icon}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 glass rounded-lg p-1 min-w-[120px] shadow-xl">
            {options.map((o) => (
              <button
                key={o.id}
                onClick={() => { setTheme(o.id); setOpen(false); }}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-all ${
                  theme === o.id ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                }`}
              >
                {o.icon} {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MainApp() {
  const { isLoggedIn, systemInfo, refreshSystemInfo, showToast, logout } = useApp();
  const [currentPage, setCurrentPage] = useState<Page>("files");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      refreshSystemInfo();
    }, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, [refreshSystemInfo]);

  if (!isLoggedIn) {
    return <Login />;
  }

  const renderPage = () => {
    switch (currentPage) {
      case "files": return <FileBrowser />;
      case "tasks": return <Tasks />;
      case "offline": return <OfflineTasks />;
      case "clouds": return <CloudAPIs />;
      case "mounts": return <MountPoints />;
      case "backup": return <Backup />;
      case "settings": return <Settings />;
      case "system": return <SystemInfo />;
      case "account": return <Account />;
      default: return <FileBrowser />;
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? "w-60" : "w-0"
        } transition-all duration-300 overflow-hidden bg-slate-900 border-r border-slate-800 flex flex-col`}
      >
        <div className="h-16 flex items-center gap-3 px-5 border-b border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <HardDrive className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">HappyCD2</h1>
            <p className="text-xs text-slate-500">CloudDrive2 管理器</p>
          </div>
        </div>

        <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setCurrentPage(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all ${
                currentPage === item.id
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
            >
              {item.icon}
              <span className="text-sm font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800 space-y-2">
          {systemInfo && (
            <>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <div className={`w-2 h-2 rounded-full ${systemInfo.SystemReady ? "bg-green-500" : "bg-yellow-500"}`} />
                <span>{systemInfo.SystemReady ? "系统就绪" : "系统初始化中..."}</span>
              </div>
              {systemInfo.UserName && (
                <p className="text-xs text-slate-400 truncate">用户: {systemInfo.UserName}</p>
              )}
            </>
          )}
          <button
            onClick={() => { if (confirm("确定退出登录？")) { logout(); } }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-400 hover:bg-red-600/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-16 flex items-center justify-between px-6 bg-slate-900 border-b border-slate-800">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg hover:bg-slate-800 text-slate-400"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <h2 className="text-lg font-semibold text-white">
              {navItems.find((n) => n.id === currentPage)?.label}
            </h2>
          </div>
          <ThemeToggle />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6">{renderPage()}</main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <ClipboardProvider>
          <MainApp />
          <ToastContainer />
        </ClipboardProvider>
      </AppProvider>
    </ThemeProvider>
  );
}
