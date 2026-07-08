import React, { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "../contexts/AppContext";
import { fileApi, mountApi } from "../api/client";
import { checkAvailablePlayers, launchPlayer, openInSystem } from "../api/tauri";
import {
  formatSize, formatDate, getFileType, isVideoFile, isAudioFile, parentPath, basename,
} from "../utils";
import type { CloudDriveFile } from "../types";
import {
  ChevronRight, Home, RefreshCw, Search, FolderPlus, Lock, Unlock, Upload as UploadIcon,
  Trash2, Edit2, Copy, Move, Download, Play, MoreVertical, ArrowLeft, Folder, FileText,
  FileVideo, FileAudio, FileImage, File as FileIcon, Loader2, X, Eye, Link2, HardDrive,
  ChevronDown, List, Grid3x3, Clock,
} from "lucide-react";

const fileTypeIcons: Record<string, React.ReactNode> = {
  folder: <Folder className="w-5 h-5 text-blue-400" />,
  video: <FileVideo className="w-5 h-5 text-purple-400" />,
  audio: <FileAudio className="w-5 h-5 text-green-400" />,
  image: <FileImage className="w-5 h-5 text-orange-400" />,
  doc: <FileText className="w-5 h-5 text-slate-400" />,
  file: <FileIcon className="w-5 h-5 text-slate-400" />,
};

export default function FileBrowser() {
  const { showToast } = useApp();
  const [currentPath, setCurrentPath] = useState("/");
  const [files, setFiles] = useState<CloudDriveFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [searchMode, setSearchMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CloudDriveFile[]>([]);
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [sortBy, setSortBy] = useState<"name" | "size" | "date">("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; file: CloudDriveFile } | null>(null);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showRename, setShowRename] = useState<{ path: string; name: string } | null>(null);
  const [showMoveCopy, setShowMoveCopy] = useState<{ mode: "move" | "copy"; paths: string[] } | null>(null);
  const [showUnlock, setShowUnlock] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState<CloudDriveFile | null>(null);
  const [availablePlayers, setAvailablePlayers] = useState<string[]>([]);
  const [detailFile, setDetailFile] = useState<CloudDriveFile | null>(null);
  const [showAddSharedLink, setShowAddSharedLink] = useState(false);

  const loadFiles = useCallback(async (path: string) => {
    setLoading(true);
    setSelectedFiles(new Set());
    try {
      const result = await fileApi.list(path, false);
      setFiles(result || []);
    } catch (e: any) {
      showToast("error", `加载文件失败: ${e.message}`);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!searchMode) {
      loadFiles(currentPath);
    }
  }, [currentPath, searchMode, loadFiles]);

  useEffect(() => {
    checkAvailablePlayers().then(setAvailablePlayers).catch(() => setAvailablePlayers([]));
  }, []);

  // Close context menu on click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setSearchMode(true);
    try {
      const results = await fileApi.search(currentPath, searchQuery, true, false);
      setSearchResults(results || []);
    } catch (e: any) {
      showToast("error", `搜索失败: ${e.message}`);
      setSearchResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: CloudDriveFile) => {
    if (file.isDirectory) {
      setCurrentPath(file.fullPathName);
      setSearchMode(false);
      setSearchResults([]);
    } else {
      // Show file details
      setDetailFile(file);
    }
  };

  const handleBack = () => {
    if (searchMode) {
      setSearchMode(false);
      setSearchResults([]);
      setSearchQuery("");
      loadFiles(currentPath);
    } else {
      const pp = parentPath(currentPath);
      setCurrentPath(pp);
    }
  };

  const handleBreadcrumb = (path: string) => {
    setSearchMode(false);
    setSearchResults([]);
    setCurrentPath(path);
  };

  const toggleSelect = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const handleSelectAll = () => {
    const allFiles = searchMode ? searchResults : files;
    if (selectedFiles.size === allFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(allFiles.map((f) => f.fullPathName)));
    }
  };

  const handleDelete = async (paths: string[], permanent = false) => {
    if (!confirm(`确定要${permanent ? "永久" : ""}删除 ${paths.length} 个文件？`)) return;
    try {
      if (paths.length === 1) {
        permanent ? await fileApi.deletePermanently(paths[0]) : await fileApi.delete(paths[0]);
      } else {
        permanent ? await fileApi.deleteBatchPermanently(paths) : await fileApi.deleteBatch(paths);
      }
      showToast("success", "删除成功");
      loadFiles(currentPath);
    } catch (e: any) {
      showToast("error", `删除失败: ${e.message}`);
    }
  };

  const handleRename = async (path: string, newName: string) => {
    try {
      await fileApi.rename(path, newName);
      showToast("success", "重命名成功");
      loadFiles(currentPath);
    } catch (e: any) {
      showToast("error", `重命名失败: ${e.message}`);
    }
  };

  const handleCreateFolder = async (name: string, encrypted = false, password = "") => {
    try {
      if (encrypted) {
        await fileApi.createEncryptedFolder(currentPath, name, password, true);
      } else {
        await fileApi.createFolder(currentPath, name);
      }
      showToast("success", "创建文件夹成功");
      loadFiles(currentPath);
    } catch (e: any) {
      showToast("error", `创建失败: ${e.message}`);
    }
  };

  const handleMoveCopy = async (destPath: string) => {
    if (!showMoveCopy) return;
    try {
      if (showMoveCopy.mode === "move") {
        await fileApi.move(showMoveCopy.paths, destPath);
      } else {
        await fileApi.copy(showMoveCopy.paths, destPath);
      }
      showToast("success", `${showMoveCopy.mode === "move" ? "移动" : "复制"}成功`);
      loadFiles(currentPath);
    } catch (e: any) {
      showToast("error", `${showMoveCopy.mode === "move" ? "移动" : "复制"}失败: ${e.message}`);
    }
  };

  const handleUnlock = async (path: string, password: string, permanent: boolean) => {
    try {
      await fileApi.unlock(path, password, permanent);
      showToast("success", "解锁成功");
      loadFiles(currentPath);
    } catch (e: any) {
      showToast("error", `解锁失败: ${e.message}`);
    }
  };

  const handlePlay = async (file: CloudDriveFile, player: string) => {
    try {
      // Get download URL
      const urlInfo = await fileApi.downloadUrl(file.fullPathName, false, false, false);
      let url = urlInfo.directUrl;
      if (!url && urlInfo.downloadUrlPath) {
        // Build URL from path
        const scheme = "http";
        const host = "localhost:19798";
        url = `${scheme}://${host}${urlInfo.downloadUrlPath
          .replace("{SCHEME}", scheme)
          .replace("{HOST}", host)
          .replace("{PREVIEW}", "false")}`;
      }
      if (!url) {
        showToast("error", "无法获取文件下载URL");
        return;
      }

      // Try launching player
      try {
        await launchPlayer(player, url);
        showToast("success", `已启动 ${player} 播放: ${file.name}`);
      } catch (e: any) {
        // Fallback: open in system browser
        showToast("warning", `${e.message}，尝试在系统浏览器中打开...`);
        try {
          await openInSystem(url);
        } catch (e2: any) {
          showToast("error", `无法打开: ${e2.message}`);
        }
      }
    } catch (e: any) {
      showToast("error", `获取播放URL失败: ${e.message}`);
    }
  };

  // Sort files
  const sortedFiles = [...(searchMode ? searchResults : files)].sort((a, b) => {
    // Directories first
    if (a.isDirectory && !b.isDirectory) return -1;
    if (!a.isDirectory && b.isDirectory) return 1;
    
    let cmp = 0;
    if (sortBy === "name") cmp = a.name.localeCompare(b.name);
    else if (sortBy === "size") cmp = (parseInt(String(a.size)) || 0) - (parseInt(String(b.size)) || 0);
    else if (sortBy === "date") cmp = new Date(a.writeTime || "").getTime() - new Date(b.writeTime || "").getTime();
    return sortAsc ? cmp : -cmp;
  });

  const breadcrumbParts = currentPath.split("/").filter((p) => p);

  return (
    <div className="h-full flex flex-col" onClick={() => setContextMenu(null)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <button
          onClick={handleBack}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="返回"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => loadFiles(currentPath)}
          className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowNewFolder(true)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm"
        >
          <FolderPlus className="w-4 h-4" /> 新建文件夹
        </button>

        {/* Search */}
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="搜索文件..."
              className="w-full pl-10 pr-4 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors"
          >
            搜索
          </button>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setViewMode("list")}
            className={`p-1.5 rounded ${viewMode === "list" ? "bg-slate-700 text-white" : "text-slate-500"}`}
          >
            <List className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded ${viewMode === "grid" ? "bg-slate-700 text-white" : "text-slate-500"}`}
          >
            <Grid3x3 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="flex items-center gap-1 mb-4 text-sm text-slate-400 overflow-x-auto">
        <button
          onClick={() => handleBreadcrumb("/")}
          className="flex items-center gap-1 px-2 py-1 rounded hover:bg-slate-800 transition-colors"
        >
          <Home className="w-4 h-4" />
        </button>
        {breadcrumbParts.map((part, i) => {
          const path = "/" + breadcrumbParts.slice(0, i + 1).join("/");
          return (
            <React.Fragment key={path}>
              <ChevronRight className="w-3 h-3 text-slate-600" />
              <button
                onClick={() => handleBreadcrumb(path)}
                className="px-2 py-1 rounded hover:bg-slate-800 hover:text-white transition-colors whitespace-nowrap"
              >
                {part}
              </button>
            </React.Fragment>
          );
        })}
        {searchMode && (
          <>
            <ChevronRight className="w-3 h-3 text-slate-600" />
            <span className="px-2 py-1 text-blue-400">搜索: "{searchQuery}"</span>
          </>
        )}
      </div>

      {/* Batch operations */}
      {selectedFiles.size > 0 && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-slate-800/50 rounded-lg">
          <span className="text-sm text-slate-300">已选择 {selectedFiles.size} 项</span>
          <button
            onClick={() => setShowMoveCopy({ mode: "move", paths: [...selectedFiles] })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            <Move className="w-3.5 h-3.5" /> 移动
          </button>
          <button
            onClick={() => setShowMoveCopy({ mode: "copy", paths: [...selectedFiles] })}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm"
          >
            <Copy className="w-3.5 h-3.5" /> 复制
          </button>
          <button
            onClick={() => handleDelete([...selectedFiles])}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-sm"
          >
            <Trash2 className="w-3.5 h-3.5" /> 删除
          </button>
          <button
            onClick={() => setSelectedFiles(new Set())}
            className="px-3 py-1.5 text-slate-400 hover:text-white text-sm"
          >
            取消选择
          </button>
        </div>
      )}

      {/* File list */}
      <div className="flex-1 overflow-auto rounded-lg border border-slate-800">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : sortedFiles.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500">
            <Folder className="w-16 h-16 mb-3 opacity-50" />
            <p>空文件夹</p>
          </div>
        ) : viewMode === "list" ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-800/80 sticky top-0 z-10">
              <tr className="text-slate-400 text-xs">
                <th className="w-8 px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selectedFiles.size === sortedFiles.length && sortedFiles.length > 0}
                    onChange={handleSelectAll}
                    className="rounded bg-slate-700 border-slate-600"
                  />
                </th>
                <th
                  className="text-left px-3 py-2 cursor-pointer hover:text-white"
                  onClick={() => { setSortBy("name"); setSortAsc(!sortAsc); }}
                >
                  名称 {sortBy === "name" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="text-right px-3 py-2 cursor-pointer hover:text-white w-32"
                  onClick={() => { setSortBy("size"); setSortAsc(!sortAsc); }}
                >
                  大小 {sortBy === "size" && (sortAsc ? "↑" : "↓")}
                </th>
                <th
                  className="text-right px-3 py-2 cursor-pointer hover:text-white w-40"
                  onClick={() => { setSortBy("date"); setSortAsc(!sortAsc); }}
                >
                  修改时间 {sortBy === "date" && (sortAsc ? "↑" : "↓")}
                </th>
                <th className="w-10 px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => (
                <tr
                  key={file.fullPathName}
                  className={`border-t border-slate-800 hover:bg-slate-800/50 transition-colors ${
                    selectedFiles.has(file.fullPathName) ? "bg-blue-600/10" : ""
                  }`}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setContextMenu({ x: e.clientX, y: e.clientY, file });
                  }}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(file.fullPathName)}
                      onChange={() => toggleSelect(file.fullPathName)}
                      className="rounded bg-slate-700 border-slate-600"
                    />
                  </td>
                  <td
                    className="px-3 py-2 cursor-pointer"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="flex items-center gap-2">
                      {fileTypeIcons[getFileType(file.name, file.isDirectory)]}
                      <span className="text-slate-200 truncate max-w-md">{file.name}</span>
                      {file.fileEncryptionType === "Encrypted" && (
                        <Lock className="w-3 h-3 text-yellow-500" />
                      )}
                      {file.fileEncryptionType === "Unlocked" && (
                        <Unlock className="w-3 h-3 text-green-500" />
                      )}
                      {file.readOnly && (
                        <span className="text-xs text-slate-500 px-1.5 py-0.5 bg-slate-700 rounded">只读</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {file.isDirectory ? "-" : formatSize(file.size)}
                  </td>
                  <td className="px-3 py-2 text-right text-slate-400">
                    {formatDate(file.writeTime)}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setContextMenu({ x: e.clientX, y: e.clientY, file });
                      }}
                      className="p-1 rounded hover:bg-slate-700 text-slate-500"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          // Grid view
          <div className="p-4 grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3">
            {sortedFiles.map((file) => (
              <div
                key={file.fullPathName}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedFiles.has(file.fullPathName)
                    ? "border-blue-500 bg-blue-600/10"
                    : "border-slate-800 hover:border-slate-600 hover:bg-slate-800/50"
                }`}
                onClick={() => handleFileClick(file)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, file });
                }}
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="w-12 h-12 flex items-center justify-center">
                    {file.thumbnailUrl ? (
                      <img src={file.thumbnailUrl} alt="" className="w-12 h-12 rounded object-cover" />
                    ) : (
                      <div className="scale-150">{fileTypeIcons[getFileType(file.name, file.isDirectory)]}</div>
                    )}
                  </div>
                  <span className="text-xs text-slate-200 text-center truncate w-full" title={file.name}>
                    {file.name}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    {file.isDirectory ? "-" : formatSize(file.size)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={contextMenu.file}
          onClose={() => setContextMenu(null)}
          onOpen={() => handleFileClick(contextMenu.file)}
          onRename={() => setShowRename({ path: contextMenu.file.fullPathName, name: contextMenu.file.name })}
          onDelete={() => handleDelete([contextMenu.file.fullPathName])}
          onDeletePermanently={() => handleDelete([contextMenu.file.fullPathName], true)}
          onMove={() => setShowMoveCopy({ mode: "move", paths: [contextMenu.file.fullPathName] })}
          onCopy={() => setShowMoveCopy({ mode: "copy", paths: [contextMenu.file.fullPathName] })}
          onUnlock={() => setShowUnlock(contextMenu.file.fullPathName)}
          onPlay={() => setShowPlayer(contextMenu.file)}
          onDownload={async () => {
            try {
              const urlInfo = await fileApi.downloadUrl(contextMenu.file.fullPathName);
              let url = urlInfo.directUrl || "";
              if (!url && urlInfo.downloadUrlPath) {
                url = `http://localhost:19798${urlInfo.downloadUrlPath.replace("{SCHEME}", "http").replace("{HOST}", "localhost:19798").replace("{PREVIEW}", "false")}`;
              }
              if (url) {
                await openInSystem(url);
                showToast("info", "正在下载...");
              } else {
                showToast("error", "无法获取下载URL");
              }
            } catch (e: any) {
              showToast("error", e.message);
            }
          }}
          onDetail={() => setDetailFile(contextMenu.file)}
        />
      )}

      {/* Modals */}
      {showNewFolder && (
        <NewFolderModal
          onClose={() => setShowNewFolder(false)}
          onCreate={handleCreateFolder}
        />
      )}
      {showRename && (
        <RenameModal
          initialName={showRename.name}
          onClose={() => setShowRename(null)}
          onConfirm={(newName: string) => {
            handleRename(showRename.path, newName);
            setShowRename(null);
          }}
        />
      )}
      {showMoveCopy && (
        <PathPickerModal
          mode={showMoveCopy.mode}
          onClose={() => setShowMoveCopy(null)}
          onConfirm={(destPath: string) => {
            handleMoveCopy(destPath);
            setShowMoveCopy(null);
          }}
        />
      )}
      {showUnlock && (
        <UnlockModal
          onClose={() => setShowUnlock(null)}
          onUnlock={(password: string, permanent: boolean) => {
            handleUnlock(showUnlock, password, permanent);
            setShowUnlock(null);
          }}
        />
      )}
      {showPlayer && (
        <PlayerModal
          file={showPlayer}
          availablePlayers={availablePlayers}
          onClose={() => setShowPlayer(null)}
          onPlay={(player: string) => {
            handlePlay(showPlayer, player);
            setShowPlayer(null);
          }}
        />
      )}
      {detailFile && (
        <FileDetailModal
          file={detailFile}
          onClose={() => setDetailFile(null)}
        />
      )}
    </div>
  );
}

// ==================== Sub Components ====================

function ContextMenu({ x, y, file, onClose, ...handlers }: any) {
  const items = [];
  
  items.push({ label: "打开", icon: <Eye className="w-4 h-4" />, action: handlers.onOpen });
  
  if (!file.isDirectory) {
    if (isVideoFile(file.name) || isAudioFile(file.name)) {
      items.push({ label: "播放", icon: <Play className="w-4 h-4" />, action: handlers.onPlay });
    }
    items.push({ label: "下载", icon: <Download className="w-4 h-4" />, action: handlers.onDownload });
  }
  
  items.push({ label: "详情", icon: <FileText className="w-4 h-4" />, action: handlers.onDetail });
  items.push({ label: "重命名", icon: <Edit2 className="w-4 h-4" />, action: handlers.onRename });
  items.push({ label: "移动到...", icon: <Move className="w-4 h-4" />, action: handlers.onMove });
  items.push({ label: "复制到...", icon: <Copy className="w-4 h-4" />, action: handlers.onCopy });
  
  if (file.fileEncryptionType === "Encrypted") {
    items.push({ label: "解锁", icon: <Unlock className="w-4 h-4" />, action: handlers.onUnlock });
  }
  
  items.push({ divider: true });
  items.push({ label: "删除", icon: <Trash2 className="w-4 h-4" />, action: handlers.onDelete, danger: true });
  
  if (file.canDeletePermanently) {
    items.push({ label: "永久删除", icon: <Trash2 className="w-4 h-4" />, action: handlers.onDeletePermanently, danger: true });
  }

  return (
    <div
      className="fixed z-[9999] glass rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {items.map((item: any, i: number) =>
        item.divider ? (
          <div key={i} className="my-1 border-t border-slate-700" />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.action();
              onClose();
            }}
            className={`w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-slate-700/50 transition-colors ${
              item.danger ? "text-red-400" : "text-slate-300"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        )
      )}
    </div>
  );
}

function Modal({ title, children, onClose, width = "max-w-md" }: any) {
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className={`glass rounded-2xl p-6 w-full ${width} mx-4 shadow-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function NewFolderModal({ onClose, onCreate }: any) {
  const [name, setName] = useState("");
  const [encrypted, setEncrypted] = useState(false);
  const [password, setPassword] = useState("");

  return (
    <Modal title="新建文件夹" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">文件夹名称</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && name && onCreate(name, encrypted, password)}
            autoFocus
            className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={encrypted}
            onChange={(e) => setEncrypted(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600"
          />
          加密文件夹
        </label>
        {encrypted && (
          <div>
            <label className="text-xs text-slate-400 mb-1.5 block">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
            />
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => name && onCreate(name, encrypted, password)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            创建
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

function RenameModal({ initialName, onClose, onConfirm }: any) {
  const [name, setName] = useState(initialName);
  return (
    <Modal title="重命名" onClose={onClose}>
      <div className="space-y-4">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name && onConfirm(name)}
          autoFocus
          className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
        />
        <div className="flex gap-3">
          <button
            onClick={() => name && onConfirm(name)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            确认
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

function UnlockModal({ onClose, onUnlock }: any) {
  const [password, setPassword] = useState("");
  const [permanent, setPermanent] = useState(true);
  return (
    <Modal title="解锁加密文件" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-xs text-slate-400 mb-1.5 block">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="w-full px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={permanent}
            onChange={(e) => setPermanent(e.target.checked)}
            className="rounded bg-slate-700 border-slate-600"
          />
          永久解锁（保存密码）
        </label>
        <div className="flex gap-3">
          <button
            onClick={() => password && onUnlock(password, permanent)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            解锁
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

function PlayerModal({ file, availablePlayers, onClose, onPlay }: any) {
  const playerLabels: Record<string, string> = {
    vlc: "VLC 播放器",
    potplayer: "PotPlayer",
    "mpc-hc": "MPC-HC",
    mpv: "MPV",
  };
  const playerIcons: Record<string, React.ReactNode> = {
    vlc: <Play className="w-5 h-5 text-orange-400" />,
    potplayer: <Play className="w-5 h-5 text-blue-400" />,
    "mpc-hc": <Play className="w-5 h-5 text-green-400" />,
    mpv: <Play className="w-5 h-5 text-purple-400" />,
  };

  return (
    <Modal title="选择播放器" onClose={onClose}>
      <div className="space-y-3">
        <p className="text-sm text-slate-400">播放文件: <span className="text-slate-200">{file.name}</span></p>
        {availablePlayers.length === 0 ? (
          <p className="text-sm text-yellow-400">未检测到已安装的播放器，请安装 VLC 或 PotPlayer。</p>
        ) : (
          <div className="space-y-2">
            {availablePlayers.map((player: string) => (
              <button
                key={player}
                onClick={() => onPlay(player)}
                className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
              >
                {playerIcons[player] || <Play className="w-5 h-5" />}
                <span className="text-sm text-white">{playerLabels[player] || player}</span>
              </button>
            ))}
          </div>
        )}
        <button
          onClick={onClose}
          className="w-full py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
        >
          取消
        </button>
      </div>
    </Modal>
  );
}

function PathPickerModal({ mode, onClose, onConfirm }: any) {
  const [currentPath, setCurrentPath] = useState("/");
  const [subFiles, setSubFiles] = useState<CloudDriveFile[]>([]);
  const [loading, setLoading] = useState(false);

  const loadSubFiles = async (path: string) => {
    setLoading(true);
    try {
      const result = await fileApi.list(path, false);
      setSubFiles((result || []).filter((f: CloudDriveFile) => f.isDirectory));
    } catch {
      setSubFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubFiles(currentPath);
  }, [currentPath]);

  return (
    <Modal title={mode === "move" ? "移动到..." : "复制到..."} onClose={onClose} width="max-w-lg">
      <div className="space-y-4">
        <div className="text-sm text-slate-400">当前路径: <span className="text-blue-400">{currentPath}</span></div>
        <div className="max-h-64 overflow-auto rounded-lg border border-slate-700">
          {currentPath !== "/" && (
            <button
              onClick={() => setCurrentPath(parentPath(currentPath))}
              className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-800 text-sm text-slate-300"
            >
              <ArrowLeft className="w-4 h-4" /> 返回上级
            </button>
          )}
          {loading ? (
            <div className="p-4 text-center"><Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto" /></div>
          ) : (
            subFiles.map((f) => (
              <button
                key={f.fullPathName}
                onClick={() => setCurrentPath(f.fullPathName)}
                className="w-full flex items-center gap-2 px-4 py-2 hover:bg-slate-800 text-sm text-slate-300"
              >
                <Folder className="w-4 h-4 text-blue-400" /> {f.name}
              </button>
            ))
          )}
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => onConfirm(currentPath)}
            className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
          >
            确认{mode === "move" ? "移动" : "复制"}到此
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
          >
            取消
          </button>
        </div>
      </div>
    </Modal>
  );
}

function FileDetailModal({ file, onClose }: any) {
  const [detail, setDetail] = useState<any>(null);
  const [spaceInfo, setSpaceInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (file.hasDetailProperties) {
          const d = await fileApi.detailProperties(file.fullPathName);
          setDetail(d);
        }
        if (file.isDirectory) {
          const s = await fileApi.spaceInfo(file.fullPathName);
          setSpaceInfo(s);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [file]);

  return (
    <Modal title="文件详情" onClose={onClose} width="max-w-lg">
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <InfoItem label="名称" value={file.name} />
          <InfoItem label="类型" value={file.isDirectory ? "文件夹" : "文件"} />
          <InfoItem label="大小" value={file.isDirectory ? "-" : formatSize(file.size)} />
          <InfoItem label="路径" value={file.fullPathName} />
          <InfoItem label="创建时间" value={formatDate(file.createTime)} />
          <InfoItem label="修改时间" value={formatDate(file.writeTime)} />
          {file.cloudAPI && (
            <InfoItem label="云盘" value={file.cloudAPI.name} />
          )}
          {file.fileEncryptionType && file.fileEncryptionType !== "None" && (
            <InfoItem label="加密状态" value={file.fileEncryptionType === "Encrypted" ? "已加密（未解锁）" : "已解锁"} />
          )}
        </div>
        {detail && (
          <div className="pt-3 border-t border-slate-700">
            <h4 className="text-xs text-slate-400 mb-2">详细信息</h4>
            <div className="grid grid-cols-2 gap-3">
              <InfoItem label="文件数" value={String(detail.totalFileCount)} />
              <InfoItem label="文件夹数" value={String(detail.totalFolderCount)} />
              <InfoItem label="总大小" value={formatSize(detail.totalSize)} />
              <InfoItem label="收藏" value={detail.isFaved ? "是" : "否"} />
              <InfoItem label="共享" value={detail.isShared ? "是" : "否"} />
            </div>
          </div>
        )}
        {spaceInfo && (
          <div className="pt-3 border-t border-slate-700">
            <h4 className="text-xs text-slate-400 mb-2">空间信息</h4>
            <div className="grid grid-cols-3 gap-3">
              <InfoItem label="总空间" value={formatSize(spaceInfo.totalSpace)} />
              <InfoItem label="已用" value={formatSize(spaceInfo.usedSpace)} />
              <InfoItem label="可用" value={formatSize(spaceInfo.freeSpace)} />
            </div>
          </div>
        )}
        {loading && <div className="text-center py-4"><Loader2 className="w-5 h-5 text-blue-500 animate-spin mx-auto" /></div>}
      </div>
    </Modal>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-200 break-all">{value}</dd>
    </div>
  );
}
