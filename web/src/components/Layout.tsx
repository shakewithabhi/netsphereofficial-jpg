import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HardDrive,
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
  Menu,
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
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { formatBytes } from '../api/files';
import { UploadModal } from './UploadModal';
import { NotificationBell } from './NotificationBell';
import { useTheme } from '../hooks/useTheme';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebar-collapsed') === 'true'; } catch { return false; }
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

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

  function toggleSidebarCollapse() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try { localStorage.setItem('sidebar-collapsed', String(next)); } catch {}
      return next;
    });
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/?search=${encodeURIComponent(searchQuery.trim())}`);
    }
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
  const planColor = user?.plan === 'premium' ? 'bg-gradient-to-r from-amber-500 to-orange-500' : user?.plan === 'pro' ? 'bg-blue-500' : 'bg-slate-400';

  const renderSidebar = (mobile = false) => {
    const collapsed = !mobile && sidebarCollapsed;

    return (
      <aside
        className={`bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col h-full transition-all duration-300 ease-in-out ${
          mobile ? 'w-64' : collapsed ? 'w-16' : 'w-64'
        }`}
      >
        {/* Logo */}
        <div className={`py-4 border-b border-slate-100 dark:border-slate-700 ${collapsed ? 'px-3' : 'px-5'}`}>
          <Link
            to="/"
            className={`flex items-center group ${collapsed ? 'justify-center' : 'gap-3'}`}
            onClick={() => setSidebarOpen(false)}
            title={collapsed ? 'ByteBox' : undefined}
          >
            <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md shrink-0">
              <HardDrive size={18} className="text-white" />
            </div>
            {!collapsed && (
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-lg tracking-tight">ByteBox</span>
              </div>
            )}
          </Link>
        </div>

        {/* Main navigation */}
        <nav className={`flex-1 py-3 overflow-y-auto ${collapsed ? 'px-2' : 'px-3'}`}>
          {/* All Files */}
          {mainNav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              title={collapsed ? label : undefined}
              className={`flex items-center rounded-xl text-sm font-medium transition-colors mb-1 ${
                collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
              } ${
                isActive(to)
                  ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
              }`}
            >
              <Icon size={20} className="shrink-0" />
              {!collapsed && label}
            </Link>
          ))}

          {/* Category filters */}
          <div className="mt-1 space-y-0.5">
            {categoryNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive(to)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && label}
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className={`my-3 border-t border-slate-100 dark:border-slate-700 ${collapsed ? 'mx-1' : ''}`} />

          {/* Explore, Starred, Recycle Bin */}
          <div className="space-y-0.5">
            {bottomNav.map(({ to, label, icon: Icon }) => (
              <Link
                key={to}
                to={to}
                onClick={() => setSidebarOpen(false)}
                title={collapsed ? label : undefined}
                className={`flex items-center rounded-xl text-sm font-medium transition-colors ${
                  collapsed ? 'justify-center px-0 py-2.5' : 'gap-3 px-3 py-2.5'
                } ${
                  isActive(to)
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={20} className="shrink-0" />
                {!collapsed && label}
              </Link>
            ))}
          </div>
        </nav>

        {/* Storage bar - hidden when collapsed */}
        {!collapsed && (
          <div className="px-4 pb-3 space-y-3">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
              <div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mb-2">
                <span>{formatBytes(storageUsed)} / {formatBytes(storageLimit)}</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    storagePercent > 90 ? 'bg-red-500' : 'bg-blue-500'
                  }`}
                  style={{ width: `${storagePercent}%` }}
                />
              </div>
              {user?.plan === 'free' && (
                <button className="mt-2 text-xs text-blue-500 hover:text-blue-600 font-medium">
                  Expand Capacity
                </button>
              )}
            </div>
          </div>
        )}

        {/* Collapse toggle - desktop only */}
        {!mobile && (
          <div className={`border-t border-slate-100 dark:border-slate-700 ${collapsed ? 'px-2 py-2' : 'px-3 py-2'}`}>
            <button
              onClick={toggleSidebarCollapse}
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              className={`flex items-center rounded-xl text-sm font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors w-full ${
                collapsed ? 'justify-center px-0 py-2' : 'gap-3 px-3 py-2'
              }`}
            >
              {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              {!collapsed && <span>Collapse</span>}
            </button>
          </div>
        )}
      </aside>
    );
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0">
        {renderSidebar(false)}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 h-full flex flex-col">
            {renderSidebar(true)}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 lg:px-6 py-2.5 flex items-center gap-3 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl">
            <div className="relative">
              <Search
                size={16}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="search your files"
                className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={clearSearch}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </form>

          <div className="flex items-center gap-1">
            <NotificationBell />

            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDark ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {/* Upload button */}
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm shrink-0 ml-1"
            >
              <Upload size={16} />
              <span className="hidden sm:inline">Upload</span>
            </button>

            {/* Profile dropdown */}
            <div className="relative ml-1" ref={profileRef}>
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-sm font-semibold">
                  {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
              </button>

              {profileOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                  {/* User info */}
                  <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-lg font-bold shrink-0">
                        {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
                      </div>
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
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20">
                      <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">Enjoy over 10 benefits with Premium</p>
                      <div className="flex justify-center gap-6 mb-2">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-1">
                            <HardDrive size={16} className="text-blue-500" />
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
                      <button className="w-full py-2 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-lg text-sm font-medium transition-colors">
                        Premium
                      </button>
                    </div>
                  )}

                  {/* Menu items */}
                  <div className="py-1">
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <User size={16} className="text-slate-400" />
                      Personal Center
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                    >
                      <Settings size={16} className="text-slate-400" />
                      Settings
                    </Link>
                  </div>

                  {/* Logout */}
                  <div className="border-t border-slate-100 dark:border-slate-700 py-1">
                    <button
                      onClick={() => { logout(); setProfileOpen(false); }}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors w-full"
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
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
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
              className="hover:text-blue-600 transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="text-slate-800 dark:text-slate-200 font-medium">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
