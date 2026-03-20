import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Home,
  Star,
  Trash2,
  Settings,
  LogOut,
  Compass,
  Upload,
  Search,
  X,
  ChevronRight,
  Moon,
  Sun,
  Image,
  FileText,
  Video,
  Music,
  MoreHorizontal,
  Share2,
  Crown,
  User,
  ChevronDown,
  Download,
  HelpCircle,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { formatBytes } from '../api/files';
import { UploadModal } from './UploadModal';
import { NotificationBell } from './NotificationBell';
import { useTheme } from '../hooks/useTheme';
import { CommandPalette } from './CommandPalette';

interface LayoutProps {
  children: React.ReactNode;
  onRefresh?: () => void;
  currentFolderId?: string;
}

export function Layout({ children, onRefresh, currentFolderId }: LayoutProps) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { isDark, toggle: toggleTheme } = useTheme();
  const [showUpload, setShowUpload] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('bytebox_sidebar') === 'collapsed'; } catch { return false; }
  });
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    try { return user?.avatar_url || localStorage.getItem('bytebox_avatar'); } catch { return null; }
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOffline = () => setIsOffline(true);
    const handleOnline = () => setIsOffline(false);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Re-check avatar when navigating (picks up changes from Settings page)
  useEffect(() => {
    const stored = user?.avatar_url || (() => { try { return localStorage.getItem('bytebox_avatar'); } catch { return null; } })();
    if (stored !== avatarUrl) setAvatarUrl(stored);
  });

  useEffect(() => {
    setSearchQuery('');
  }, [location.pathname]);

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem('bytebox_sidebar', next ? 'collapsed' : 'open'); } catch {}
      return next;
    });
  }

  function clearSearch() {
    setSearchQuery('');
    searchRef.current?.focus();
  }

  const storageUsed = user?.storage_used ?? 0;
  const storageLimit = user?.storage_limit ?? 1073741824;
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  const mainNav = [
    { to: '/', label: 'All Files', icon: Home },
  ];

  const categoryNav = [
    { to: '/?category=image', label: 'Pictures', icon: Image },
    { to: '/?category=document', label: 'Documents', icon: FileText },
    { to: '/?category=video', label: 'Videos', icon: Video },
    { to: '/?category=audio', label: 'Music', icon: Music },
    { to: '/?category=other', label: 'Other', icon: MoreHorizontal },
  ];

  const bottomNav = [
    { to: '/explore', label: 'Explore', icon: Compass },
    { to: '/shares', label: 'My Shares', icon: Share2 },
    { to: '/downloads', label: 'Downloads', icon: Download },
    { to: '/favorites', label: 'Starred', icon: Star },
    { to: '/trash', label: 'Recycle Bin', icon: Trash2 },
  ];

  function isActive(to: string) {
    if (to === '/') {
      return (location.pathname === '/' || location.pathname === '/files' || location.pathname.startsWith('/folder')) && !location.search.includes('category');
    }
    if (to.includes('category=')) {
      return location.search.includes(to.split('?')[1]);
    }
    return location.pathname === to;
  }

  const planLabel = user?.plan === 'premium' ? 'Premium' : user?.plan === 'pro' ? 'Pro' : 'Free';
  const planColor = user?.plan === 'premium' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : user?.plan === 'pro' ? 'bg-violet-500' : 'bg-slate-400';

  const renderSidebar = (mobile = false) => {
    return (
      <aside
        className="bg-white dark:bg-[#111827] border-r border-gray-200/60 dark:border-white/[0.05] flex flex-col h-full w-64"
      >
        {/* Logo */}
        <div className="px-5 py-4 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-3 group"
            onClick={() => setSidebarOpen(false)}
          >
            <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-blue-500 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/25 dark:shadow-[0_0_20px_rgba(139,92,246,0.4)] shrink-0 group-hover:scale-105 transition-transform">
              <Box size={20} className="text-white" fill="rgba(255,255,255,0.2)" />
            </div>
            <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">ByteBox</span>
          </Link>
          {!mobile && (
            <button onClick={toggleSidebar} className="p-1.5 rounded-lg text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors" title="Collapse sidebar">
              <PanelLeftClose size={18} />
            </button>
          )}
        </div>

        {/* Main navigation */}
        <nav className="flex-1 py-3 overflow-y-auto px-3 scrollbar-thin">
          {/* All Files */}
          {mainNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 mb-1 px-3 py-2.5 ${
                isActive(to)
                  ? 'bg-violet-50 dark:bg-gradient-to-r dark:from-purple-500/10 dark:to-blue-500/10 dark:shadow-[inset_3px_0_0_rgba(139,92,246,0.8)] text-violet-700 dark:text-purple-400 border-l-[3px] border-violet-500 dark:border-transparent -ml-px'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-gray-100/70 dark:hover:bg-white/[0.05] hover:translate-x-0.5'
              }`}
            >
              <Icon size={20} className="shrink-0" />
              {label}
            </Link>
          ))}

          {/* Category section label */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mt-4 mb-1.5">Categories</p>

          {/* Category filters */}
          <div className="space-y-0.5">
            {categoryNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 px-3 py-2.5 ${
                  isActive(to)
                    ? 'bg-violet-50 dark:bg-gradient-to-r dark:from-purple-500/10 dark:to-blue-500/10 dark:shadow-[inset_3px_0_0_rgba(139,92,246,0.8)] text-violet-600 dark:text-purple-400 border-l-[3px] border-violet-500 dark:border-transparent -ml-px'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100/70 dark:hover:bg-white/[0.05] hover:translate-x-0.5'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                {label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3 mx-3 border-t border-gray-100 dark:border-white/[0.05]" />

          {/* Library section label */}
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-3 mb-1.5">Library</p>

          {/* Explore, Starred, Recycle Bin */}
          <div className="space-y-0.5">
            {bottomNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-200 px-3 py-2.5 ${
                  isActive(to)
                    ? 'bg-violet-50 dark:bg-gradient-to-r dark:from-purple-500/10 dark:to-blue-500/10 dark:shadow-[inset_3px_0_0_rgba(139,92,246,0.8)] text-violet-600 dark:text-purple-400 border-l-[3px] border-violet-500 dark:border-transparent -ml-px'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-gray-100/70 dark:hover:bg-white/[0.05] hover:translate-x-0.5'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                {label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Storage bar */}
        <div className="px-4 pb-4 pt-2">
          <div className="bg-gradient-to-br from-violet-50/80 to-blue-50/80 dark:from-violet-500/[0.06] dark:to-blue-500/[0.06] border border-violet-100/50 dark:border-violet-500/10 rounded-xl p-3">
            <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400 mb-2 font-medium">
              <span>{formatBytes(storageUsed)} / {formatBytes(storageLimit)}</span>
              <span>{storagePercent}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-white/[0.1] rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all dark:shadow-[0_0_10px_rgba(123,97,255,0.3)] ${
                  storagePercent > 90 ? 'bg-red-500' : 'storage-gradient'
                }`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            {(!user?.plan || user.plan === 'free') ? (
              <button
                onClick={() => navigate('/settings')}
                className="mt-2.5 w-full py-2 text-xs font-semibold text-white rounded-lg upgrade-cta dark:shadow-[0_0_15px_rgba(123,97,255,0.2)]"
              >
                Upgrade Plan
              </button>
            ) : (
              <button
                onClick={() => navigate('/settings')}
                className="mt-2.5 text-xs text-violet-500 hover:text-violet-600 font-medium hover:underline"
              >
                Manage Plan
              </button>
            )}
          </div>
        </div>
      </aside>
    );
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#f8f9fb] dark:bg-[#0B0F19]">
      {isOffline && (
        <div className="bg-red-600 text-white text-center text-sm py-2 px-4 font-medium shrink-0">
          You are offline. Some features may not work.
        </div>
      )}
      <div className="flex flex-1 min-h-0">
      {/* Desktop sidebar */}
      <div className={`hidden lg:flex lg:flex-col lg:shrink-0 transition-all duration-300 ${sidebarCollapsed ? 'w-0 overflow-hidden' : 'w-64'}`}>
        {renderSidebar(false)}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 h-full flex flex-col animate-slide-in-right">
            {renderSidebar(true)}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar - Glassmorphism */}
        <header className="glass-header sticky top-0 z-30 px-4 lg:px-6 py-3 flex items-center gap-4 shrink-0">
          {/* Mobile sidebar trigger */}
          <button
            className="lg:hidden p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Box size={20} />
          </button>

          {/* Desktop sidebar expand button (when collapsed) */}
          {sidebarCollapsed && (
            <button
              className="hidden lg:flex p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
              onClick={toggleSidebar}
              title="Open sidebar"
            >
              <PanelLeftOpen size={20} />
            </button>
          )}

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl mx-auto">
            <div className="relative group">
              <Search
                size={16}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-500 pointer-events-none transition-colors"
              />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files, folders..."
                className="w-full pl-11 pr-10 py-2.5 bg-gray-50 dark:bg-white/[0.03] dark:shadow-inner border border-gray-200 dark:border-white/[0.05] focus:border-violet-400 focus:bg-white dark:focus:bg-[#111118] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-200 shadow-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          <div className="flex items-center gap-1.5">
            <NotificationBell />

            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Upload button */}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-semibold transition-all shadow-md shadow-violet-500/25 dark:shadow-[0_0_25px_rgba(139,92,246,0.3)] shrink-0"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* Profile avatar */}
            <div className="relative ml-0.5" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="relative p-1 rounded-full hover:bg-gray-100 dark:hover:bg-white/[0.05] hover:scale-105 transition-all"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="" className="w-9 h-9 rounded-full object-cover shadow-sm" />
                ) : (
                  <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-blue-500 rounded-full flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                )}
                <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-white dark:border-[#111827] dark:shadow-[0_0_6px_rgba(34,197,94,0.6)]" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-[#0F172A] rounded-xl shadow-xl shadow-black/[0.08] dark:shadow-black/40 border border-gray-200 dark:border-white/[0.05] z-[100] overflow-hidden animate-slide-down">
                  {/* User info */}
                  <div className="p-4 border-b border-gray-100 dark:border-white/[0.05]">
                    <div className="flex items-center gap-3">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-violet-500 to-blue-500 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0">
                          {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{user?.display_name}</p>
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold text-white rounded ${planColor}`}>
                            {planLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                      </div>
                    </div>
                  </div>

                  {/* Premium upsell for free users */}
                  {(!user?.plan || user.plan === 'free') && (
                    <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05] bg-gradient-to-r from-violet-50 to-blue-50 dark:from-purple-900/30 dark:to-blue-900/30">
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">Enjoy over 10 benefits with Premium</p>
                      <div className="flex justify-center gap-6 mb-2">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 bg-violet-100 dark:bg-white/[0.06] rounded-full flex items-center justify-center mb-1">
                            <Box size={16} className="text-violet-500" />
                          </div>
                          <span className="text-[10px] text-slate-500">More storage</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-1">
                            <Upload size={16} className="text-green-500" />
                          </div>
                          <span className="text-[10px] text-slate-500">Fast download</span>
                        </div>
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-1">
                            <Crown size={16} className="text-purple-500" />
                          </div>
                          <span className="text-[10px] text-slate-500">More</span>
                        </div>
                      </div>
                      <button className="w-full py-2 text-white rounded-lg text-sm font-medium upgrade-cta">
                        Premium
                      </button>
                    </div>
                  )}

                  {/* Storage bar */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-white/[0.05]">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                      <span>Storage: {formatBytes(storageUsed)} / {formatBytes(storageLimit)}</span>
                      <span>{storagePercent}%</span>
                    </div>
                    <div className="w-full bg-slate-200 dark:bg-white/[0.1] rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          storagePercent > 90 ? 'bg-red-500' : 'storage-gradient'
                        }`}
                        style={{ width: `${Math.max(storagePercent, 1)}%` }}
                      />
                    </div>
                  </div>

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/user-center"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <User size={16} className="text-slate-400" />
                      Personal Center
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <Settings size={16} className="text-slate-400" />
                      Settings
                    </Link>
                    <Link
                      to="/help"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                    >
                      <HelpCircle size={16} className="text-slate-400" />
                      Help & Feedback
                    </Link>
                    <div className="my-1 border-t border-gray-100 dark:border-white/[0.05]" />
                    <Link
                      to="/settings#delete"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 size={16} />
                      Delete Account
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-gray-100 dark:border-white/[0.05] py-1">
                    <button
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors w-full"
                    >
                      <LogOut size={16} className="text-slate-400" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto bg-[#f8f9fb] dark:bg-[#0B0F19]">
          {children}
        </main>
      </div>

      {showUpload && (
        <UploadModal
          folderId={currentFolderId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => {
            setShowUpload(false);
            onRefresh?.();
          }}
        />
      )}

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onUpload={() => setShowUpload(true)}
        toggleTheme={toggleTheme}
      />
      </div>
    </div>
  );
}

export function Breadcrumb({
  crumbs,
}: {
  crumbs: { label: string; to?: string; id?: string }[];
}) {
  return (
    <nav className="flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight size={14} className="text-slate-300 dark:text-slate-600" />}
          {crumb.to ? (
            <Link
              to={crumb.to}
              className="hover:text-violet-600 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-2xl font-bold text-slate-800 dark:text-slate-200 tracking-tight">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
