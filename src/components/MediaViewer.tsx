import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  ChevronLeft, ChevronRight, X, ZoomIn, ZoomOut, Play, Pause,
  Volume2, VolumeX, Maximize2, RotateCw, Settings as SettingsIcon,
  ExternalLink, Monitor,
} from "lucide-react";
import type { CloudDriveFile } from "../types";
import { isImageFile } from "../utils";

// ==================== Default Player Settings ====================

export function getDefaultVideoPlayer(): string {
  return localStorage.getItem("happycd2_defaultVideoPlayer") || "internal";
}

export function setDefaultVideoPlayer(player: string) {
  localStorage.setItem("happycd2_defaultVideoPlayer", player);
}

export function getSlideshowInterval(): number {
  return parseInt(localStorage.getItem("happycd2_slideshowInterval") || "3");
}

export function setSlideshowInterval(secs: number) {
  localStorage.setItem("happycd2_slideshowInterval", String(secs));
}

// ==================== Image Viewer ====================

interface ImageViewerProps {
  files: CloudDriveFile[];
  startIndex: number;
  onClose: () => void;
}

export function ImageViewer({ files, startIndex, onClose }: ImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [slideshow, setSlideshow] = useState(false);
  const [slideshowInterval, setSlideshowIntervalState] = useState(getSlideshowInterval());
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const imageFiles = files.filter((f) => isImageFile(f.name) && !f.isDirectory);

  const goNext = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((i) => (i + 1) % imageFiles.length);
    setLoading(true);
  }, [imageFiles.length]);

  const goPrev = useCallback(() => {
    setZoom(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    setCurrentIndex((i) => (i - 1 + imageFiles.length) % imageFiles.length);
    setLoading(true);
  }, [imageFiles.length]);

  // Slideshow
  useEffect(() => {
    if (!slideshow) return;
    const timer = setInterval(goNext, slideshowInterval * 1000);
    return () => clearInterval(timer);
  }, [slideshow, slideshowInterval, goNext]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
      else if (e.key === " ") { e.preventDefault(); setSlideshow((s) => !s); }
      else if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      else if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
      else if (e.key === "r" || e.key === "R") setRotation((r) => (r + 90) % 360);
      else if (e.key === "0") { setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 }); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [goNext, goPrev, onClose]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (!isDragging) setShowControls(false);
    }, 3000);
  }, [isDragging]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, [resetControlsTimer]);

  const currentFile = imageFiles[currentIndex];

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) setZoom((z) => Math.min(z + 0.25, 5));
    else setZoom((z) => Math.max(z - 0.25, 0.25));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && zoom > 1) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
    resetControlsTimer();
  };

  const handleMouseUp = () => setIsDragging(false);

  const buildImageUrl = (file: CloudDriveFile) => {
    if (file.thumbnailUrl && file.canDirectAccessThumbnailURL) return file.thumbnailUrl;
    // Use preview URL for images
    if (file.previewUrl) return file.previewUrl;
    // Fallback: construct download URL
    return `http://localhost:19798/preview?path=${encodeURIComponent(file.fullPathName)}`;
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black flex items-center justify-center"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onWheel={handleWheel}
    >
      {/* Loading indicator */}
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Image */}
      {currentFile && (
        <img
          key={currentFile.fullPathName}
          src={buildImageUrl(currentFile)}
          alt={currentFile.name}
          className="max-w-full max-h-full object-contain select-none"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${zoom}) rotate(${rotation}deg)`,
            cursor: zoom > 1 ? (isDragging ? "grabbing" : "grab") : "default",
            transition: isDragging ? "none" : "transform 0.2s ease-out",
          }}
          onLoad={() => setLoading(false)}
          onError={() => setLoading(false)}
          onMouseDown={handleMouseDown}
          draggable={false}
        />
      )}

      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
      >
        <div className="flex items-center justify-between">
          <div className="text-white text-sm truncate max-w-[60%]">
            {currentFile?.name} <span className="text-slate-400 ml-2">({currentIndex + 1}/{imageFiles.length})</span>
          </div>
          <div className="flex items-center gap-2">
            {/* Slideshow interval */}
            <select
              value={slideshowInterval}
              onChange={(e) => { setSlideshowIntervalState(parseInt(e.target.value)); setSlideshowInterval(parseInt(e.target.value)); }}
              className="px-2 py-1 bg-slate-800 text-white text-xs rounded border border-slate-600"
              title="幻灯片间隔"
            >
              <option value={1}>1秒</option>
              <option value={3}>3秒</option>
              <option value={5}>5秒</option>
              <option value={10}>10秒</option>
            </select>
            <button
              onClick={() => setSlideshow(!slideshow)}
              className={`p-2 rounded-lg transition-colors ${slideshow ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              title="幻灯片 (空格)"
            >
              {slideshow ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button onClick={() => setRotation((r) => (r + 90) % 360)} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700" title="旋转 (R)">
              <RotateCw className="w-5 h-5" />
            </button>
            <button onClick={() => setZoom((z) => Math.min(z + 0.25, 5))} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700" title="放大 (+)">
              <ZoomIn className="w-5 h-5" />
            </button>
            <span className="text-white text-xs w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))} className="p-2 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700" title="缩小 (-)">
              <ZoomOut className="w-5 h-5" />
            </button>
            <button onClick={() => { setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 }); }} className="px-2 py-1 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs" title="重置 (0)">
              重置
            </button>
            <button onClick={onClose} className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-600" title="关闭 (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation arrows */}
      {imageFiles.length > 1 && (
        <>
          <button
            onClick={goPrev}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all ${showControls ? "opacity-100" : "opacity-0"}`}
            title="上一张 (←)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={goNext}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/50 text-white hover:bg-black/70 transition-all ${showControls ? "opacity-100" : "opacity-0"}`}
            title="下一张 (→)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </>
      )}

      {/* Thumbnail bar */}
      {imageFiles.length > 1 && (
        <div
          className={`absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/80 to-transparent transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
        >
          <div className="flex items-center gap-1.5 justify-center overflow-x-auto max-w-full">
            {imageFiles.map((file, i) => (
              <button
                key={file.fullPathName}
                onClick={() => { setCurrentIndex(i); setZoom(1); setRotation(0); setPosition({ x: 0, y: 0 }); setLoading(true); }}
                className={`flex-shrink-0 w-14 h-14 rounded overflow-hidden border-2 transition-all ${
                  i === currentIndex ? "border-blue-500 scale-110" : "border-transparent opacity-50 hover:opacity-80"
                }`}
              >
                <img src={buildImageUrl(file)} alt="" className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== Video Player ====================

interface VideoPlayerProps {
  file: CloudDriveFile;
  url: string;
  onClose: () => void;
  onOpenExternal?: () => void;
}

export function VideoPlayer({ file, url, onClose, onOpenExternal }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const controlsTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); }
    else { v.pause(); }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const changeSpeed = useCallback((rate: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSpeedMenu(false);
  }, []);

  const seek = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
    setCurrentTime(time);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = videoRef.current?.parentElement;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "k") { e.preventDefault(); togglePlay(); }
      else if (e.key === "ArrowLeft") seek(Math.max(0, currentTime - 10));
      else if (e.key === "ArrowRight") seek(Math.min(duration, currentTime + 10));
      else if (e.key === "m") toggleMute();
      else if (e.key === "f") toggleFullscreen();
      else if (e.key === "Escape" && !document.fullscreenElement) onClose();
      else if (e.key === "<") changeSpeed(Math.max(0.25, playbackRate - 0.25));
      else if (e.key === ">") changeSpeed(Math.min(4, playbackRate + 0.25));
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, toggleMute, toggleFullscreen, onClose, seek, currentTime, duration, playbackRate, changeSpeed]);

  // Auto-hide controls
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => {
      if (playing) setShowControls(false);
    }, 3000);
  }, [playing]);

  useEffect(() => {
    resetControlsTimer();
    return () => { if (controlsTimeout.current) clearTimeout(controlsTimeout.current); };
  }, [resetControlsTimer]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const formatTime = (s: number) => {
    if (!s || isNaN(s)) return "0:00";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div
      className="fixed inset-0 z-[10000] bg-black flex items-center justify-center"
      onMouseMove={resetControlsTimer}
      onClick={resetControlsTimer}
    >
      <video
        ref={videoRef}
        src={url}
        className="max-w-full max-h-full"
        autoPlay
        onClick={(e) => { e.stopPropagation(); togglePlay(); }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onWaiting={() => setBuffering(true)}
        onPlaying={() => setBuffering(false)}
        onCanPlay={() => setBuffering(false)}
        onError={() => setBuffering(false)}
        onVolumeChange={(e) => { setVolume(e.currentTarget.volume); setMuted(e.currentTarget.muted); }}
      >
        您的浏览器不支持视频播放。
      </video>

      {/* Buffering indicator */}
      {buffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 border-4 border-slate-600 border-t-blue-500 rounded-full animate-spin" />
        </div>
      )}

      {/* Top bar */}
      <div
        className={`absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="text-white text-sm truncate max-w-[70%]">{file.name}</div>
          <div className="flex items-center gap-2">
            {onOpenExternal && (
              <button
                onClick={onOpenExternal}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs"
                title="用外部播放器打开"
              >
                <ExternalLink className="w-4 h-4" /> 外部播放器
              </button>
            )}
            <button onClick={onClose} className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-600" title="关闭 (Esc)">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent transition-opacity ${showControls ? "opacity-100" : "opacity-0"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white text-xs w-16 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={(e) => seek(parseFloat(e.target.value))}
            className="flex-1 h-1.5 rounded-full appearance-none bg-slate-600 accent-blue-500 cursor-pointer"
            style={{
              background: `linear-gradient(to right, #3b82f6 ${(currentTime / (duration || 1)) * 100}%, #475569 ${(currentTime / (duration || 1)) * 100}%)`,
            }}
          />
          <span className="text-white text-xs w-16">{formatTime(duration)}</span>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3">
          <button onClick={togglePlay} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700" title="播放/暂停 (空格/K)">
            {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </button>

          <button onClick={() => seek(Math.max(0, currentTime - 10))} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700" title="后退10秒 (←)">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button onClick={() => seek(Math.min(duration, currentTime + 10))} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700" title="前进10秒 (→)">
            <ChevronRight className="w-5 h-5" />
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button onClick={toggleMute} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700" title="静音 (M)">
              {muted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = videoRef.current;
                if (v) { v.volume = parseFloat(e.target.value); v.muted = false; }
              }}
              className="w-20 h-1.5 rounded-full appearance-none bg-slate-600 accent-blue-500 cursor-pointer"
            />
          </div>

          <div className="flex-1" />

          {/* Speed control */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 text-white hover:bg-slate-700 text-sm"
              title="播放速度 (< >)"
            >
              {playbackRate}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 glass rounded-lg shadow-2xl py-1 min-w-[80px]">
                {speedOptions.map((rate) => (
                  <button
                    key={rate}
                    onClick={() => changeSpeed(rate)}
                    className={`w-full px-3 py-1.5 text-sm text-right hover:bg-slate-700/50 transition-colors ${
                      rate === playbackRate ? "text-blue-400 font-medium" : "text-slate-300"
                    }`}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <button onClick={toggleFullscreen} className="p-2 rounded-lg bg-slate-800 text-white hover:bg-slate-700" title="全屏 (F)">
            <Maximize2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== Player Selector Modal ====================

interface PlayerSelectorProps {
  file: CloudDriveFile;
  availablePlayers: string[];
  onPlayInternal: () => void;
  onPlayExternal: (player: string) => void;
  onClose: () => void;
  isVideo: boolean;
}

export function PlayerSelector({ file, availablePlayers, onPlayInternal, onPlayExternal, onClose, isVideo }: PlayerSelectorProps) {
  const [defaultPlayer, setDefaultPlayer] = useState(getDefaultVideoPlayer());
  const playerLabels: Record<string, string> = {
    internal: "内置播放器",
    vlc: "VLC 播放器",
    potplayer: "PotPlayer",
    "mpc-hc": "MPC-HC",
    mpv: "MPV",
  };

  const handleSelect = (player: string) => {
    if (defaultPlayer !== "ask") {
      setDefaultVideoPlayer(defaultPlayer);
    }
    if (player === "internal") onPlayInternal();
    else onPlayExternal(player);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="glass rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">选择播放器</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-700 text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-400 mb-4 truncate">播放: {file.name}</p>
        <div className="space-y-2">
          {/* Internal player */}
          <button
            onClick={() => handleSelect("internal")}
            className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
          >
            <Monitor className="w-5 h-5 text-blue-400" />
            <span className="text-sm text-white flex-1 text-left">{playerLabels.internal}</span>
            {isVideo && <span className="text-xs text-slate-500">支持倍速/静音</span>}
          </button>

          {/* External players */}
          {availablePlayers.map((player: string) => (
            <button
              key={player}
              onClick={() => handleSelect(player)}
              className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
            >
              <ExternalLink className="w-5 h-5 text-orange-400" />
              <span className="text-sm text-white flex-1 text-left">{playerLabels[player] || player}</span>
            </button>
          ))}
        </div>

        {/* Default player setting */}
        {isVideo && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <label className="text-xs text-slate-400 mb-2 block">默认播放器</label>
            <div className="flex gap-2">
              <select
                value={defaultPlayer}
                onChange={(e) => {
                  const v = e.target.value;
                  setDefaultPlayer(v);
                  setDefaultVideoPlayer(v);
                }}
                className="flex-1 px-3 py-2 bg-slate-800 rounded-lg text-white text-sm border border-slate-700 focus:border-blue-500 focus:outline-none"
              >
                <option value="ask">每次询问</option>
                <option value="internal">内置播放器</option>
                {availablePlayers.map((p) => (
                  <option key={p} value={p}>{playerLabels[p] || p}</option>
                ))}
              </select>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">设置后播放视频时将自动使用选择的播放器</p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium"
        >
          取消
        </button>
      </div>
    </div>
  );
}
