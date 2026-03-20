import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Lock,
  Eye,
  LogIn,
  UserPlus,
  Folder,
  ChevronRight,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Smartphone,
  X,
  Save,
  ArrowLeft,
  ExternalLink,
  Clock,
  Users,
  Download,
  CheckCircle,
} from 'lucide-react';
import { FileIcon } from '../components/FileIcon';
import { formatBytes } from '../api/files';
import { useTheme } from '../hooks/useTheme';
import { HeaderAd, SidebarAd } from '../components/AdBanner';
import type {
  ShareInfo,
  SharePreview,
  ShareFolderItem,
} from '../api/share';
import {
  getShareInfo,
  getSharePreview,
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

function isIOS(): boolean {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function isLoggedIn(): boolean {
  return !!localStorage.getItem('access_token');
}

function getDeepLink(code: string): string {
  return `bytebox://share/${code}`;
}

function getStoreLink(): string {
  return isIOS()
    ? 'https://apps.apple.com/app/bytebox/id000000000'
    : 'https://play.google.com/store/apps/details?id=com.byteboxapp';
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

/* ---------- Sticky Bottom App Banner (mobile) ---------- */

function StickyBottomBanner({ code }: { code: string }) {
  const deepLink = getDeepLink(code);
  const storeLink = getStoreLink();

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 bg-gradient-to-t from-slate-900 to-slate-800 border-t border-slate-700 px-4 py-3 animate-slideUp safe-bottom">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
          <span className="text-white font-bold text-sm">B</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-white">Watch full video in ByteBox</p>
          <p className="text-xs text-slate-400">Free - 10GB Storage</p>
        </div>
        <a
          href={deepLink}
          className="shrink-0 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-full transition-colors shadow-lg shadow-blue-600/30"
          onClick={() => {
            setTimeout(() => {
              window.location.href = storeLink;
            }, 1500);
          }}
        >
          Open App
        </a>
      </div>
    </div>
  );
}

/* ---------- Top Smart Banner (mobile) ---------- */

function SmartBanner({
  code,
  onClose,
}: {
  code: string;
  onClose: () => void;
}) {
  const deepLink = getDeepLink(code);
  const storeLink = getStoreLink();

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
        <p className="text-sm font-semibold text-white truncate">ByteBox</p>
        <p className="text-xs text-slate-400">Get the ByteBox App</p>
      </div>
      <a
        href={deepLink}
        className="shrink-0 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-full transition-colors"
        onClick={() => {
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

/* ---------- Mandatory Preview Overlay ---------- */

function MandatoryPreviewOverlay({
  type,
  code,
  loggedIn,
}: {
  type: 'video' | 'audio';
  code: string;
  loggedIn: boolean;
}) {
  const deepLink = getDeepLink(code);
  const storeLink = getStoreLink();

  return (
    <div className="absolute inset-0 z-20 bg-black/90 backdrop-blur-md flex items-center justify-center animate-fadeIn">
      <div className="text-center px-6 max-w-md">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-600/30">
          <Eye size={36} className="text-white" />
        </div>
        <h3 className="text-2xl font-bold text-white mb-3">
          Preview Ended
        </h3>
        <p className="text-slate-300 text-sm mb-8 leading-relaxed">
          Save to your ByteBox to {type === 'video' ? 'watch' : 'listen to'} the full{' '}
          {type}. It's free!
        </p>

        {/* Primary: Open in App */}
        <a
          href={deepLink}
          onClick={() => {
            setTimeout(() => {
              window.location.href = storeLink;
            }, 1500);
          }}
          className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-base font-bold transition-colors mb-3 shadow-lg shadow-blue-600/30"
        >
          <Smartphone size={20} />
          Open in ByteBox App
        </a>

        {/* Secondary: Download App */}
        <a
          href={storeLink}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-sm font-semibold transition-colors border border-white/20 mb-4"
        >
          <Download size={16} />
          Download ByteBox App
        </a>

        {/* Small text: Continue in Browser */}
        <Link
          to={`/login?redirect=/s/${code}`}
          className="text-slate-400 hover:text-slate-300 text-xs underline underline-offset-2 transition-colors"
        >
          Continue in browser (login required)
        </Link>
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
          <div
            key={i}
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b last:border-b-0 ${
              isDark
                ? 'border-slate-700/50 text-slate-200'
                : 'border-slate-100 text-slate-700'
            } ${item.is_folder ? (isDark ? 'hover:bg-slate-700/50 cursor-pointer' : 'hover:bg-slate-50 cursor-pointer') : ''}`}
            onClick={() => {
              if (item.is_folder) {
                setPath(item.path);
              }
              // Non-folder items: no download for unauthenticated users
            }}
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
          </div>
        ))}
    </div>
  );
}

/* ---------- Expiry Warning ---------- */

function ExpiryWarning({ expiresAt, isDark }: { expiresAt: string; isDark: boolean }) {
  const expiry = new Date(expiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  if (daysLeft > 7) return null;

  return (
    <div
      className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm mb-4 ${
        daysLeft <= 1
          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
      }`}
    >
      <Clock size={16} />
      {daysLeft <= 0
        ? 'This share link expires today!'
        : daysLeft === 1
          ? 'This share link expires tomorrow!'
          : `This share link expires in ${daysLeft} days`}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ShareView Page                                               */
/* ------------------------------------------------------------------ */

export default function ShareView() {
  const { code } = useParams<{ code: string }>();
  const { isDark } = useTheme();
  const loggedIn = isLoggedIn();

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

  // Image zoom (only for logged in)
  const [zoom, setZoom] = useState(1);

  // Mobile banner
  const [showBanner] = useState(isMobile());

  // Video ad countdown
  const [videoAdCountdown, setVideoAdCountdown] = useState<number | null>(null);

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

  /* ---------- Enforce seek limits on video ---------- */

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !preview || preview.preview_duration_seconds <= 0) return;

    const maxTime = preview.preview_duration_seconds;

    const handleSeeking = () => {
      if (video.currentTime > maxTime) {
        video.currentTime = maxTime;
        if (!previewEnded) {
          setPreviewEnded(true);
          video.pause();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }
    };

    const handleTimeUpdate = () => {
      if (video.currentTime >= maxTime && !previewEnded) {
        video.pause();
        video.currentTime = maxTime;
        setPreviewEnded(true);
        if (timerRef.current) clearInterval(timerRef.current);
      }
    };

    video.addEventListener('seeking', handleSeeking);
    video.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      video.removeEventListener('seeking', handleSeeking);
      video.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [preview, previewEnded]);

  /* ---------- Actions ---------- */

  async function handleSave() {
    if (!code) return;
    if (!loggedIn) {
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
      } ${isMobile() ? 'pb-20' : ''}`}
    >
      {/* Mobile Top Smart Banner */}
      {showBanner && code && (
        <SmartBanner code={code} onClose={() => {}} />
      )}

      {/* Header */}
      <header
        className={`flex items-center justify-between px-4 sm:px-6 py-4 border-b shrink-0 ${
          isDark ? 'border-slate-800 bg-slate-900/80' : 'border-slate-200 bg-white/80'
        } backdrop-blur-sm sticky top-0 z-40 ${showBanner ? 'mt-14' : ''}`}
      >
        <Logo isDark={isDark} />
        <div className="flex items-center gap-2">
          {!loggedIn && (
            <>
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
            </>
          )}
          {loggedIn && (
            <Link
              to="/files"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              My Files
            </Link>
          )}
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

      {/* Top Ad Banner on Share Page */}
      <div className="w-full max-w-3xl mx-auto px-4 mt-4">
        <HeaderAd />
      </div>

      {/* Main Content */}
      {shareInfo && !needsPassword && (
        <main className="flex-1 w-full max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 animate-fadeIn">
          {/* Expiry Warning */}
          {shareInfo.expires_at && (
            <ExpiryWarning expiresAt={shareInfo.expires_at} isDark={isDark} />
          )}

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
                {/* Video Ad Countdown Overlay */}
                {videoAdCountdown !== null && videoAdCountdown > 0 && (
                  <div className="absolute inset-0 z-30 bg-black/90 flex flex-col items-center justify-center animate-fadeIn">
                    <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 w-72 text-center mb-4">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-2">Advertisement</p>
                      <div className="w-full h-40 bg-slate-700 rounded-lg flex items-center justify-center mb-3">
                        <span className="text-slate-500 text-sm">Ad Placeholder</span>
                      </div>
                    </div>
                    <p className="text-white text-sm font-medium">
                      Video will play in {videoAdCountdown}s
                    </p>
                  </div>
                )}

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
                    if (!loggedIn) {
                      // Show ad countdown before autoplay for non-logged-in users
                      videoRef.current?.pause();
                      let count = 5;
                      setVideoAdCountdown(count);
                      const adTimer = setInterval(() => {
                        count -= 1;
                        setVideoAdCountdown(count);
                        if (count <= 0) {
                          clearInterval(adTimer);
                          setVideoAdCountdown(null);
                          videoRef.current?.play().catch(() => {});
                        }
                      }, 1000);
                    } else {
                      videoRef.current?.play().catch(() => {});
                    }
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

                {/* MANDATORY Preview Ended Overlay -- cannot be dismissed */}
                {previewEnded && code && (
                  <MandatoryPreviewOverlay type="video" code={code} loggedIn={loggedIn} />
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
                    className={`max-w-full max-h-full object-contain rounded-lg transition-transform ${
                      !loggedIn ? 'blur-[2px] select-none pointer-events-none' : ''
                    }`}
                    style={loggedIn ? { transform: `scale(${zoom})` } : undefined}
                    draggable={false}
                    onContextMenu={(e) => {
                      if (!loggedIn) e.preventDefault();
                    }}
                  />
                  {/* Watermark overlay for non-logged-in users */}
                  {!loggedIn && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <p className="text-white/30 text-4xl font-bold rotate-[-30deg] select-none">
                        ByteBox Preview
                      </p>
                    </div>
                  )}
                </div>
                {/* Zoom controls -- only for logged in & saved */}
                {loggedIn && saveSuccess && (
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
                      -
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
                      +
                    </button>
                  </div>
                )}
                {/* Save prompt for images (non-saved) */}
                {!saveSuccess && (
                  <div
                    className={`text-center px-4 py-3 border-t ${
                      isDark ? 'border-slate-700' : 'border-slate-200'
                    }`}
                  >
                    <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                      Save to view full quality image
                    </p>
                  </div>
                )}
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
                  <MandatoryPreviewOverlay type="audio" code={code} loggedIn={loggedIn} />
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
                    Save to your storage to access this file
                  </p>
                </div>
              )}
          </div>

          {/* File Info Section */}
          <div className="flex flex-col sm:flex-row items-start gap-4 mb-6">
            <div
              className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 ${
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
                <FileIcon mimeType={shareInfo.mime_type} size={28} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1
                className={`text-lg sm:text-xl font-bold truncate ${
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
                <span>{shareInfo.mime_type.split('/')[1]?.toUpperCase() || 'File'}</span>
                {shareInfo.download_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Users size={13} />
                    {shareInfo.download_count} {shareInfo.download_count === 1 ? 'person has' : 'people have'} saved this file
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Primary CTA: Save to Your ByteBox */}
          <div className="flex flex-col gap-3 mb-6">
            {/* Save button -- PRIMARY */}
            <button
              onClick={handleSave}
              disabled={saving || saveSuccess}
              className={`w-full flex items-center justify-center gap-2.5 px-6 py-4 rounded-2xl text-base font-bold transition-all shadow-sm ${
                saveSuccess
                  ? 'bg-green-600 text-white shadow-green-600/20'
                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20 hover:shadow-blue-600/30'
              } disabled:opacity-80`}
            >
              {saveSuccess ? (
                <>
                  <CheckCircle size={20} />
                  Saved to Your ByteBox!
                </>
              ) : saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Save to Your ByteBox
                </>
              )}
            </button>

            {/* Open in App (outlined) */}
            {code && (
              <a
                href={getDeepLink(code)}
                onClick={() => {
                  setTimeout(() => {
                    window.location.href = getStoreLink();
                  }, 1500);
                }}
                className={`w-full flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-2xl text-sm font-semibold transition-colors border ${
                  isDark
                    ? 'border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500'
                    : 'border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400'
                }`}
              >
                <ExternalLink size={18} />
                Open in ByteBox App
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

          {/* "Don't have ByteBox?" section with app store badges */}
          <div
            className={`rounded-2xl p-6 border mb-6 ${
              isDark
                ? 'bg-slate-800/50 border-slate-700'
                : 'bg-white border-slate-200 shadow-sm'
            }`}
          >
            <h3
              className={`font-bold text-base mb-3 text-center ${
                isDark ? 'text-white' : 'text-slate-900'
              }`}
            >
              Don't have ByteBox?
            </h3>
            <p
              className={`text-sm text-center mb-5 ${
                isDark ? 'text-slate-400' : 'text-slate-500'
              }`}
            >
              Download the app to save files, stream videos, and get 10GB free storage.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://play.google.com/store/apps/details?id=com.byteboxapp"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.53,12.9 20.18,13.18L17.89,14.5L15.39,12L17.89,9.5L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z" />
                </svg>
                Google Play
              </a>
              <a
                href="https://apps.apple.com/app/bytebox/id000000000"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-sm font-semibold transition-colors"
              >
                <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current">
                  <path d="M18.71,19.5C17.88,20.74 17,21.95 15.66,21.97C14.32,22 13.89,21.18 12.37,21.18C10.84,21.18 10.37,21.95 9.1,22C7.79,22.05 6.8,20.68 5.96,19.47C4.25,16.97 2.94,12.45 4.7,9.39C5.57,7.87 7.13,6.91 8.82,6.88C10.1,6.86 11.32,7.75 12.11,7.75C12.89,7.75 14.37,6.68 15.92,6.84C16.57,6.87 18.39,7.1 19.56,8.82C19.47,8.88 17.39,10.1 17.41,12.63C17.44,15.65 20.06,16.66 20.09,16.67C20.06,16.74 19.67,18.11 18.71,19.5M13,3.5C13.73,2.67 14.94,2.04 15.94,2C16.07,3.17 15.6,4.35 14.9,5.19C14.21,6.04 13.07,6.7 11.95,6.61C11.8,5.46 12.36,4.26 13,3.5Z" />
                </svg>
                App Store
              </a>
            </div>
          </div>

          {/* Sign up CTA card (only for non-logged-in) */}
          {!loggedIn && (
            <div
              className={`rounded-2xl p-6 border mb-6 ${
                isDark
                  ? 'bg-gradient-to-r from-blue-900/30 to-indigo-900/30 border-blue-800/50'
                  : 'bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200'
              }`}
            >
              <div className="flex flex-col items-center text-center">
                <h3
                  className={`font-bold text-lg mb-2 ${
                    isDark ? 'text-white' : 'text-slate-900'
                  }`}
                >
                  Save files, watch full videos
                </h3>
                <p
                  className={`text-sm mb-4 ${
                    isDark ? 'text-slate-400' : 'text-slate-500'
                  }`}
                >
                  Create a free ByteBox account to save this file and access it anywhere.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                  <Link
                    to="/register"
                    className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold transition-colors"
                  >
                    <UserPlus size={16} />
                    Sign Up Free
                  </Link>
                  <Link
                    to={`/login?redirect=/s/${code}`}
                    className={`flex-1 inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold transition-colors border ${
                      isDark
                        ? 'border-slate-600 text-slate-300 hover:bg-slate-800'
                        : 'border-slate-300 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <LogIn size={16} />
                    Login
                  </Link>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* Bottom Ad Banner on Share Page */}
      <div className="w-full max-w-3xl mx-auto px-4 mb-4">
        <SidebarAd />
      </div>

      {/* Footer */}
      <footer
        className={`shrink-0 border-t px-4 sm:px-6 py-6 mt-auto ${
          isDark ? 'border-slate-800 bg-slate-900' : 'border-slate-200 bg-white'
        }`}
      >
        <div className="max-w-3xl mx-auto flex flex-col items-center gap-3">
          <p
            className={`text-sm font-medium ${
              isDark ? 'text-slate-400' : 'text-slate-500'
            }`}
          >
            Free &bull; 10GB Storage &bull; Available on Android & iOS
          </p>
          <div className="flex items-center gap-4">
            <p
              className={`text-xs ${
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
            <Link
              to="/privacy"
              className={`text-xs transition-colors ${
                isDark
                  ? 'text-slate-500 hover:text-slate-300'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Privacy
            </Link>
            <Link
              to="/terms"
              className={`text-xs transition-colors ${
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

      {/* Sticky Bottom App Banner (mobile) */}
      {isMobile() && code && (
        <StickyBottomBanner code={code} />
      )}

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
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(100%); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out; }
        .animate-slideDown { animation: slideDown 0.3s ease-out; }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .safe-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}</style>
    </div>
  );
}
