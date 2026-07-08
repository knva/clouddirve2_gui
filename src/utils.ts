/// Format bytes to human-readable string.
export function formatSize(bytes: number | string | undefined): string {
  if (bytes === undefined || bytes === null) return "-";
  const n = typeof bytes === "string" ? parseInt(bytes) : bytes;
  if (isNaN(n) || n === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(2)} ${units[i]}`;
}

/// Format speed (bytes per second) to human-readable string.
export function formatSpeed(bytesPerSec: number | undefined): string {
  if (!bytesPerSec || bytesPerSec <= 0) return "0 B/s";
  return `${formatSize(bytesPerSec)}/s`;
}

/// Format a timestamp (proto timestamp or string) to a readable date.
export function formatDate(ts: any): string {
  if (!ts) return "-";
  let d: Date;
  if (typeof ts === "string") {
    d = new Date(ts);
  } else if (ts.seconds) {
    d = new Date(parseInt(ts.seconds) * 1000);
  } else if (typeof ts === "number") {
    d = new Date(ts);
  } else {
    return "-";
  }
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleString("zh-CN");
}

/// Format uptime in seconds to a readable string.
export function formatUptime(seconds: number): string {
  if (!seconds) return "-";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const parts = [];
  if (days > 0) parts.push(`${days}天`);
  if (hours > 0) parts.push(`${hours}小时`);
  if (mins > 0) parts.push(`${mins}分`);
  parts.push(`${secs}秒`);
  return parts.join(" ");
}

/// Format percentage.
export function formatPercent(value: number, total: number): string {
  if (!total || total === 0) return "0%";
  return `${((value / total) * 100).toFixed(1)}%`;
}

/// Get file extension from filename.
export function getFileExt(name: string): string {
  const parts = name.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/// Check if a file is a video file.
export function isVideoFile(name: string): boolean {
  const ext = getFileExt(name);
  const videoExts = ["mp4", "mkv", "avi", "mov", "wmv", "flv", "webm", "m4v", "ts", "rmvb", "rm", "3gp", "mpg", "mpeg", "vob", "f4v"];
  return videoExts.includes(ext);
}

/// Check if a file is an audio file.
export function isAudioFile(name: string): boolean {
  const ext = getFileExt(name);
  const audioExts = ["mp3", "flac", "wav", "aac", "ogg", "wma", "m4a", "ape", "alac", "opus"];
  return audioExts.includes(ext);
}

/// Check if a file is an image file.
export function isImageFile(name: string): boolean {
  const ext = getFileExt(name);
  const imageExts = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg", "tiff", "ico"];
  return imageExts.includes(ext);
}

/// Check if a file is a document file.
export function isDocFile(name: string): boolean {
  const ext = getFileExt(name);
  const docExts = ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "md", "csv", "epub"];
  return docExts.includes(ext);
}

/// Get file type icon name based on file extension.
export function getFileType(name: string, isDir: boolean): string {
  if (isDir) return "folder";
  if (isVideoFile(name)) return "video";
  if (isAudioFile(name)) return "audio";
  if (isImageFile(name)) return "image";
  if (isDocFile(name)) return "doc";
  return "file";
}

/// Join path segments safely.
export function joinPath(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/\/+$/, "").replace(/^\/+/, ""))
    .filter((p) => p.length > 0)
    .join("/");
}

/// Get parent path.
export function parentPath(path: string): string {
  if (!path || path === "/" || path === "") return "/";
  const parts = path.split("/").filter((p) => p.length > 0);
  if (parts.length <= 1) return "/";
  parts.pop();
  return "/" + parts.join("/");
}

/// Get filename from full path.
export function basename(path: string): string {
  if (!path) return "";
  const parts = path.split("/").filter((p) => p.length > 0);
  return parts[parts.length - 1] || "";
}

/// Build a full download URL from the downloadUrlPath info.
export function buildDownloadUrl(info: any, grpcHost = "localhost:19798", useHttps = false): string {
  if (info.directUrl) {
    return info.directUrl;
  }
  if (!info.downloadUrlPath) {
    return "";
  }
  const scheme = useHttps ? "https" : "http";
  let url = info.downloadUrlPath;
  url = url.replace("{SCHEME}", scheme);
  url = url.replace("{HOST}", grpcHost);
  url = url.replace("{PREVIEW}", "false");
  return `${scheme}://${grpcHost}${url}`;
}

/// Download a string as a file (for client-side file download).
export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/// Copy text to clipboard.
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
  }
}
