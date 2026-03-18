import { useState, useRef, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  HardDrive,
  Home,
  Star,
  Trash2,
  Settings,
  LogOut,
  Upload,
  Search,
  X,
  ChevronRight,
  Menu,
  Moon,
  Sun,
} from 'lucide-react';
import { useAuth } from '../store/auth';
import { formatBytes } from '../api/files';
import { UploadModal } from './UploadModal';
import { SidebarAd } from './AdBanner';
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
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSearchQuery('');
  }, [location.pathname]);

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
  const storageLimit = user?.storage_limit ?? 1073741824; // 1 GB default
  const storagePercent = Math.min(100, Math.round((storageUsed / storageLimit) * 100));

  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/favorites', label: 'Favorites', icon: Star },
    { to: '/trash', label: 'Trash', icon: Trash2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  function isActive(to: string) {
    if (to === '/') {
      return location.pathname === '/' || location.pathname === '/files' || location.pathname.startsWith('/folder');
    }
    return location.pathname === to;
  }

  const sidebar = (
    <aside className="w-64 bg-slate-900 flex flex-col h-full">
      <div className="px-5 py-5 border-b border-slate-800">
        <Link
          to="/"
          className="flex items-center gap-3 group"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="w-9 h-9 bg-blue-600 rounded-xl flex items-center justify-center shadow-md">
            <HardDrive size={18} className="text-white" />
          </div>
          <div>
            <span className="font-bold text-white text-lg tracking-tight">ByteBox</span>
            <p className="text-xs text-slate-400 leading-none">Cloud Storage</p>
          </div>
        </Link>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            onClick={() => setSidebarOpen(false)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              isActive(to)
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:text-white hover:bg-slate-800'
            }`}
          >
            <Icon size={18} />
            {label}
          </Link>
        ))}
      </nav>

      <div className="px-4 pb-4 space-y-3">
        <div className="bg-slate-800 rounded-xl p-3">
          <div className="flex justify-between text-xs text-slate-400 mb-2">
            <span>Storage</span>
            <span>{storagePercent}%</span>
          </div>
          <div className="w-full bg-slate-700 rounded-full h-1.5 mb-2">
            <div
              className={`h-1.5 rounded-full transition-all ${
                storagePercent > 90 ? 'bg-red-500' : 'bg-blue-500'
              }`}
              style={{ width: `${storagePercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400">
            {formatBytes(storageUsed)} of {formatBytes(storageLimit)} used
          </p>
        </div>

        {/* Sidebar ad for free-tier users */}
        {(!user?.plan || user.plan === 'free') && (
          <SidebarAd />
        )}

        <div className="flex items-center gap-3 px-2 py-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-semibold shrink-0">
            {user?.display_name?.[0]?.toUpperCase() ?? 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.display_name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-slate-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-900">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex lg:flex-col lg:shrink-0">
        {sidebar}
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative w-64 h-full flex flex-col">
            {sidebar}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 px-4 lg:px-6 py-3 flex items-center gap-3 shrink-0">
          <button
            className="lg:hidden p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>

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
                placeholder="Search files and folders..."
                className="w-full pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white dark:focus:bg-slate-600 transition-colors placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
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

          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm shrink-0"
          >
            <Upload size={16} />
            <span className="hidden sm:inline">Upload</span>
          </button>

          {location.pathname !== '/' && location.pathname !== '/files' && !location.pathname.startsWith('/folder') && (
            <></>
          )}
        </header>

        {/* Breadcrumb slot + page content */}
        <main className="flex-1 overflow-y-auto">
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
