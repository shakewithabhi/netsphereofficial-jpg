import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Download,
  Lock,
  Eye,
  LogIn,
  UserPlus,
  Folder,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Smartphone,
  X,
  Save,
  ArrowLeft,
  ExternalLink,
} from 'lucide-react';
import { FileIcon } from '../components/FileIcon';
import { formatBytes } from '../api/files';
import { useTheme } from '../hooks/useTheme';
import type {
  ShareInfo,
  SharePreview,
  ShareFolderItem,
} from '../api/share';
import {
  getShareInfo,
  getSharePreview,
  getShareDownload,
  getShareFolderContents,
  saveToStorage,
} from '../api/share';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

function getFileCategory(mime: string): 'image' | 'video' | 'audio' | 'pdf' | 'other' {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'pdf';
  return 'other';
}

function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                    */
/* ------------------------------------------------------------------ */

function Logo({ isDark }: { isDark: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2.5 select-none">
      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
        <span className="text-white font-bold text-sm">B</span>
      </div>
      <span
        className={`text-lg font-bold tracking-tight ${
          isDark ? 'text-white' : 'text-slate-900'
        }`}
      >
        ByteBox
      </span>
    </Link>
  );
}

/* ---------- Smart App Banner ---------- */

function SmartBanner({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const deepLink = `bytebox://share/${code}`;
  const storeLink = /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? 'https://apps.apple.com/app/bytebox/id000000000'
    : 'https://play.google.com/store/apps/details?id=com.byteboxapp';

  return (
    <div className="fixed top-0 inset-x-0 z-50 bg-slate-800 border-b border-slate-700 px-4 py-2.5 flex items-center gap-3 animate-slideDown">
      <button
        onClick={onClose}
        className="shrink-0 p-1 text-slate-400 hover:text-white rounded transition-colors"
      >
        <X size={16} />
      </button>
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0">
        <span className="text-white font-bold text-xs">B</span>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-white truncate">
          ByteBox
        </p>
        <p className="text-xs text-slate-400">Get the ByteBox App</p>
      </div>
      <a
        href={deepLink}
        className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-colors"
        onClick={(e) => {
          // Try deep link first, fall back to store
          setTimeout(() => {
            window.location.href = storeLink;
          }, 1500);
        }}
      >
        Open
      </a>
    </div>
  );
}

/* ---------- Password Gate ---------- */

function PasswordGate({
  isDark,
  onSubmit,
  error,
}: {
  isDark: boolean;
  onSubmit: (pw: string) => void;
  error: string;
}) {
  const [pw, setPw] = useState('');

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4">
      <div
        className={`w-full max-w-sm rounded-2xl p-8 shadow-xl ${
          isDark ? 'bg-slate-800 border border-slate-700' : 'bg-white border border-slate-200'
        }`}
      >
        <div className="flex justify-center mb-5">
          <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Lock size={28} className="text-amber-600" />
          </div>
        </div>
        <h2
          className={`text-xl font-bold text-center mb-2 ${
            isDark ? 'text-white' : 'text-slate-900'
          }`}
        >
          Password Protected
        </h2>
        <p
          className={`text-sm text-center mb-6 ${
            isDark ? 'text-slate-400' : 'text-slate-500'
          }`}
        >
          Enter the password to access this shared file.
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(pw);
          }}
        >
          <input
            type="password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="Enter password"
            autoFocus
            className={`w-full px-4 py-3 rounded-xl text-sm border outline-none transition-colors mb-3 ${
              isDark
                ? 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500'
                : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-blue-500'
            }`}
          />
          {error && (
            <p className="text-red-500 text-xs mb-3">{error}</p>
          )}
          <button
            type="submit"
            disabled={!pw}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            Unlock
          </button>
        </form>
      </div>
    </div>
  );
}

/* ---------- Preview Overlay ---------- */

function PreviewOverlay({ type, code }: { type: 'video' | 'audio'; code: string }) {
  return (
    <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fadeIn">
      <div className="text-center px-6 max-w-md">
        <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-slate-800 border border-slate-600 flex items-center justify-center">
          <Eye size={32} className="text-blue-400" />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">
          Preview Ended
        </h3>
        <p className="text-slate-400 text-sm mb-6">
          Save to your ByteBox to {type === 'video' ? 'watch' : 'listen to'} the full{' '}
          {type}.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            to="/register"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
          >
            <UserPlus size={16} />
            Sign Up Free
          </Link>
          <Link
            to={`/login?redirect=/s/${code}`}
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-sm font-semibold transition-colors border border-white/20"
          >
            <LogIn size={16} />
            Login &amp; Save
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- Folder Browser ---------- */

function FolderBrowser({
  code,
  password,
  isDark,
}: {
  code: string;
  password?: string;
  isDark: boolean;
}) {
  const [items, setItems] = useState<ShareFolderItem[]>([]);
  const [path, setPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const pathParts = path ? path.split('/') : [];

  useEffect(() => {
    setLoading(true);
    setError('');
    getShareFolderContents(code, path || undefined, password)
      .then(setItems)
      .catch(() => setError('Failed to load folder contents.'))
      .finally(() => setLoading(false));
  }, [code, path, password]);

  return (
    <div
      className={`rounded-2xl border overflow-hidden ${
        isDark ? 'bg-slate-800/50 border-slate-700' : 'bg-white border-slate-200'
      }`}
    >
      {/* Breadcrumb */}
      <div
        className={`flex items-center gap-1 px-4 py-3 border-b text-sm ${
          isDark ? 'border-slate-700 text-slate-300' : 'border-slate-200 text-slate-600'
        }`}
      >
        <button
          onClick={() => setPath('')}
          className="hover:text-blue-500 transition-colors font-medium"
        >
          Root
        </button>
        {pathParts.map((part, i) => (
          <span key={i} className="flex items-center gap-1">
            <ChevronRight size={14} className="text-slate-500" />
            <button
              onClick={() => setPath(pathParts.slice(0, i + 1).join('/'))}
              className="hover:text-blue-500 transition-colors"
            >
              {part}
            </button>
          </span>
        ))}
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <p className="text-red-500 text-sm text-center py-8">{error}</p>
      )}

      {!loading && !error && items.length === 0 && (
        <p
          className={`text-sm text-center py-8 ${
            isDark ? 'text-slate-500' : 'text-slate-400'
          }`}
        >
          This folder is empty.
        </p>
      )}

      {!loading &&
        !error &&
        items.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              if (item.is_folder) {
                setPath(item.path);
              } else {
                // Download individual file
                getShareDownload(code, password)
                  .then((url) => {
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = item.name;
                    a.target = '_blank';
                    a.click();
                  })
                  .catch(() => {});
              }
            }}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b last:border-b-0 ${
              isDark
                ? 'border-slate-700/50 hover:bg-slate-700/50 text-slate-200'
                : 'border-slate-100 hover:bg-slate-50 text-slate-700'
            }`}
          >
            {item.is_folder ? (
              <Folder size={20} className="text-blue-500 shrink-0" />
            ) : (
              <FileIcon mimeType={item.mime_type} size={20} />
            )}
            <span className="flex-1 truncate text-sm font-medium">
              {item.name}
            </span>
            {!item.is_folder && (
              <span
                className={`text-xs shrink-0 ${
                  isDark ? 'text-slate-500' : 'text-slate-400'
                }`}
              >
                {formatBytes(item.size)}
              </span>
            )}
            {item.is_folder && (
              <ChevronRight
                size={16}
                className={isDark ? 'text-slate-600' : 'text-slate-400'}
              />
            )}
          </button>
        ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ShareView Page                                               */
/* ------------------------------------------------------------------ */

export default function ShareView() {
  const { code } = useParams<{ code: string }>();
  const { isDark } = useTheme();

  // State
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null);
  const [preview, setPreview] = useState<SharePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Password
  const [needsPassword, setNeedsPassword] = useState(false);
  const [password, setPassword] = useState<string | undefined>();
  const [passwordError, setPasswordError] = useState('');

  // Preview timer
  const [previewEnded, setPreviewEnded] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStartedRef = useRef(false);

  // Media controls
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [videoSpeed, setVideoSpeed] = useState(1);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);

  // Image zoom
  const [zoom, setZoom] = useState(1);

  // Mobile banner
  const [showBanner, setShowBanner] = useState(isMobile());

  // Download state
  const [downloading, setDownloading] = useState(false);

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState('');

  /* ---------- Load share info ---------- */

  const loadShare = useCallback(
    async (pw?: string) => {
      if (!code) return;
      setLoading(true);
      setError('');
      setPasswordError('');

      try {
        const info = await getShareInfo(code, pw);
        setShareInfo(info);
        setNeedsPassword(false);

        // Get preview
        try {
          const prev = await getSharePreview(code, pw);
          setPreview(prev);
          if (prev.preview_duration_seconds > 0) {
            setTimeRemaining(prev.preview_duration_seconds);
          }
        } catch {
          // Preview may not be available
        }
      } catch (err: any) {
        if (err?.response?.status === 401 || err?.response?.status === 403) {
          setNeedsPassword(true);
          if (pw) setPasswordError('Incorrect password. Please try again.');
        } else if (err?.response?.status === 404) {
          setError('This share link is invalid or has expired.');
        } else {
          setError('Failed to load shared content. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    },
    [code],
  );

  useEffect(() => {
    loadShare();
  }, [loadShare]);

  /* ---------- Preview timer ---------- */

  const startPreviewTimer = useCallback(() => {
    if (
      mediaStartedRef.current ||
      !preview ||
      preview.preview_duration_seconds <= 0
    )
      return;
    mediaStartedRef.current = true;

    let remaining = preview.preview_duration_seconds;
    setTimeRemaining(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setTimeRemaining(remaining);

      if (remaining <= 0) {
        if (timerRef.current) clearInterval(timerRef.current);
        setPreviewEnded(true);
        // Pause media
        videoRef.current?.pause();
        audioRef.current?.pause();
      }
    }, 1000);
  }, [preview]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  /* ---------- Actions ---------- */

  async function handleDownload() {
    if (!code) return;
    setDownloading(true);
    try {
      const url = await getShareDownload(code, password);
      const a = document.createElement('a');
      a.href = url;
      a.download = shareInfo?.file_name || 'download';
      a.target = '_blank';
      a.click();
    } catch {
      setError('Download failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  async function handleSave() {
    if (!code) return;
    const token = localStorage.getItem('access_token');
    if (!token) {
      window.location.href = `/login?redirect=/s/${code}`;
      return;
    }
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      await saveToStorage(code, undefined, password);
      setSaveSuccess(true);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function handlePasswordSubmit(pw: string) {
    setPassword(pw);
    loadShare(pw);
  }

  /* ---------- Derive file category ---------- */

  const category = shareInfo ? getFileCategory(shareInfo.mime_type) : 'other';

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div
        className={`min-h-screen flex items-center justify-center ${
          isDark ? 'bg-slate-900' : 'bg-slate-50'
        }`}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Loading shared content...
          </p>
        </div>
      </div>
    );
  }

  if (error && !shareInfo) {
    return (
      <div
        className={`min-h-screen flex flex-col ${
          isDark ? 'bg-slate-900' : 'bg-slate-50'
        }`}
      >
        {/* Header */}
        <header
          className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b ${
            isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
          }`}
        >
          <Logo isDark={isDark} />
          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
                isDark
                  ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              Sign Up Free
            </Link>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center px-4">
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-5">
            <X size={32} className="text-red-500" />
          </div>
          <h2
            className={`text-xl font-bold mb-2 ${
              isDark ? 'text-white' : 'text-slate-900'
            }`}
          >
            Link Not Found
          </h2>
          <p
            className={`text-sm text-center max-w-md ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            {error}
          </p>
          <Link
            to="/"
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <ArrowLeft size={16} />
            Go to ByteBox
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen flex flex-col ${
        isDark ? 'bg-slate-900' : 'bg-slate-50'
      }`}
    >
      {/* Mobile Smart Banner */}
      {showBanner && code && (
        <SmartBanner code={code} onClose={() => setShowBanner(false)} />
      )}

      {/* Header */}
      <header
        className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/80'
        } backdrop-blur-sm sticky top-0 z-40 ${showBanner ? 'mt-14' : ''}`}
      >
        <Logo isDark={isDark} />
        <div className="flex items-center gap-2">
          <Link
            to="/login"
            className={`px-4 py-2 text-sm font-medium rounded-xl transition-colors ${
              isDark
                ? 'text-slate-300 hover:text-white hover:bg-slate-800'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Login
          </Link>
          <Link
            to="/register"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Sign Up Free
          </Link>
        </div>
      </header>

      {/* Password Gate */}
      {needsPassword && (
        <PasswordGate
          isDark={isDark}
          onSubmit={handlePasswordSubmit}
          error={passwordError}
        />
      )}

      {/* Main Content */}
      {shareInfo && !needsPassword && (
        <main className="flex-1 w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fadeIn">
          {/* File Info Section */}
          <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 ${
                isDark ? 'bg-slate-800' : 'bg-slate-100'
              }`}
            >
              {shareInfo.thumbnail_url ? (
                <img
                  src={shareInfo.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover rounded-2xl"
                />
              ) : (
                <FileIcon mimeType={shareInfo.mime_type} size={32} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className={`text-xl sm:text-2xl font-bold truncate ${
                  isDark ? 'text-white' : 'text-slate-900'
                }`}
              >
                {shareInfo.file_name}
              </h1>
              <div
                className={`flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm ${
                  isDark ? 'text-slate-400' : 'text-slate-500'
                }`}
              >
                <span>{formatBytes(shareInfo.file_size)}</span>
                <span className="flex items-center gap-1">
                  <Eye size={14} />
                  Shared via ByteBox
                </span>
                {shareInfo.expires_at && (
                  <span>
                    Expires{' '}
                    {new Date(shareInfo.expires_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Preview Area */}
          <div
            className={`relative rounded-2xl overflow-hidden mb-6 ${
              isDark
                ? 'bg-slate-800 border border-slate-700'
                : 'bg-white border border-slate-200 shadow-sm'
            }`}
          >
            {/* ---------- Folder View ---------- */}
            {shareInfo.is_folder && code && (
              <div className="p-4">
                <FolderBrowser
                  code={code}
                  password={password}
                  isDark={isDark}
                />
              </div>
            )}

            {/* ---------- Video Preview ---------- */}
            {category === 'video' && preview && (
              <div className="relative">
                {/* Preview Timer Badge */}
                {timeRemaining !== null && !previewEnded && (
                  <div className="absolute top-4 right-4 z-10 px-3 py-1.5 bg-black/70 backdrop-blur-sm rounded-full text-xs text-white font-medium flex items-center gap-1.5">
                    <Eye size={12} />
                    Preview: {formatTime(timeRemaining)} remaining
                  </div>
                )}

                <video
                  ref={videoRef}
                  src={preview.hls_url || preview.url}
                  poster={preview.video_thumbnail_url || preview.thumbnail_url}
                  muted={isMuted}
                  playsInline
                  className="w-full max-h-[70vh] bg-black"
                  onPlay={() => {
                    setIsPlaying(true);
                    startPreviewTimer();
                  }}
                  onPause={() => setIsPlaying(false)}
                  onLoadedData={() => {
                    // Auto-play muted
                    videoRef.current?.play().catch(() => {});
                  }}
                />

                {/* Video Controls Bar */}
                {!previewEnded && (
                  <div
                    className={`flex items-center gap-2 px-4 py-3 border-t ${
                      isDark ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => {
                        if (videoRef.current) {
                          isPlaying
                            ? videoRef.current.pause()
                            : videoRef.current.play();
                        }
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark
                          ? 'hover:bg-slate-700 text-slate-300'
                          : 'hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isPlaying ? <Pause size={18} /> : <Play size={18} />}
                    </button>
                    <button
                      onClick={() => {
                        setIsMuted(!isMuted);
                        if (videoRef.current)
                          videoRef.current.muted = !isMuted;
                      }}
                      className={`p-2 rounded-lg transition-colors ${
                        isDark
                          ? 'hover:bg-slate-700 text-slate-300'
                          : 'hover:bg-slate-200 text-slate-600'
                      }`}
                    >
                      {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                    </button>

                    <div className="flex-1" />

                    {/* Speed Controls */}
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-xs mr-1 ${
                          isDark ? 'text-slate-500' : 'text-slate-400'
                        }`}
                      >
                        Speed:
                      </span>
                      {[0.5, 1, 1.5, 2].map((speed) => (
                        <button
                          key={speed}
                          onClick={() => {
                            setVideoSpeed(speed);
                            if (videoRef.current)
                              videoRef.current.playbackRate = speed;
                          }}
                          className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                            videoSpeed === speed
                              ? 'bg-blue-600 text-white'
                              : isDark
                                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {speed}x
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Preview Ended Overlay */}
                {previewEnded && code && (
                  <PreviewOverlay type="video" code={code} />
                )}
              </div>
            )}

            {/* ---------- Image Preview ---------- */}
            {category === 'image' && preview && (
              <div className="relative">
                <div className="flex items-center justify-center p-4 min-h-[300px] max-h-[70vh] overflow-auto">
                  <img
                    src={preview.url}
                    alt={shareInfo.file_name}
                    className="max-w-full max-h-full object-contain rounded-lg transition-transform"
                    style={{ transform: `scale(${zoom})` }}
                  />
                </div>
                {/* Zoom controls */}
                <div
                  className={`flex items-center justify-center gap-2 px-4 py-3 border-t ${
                    isDark ? 'border-slate-700' : 'border-slate-200'
                  }`}
                >
                  <button
                    onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-slate-700 text-slate-300'
                        : 'hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <ZoomOut size={18} />
                  </button>
                  <span
                    className={`text-xs w-14 text-center ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-slate-700 text-slate-300'
                        : 'hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <ZoomIn size={18} />
                  </button>
                  <button
                    onClick={() => setZoom(1)}
                    className={`p-2 rounded-lg transition-colors ${
                      isDark
                        ? 'hover:bg-slate-700 text-slate-300'
                        : 'hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    <RotateCw size={18} />
                  </button>
                </div>
              </div>
            )}

            {/* ---------- Audio Preview ---------- */}
            {category === 'audio' && preview && (
              <div className="relative p-8">
                <div className="flex flex-col items-center">
                  <div
                    className={`w-24 h-24 rounded-2xl flex items-center justify-center mb-6 ${
                      isDark ? 'bg-slate-700' : 'bg-slate-100'
                    }`}
                  >
                    <FileIcon mimeType={shareInfo.mime_type} size={48} />
                  </div>
                  <p
                    className={`text-lg font-semibold mb-1 ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {shareInfo.file_name}
                  </p>
                  <p
                    className={`text-sm mb-6 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {formatBytes(shareInfo.file_size)}
                  </p>

                  {/* Timer badge */}
                  {timeRemaining !== null && !previewEnded && (
                    <div className="mb-4 px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded-full text-xs text-blue-400 font-medium flex items-center gap-1.5">
                      <Eye size={12} />
                      Preview: {formatTime(timeRemaining)} remaining
                    </div>
                  )}

                  <audio
                    ref={audioRef}
                    src={preview.url}
                    controls
                    className="w-full max-w-md"
                    onPlay={() => {
                      setIsPlaying(true);
                      startPreviewTimer();
                    }}
                    onPause={() => setIsPlaying(false)}
                  >
                    Your browser does not support audio playback.
                  </audio>
                </div>

                {previewEnded && code && (
                  <PreviewOverlay type="audio" code={code} />
                )}
              </div>
            )}

            {/* ---------- PDF / Doc ---------- */}
            {(category === 'pdf' || category === 'other') &&
              !shareInfo.is_folder && (
                <div className="flex flex-col items-center py-12 px-6">
                  <div
                    className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-5 ${
                      isDark ? 'bg-slate-700' : 'bg-slate-100'
                    }`}
                  >
                    <FileIcon mimeType={shareInfo.mime_type} size={40} />
                  </div>
                  <p
                    className={`text-lg font-semibold mb-1 ${
                      isDark ? 'text-white' : 'text-slate-900'
                    }`}
                  >
                    {shareInfo.file_name}
                  </p>
                  <p
                    className={`text-sm mb-1 ${
                      isDark ? 'text-slate-400' : 'text-slate-500'
                    }`}
                  >
                    {formatBytes(shareInfo.file_size)}
                  </p>
                  <p
                    className={`text-sm mb-6 ${
                      isDark ? 'text-slate-500' : 'text-slate-400'
                    }`}
                  >
                    Download to view this file
                  </p>
                  <button
                    onClick={handleDownload}
                    disabled={downloading}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    <Download size={16} />
                    {downloading ? 'Preparing...' : 'Download File'}
                  </button>
                </div>
              )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-8">
            {/* Download */}
            {!shareInfo.is_folder && (
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm"
              >
                <Download size={16} />
                {downloading ? 'Preparing...' : 'Download'}
              </button>
            )}

            {/* Save to My Storage */}
            <button
              onClick={handleSave}
              disabled={saving}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm border ${
                saveSuccess
                  ? 'bg-green-600 border-green-600 text-white'
                  : isDark
                    ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
              }`}
            >
              <Save size={16} />
              {saving
                ? 'Saving...'
                : saveSuccess
                  ? 'Saved!'
                  : 'Save to My Storage'}
            </button>

            {/* Open in App (mobile) */}
            {isMobile() && code && (
              <a
                href={`bytebox://share/${code}`}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-sm border ${
                  isDark
                    ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <Smartphone size={16} />
                Open in App
              </a>
            )}
          </div>

          {/* Save error */}
          {saveError && (
            <p className="text-red-500 text-sm mb-4">{saveError}</p>
          )}

          {/* Error message */}
          {error && (
            <p className="text-red-500 text-sm mb-4">{error}</p>
          )}

          {/* Sign up CTA card */}
          <div
            className={`rounded-2xl p-6 border mb-8 ${
              isDark
                ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-800/50'
                : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1">
                <h3
                  className={`font-bold text-lg ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Want to store and share your own files?
                </h3>
                <p
                  className={`text-sm mt-1 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Sign up for ByteBox and get free cloud storage with sharing,
                  streaming, and more.
                </p>
              </div>
              <Link
                to="/register"
                className="shrink-0 inline-flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <UserPlus size={16} />
                Sign Up Free
              </Link>
            </div>
          </div>
        </main>
      )}

      {/* Footer */}
      <footer
        className={`shrink-0 border-t px-4 sm:px-6 py-6 mt-auto ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <p
            className={`text-sm ${
              isDark ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            Powered by{' '}
            <a
              href="https://byteboxapp.com"
              className="text-blue-500 hover:text-blue-600 font-medium transition-colors"
            >
              ByteBox
            </a>
          </p>
          <div className="flex items-center gap-4">
            <Link
              to="/privacy"
              className={`text-sm transition-colors ${
                isDark
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className={`text-sm transition-colors ${
                isDark
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Terms
            </Link>
          </div>
        </div>
      </footer>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
      `}</style>
    </div>
  );
}
