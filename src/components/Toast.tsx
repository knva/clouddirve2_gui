import React from "react";
import { useApp } from "../contexts/AppContext";
import { CheckCircle, XCircle, Info, AlertTriangle, X } from "lucide-react";

export default function ToastContainer() {
  const { toasts, removeToast } = useApp();

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-green-400" />,
    error: <XCircle className="w-5 h-5 text-red-400" />,
    info: <Info className="w-5 h-5 text-blue-400" />,
    warning: <AlertTriangle className="w-5 h-5 text-yellow-400" />,
  };

  const bgColors = {
    success: "border-green-500/30",
    error: "border-red-500/30",
    info: "border-blue-500/30",
    warning: "border-yellow-500/30",
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 w-96">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`glass ${bgColors[toast.type]} rounded-lg p-4 flex items-start gap-3 toast-enter shadow-xl`}
        >
          {icons[toast.type]}
          <span className="flex-1 text-sm text-slate-200">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="text-slate-500 hover:text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );
}
