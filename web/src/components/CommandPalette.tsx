import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FolderPlus,
  Home,
  Compass,
  Trash2,
  Settings,
  Share2,
  Star,
  Moon,
  Sun,
  Search,
} from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onUpload: () => void;
  toggleTheme: () => void;
}

interface Command {
  id: string;
  label: string;
  icon: typeof Upload;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ open, onClose, onUpload, toggleTheme }: CommandPaletteProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const isDark = document.documentElement.classList.contains('dark');

  const commands: Command[] = [
    { id: 'upload', label: 'Upload File', icon: Upload, action: () => { onUpload(); onClose(); } },
    { id: 'new-folder', label: 'New Folder', icon: FolderPlus, action: () => { navigate('/'); onClose(); } },
    { id: 'files', label: 'Go to Files', icon: Home, shortcut: 'G F', action: () => { navigate('/'); onClose(); } },
    { id: 'explore', label: 'Go to Explore', icon: Compass, shortcut: 'G E', action: () => { navigate('/explore'); onClose(); } },
    { id: 'trash', label: 'Go to Trash', icon: Trash2, shortcut: 'G T', action: () => { navigate('/trash'); onClose(); } },
    { id: 'settings', label: 'Go to Settings', icon: Settings, shortcut: 'G S', action: () => { navigate('/settings'); onClose(); } },
    { id: 'shares', label: 'Go to Shares', icon: Share2, action: () => { navigate('/shares'); onClose(); } },
    { id: 'favorites', label: 'Go to Favorites', icon: Star, shortcut: 'G V', action: () => { navigate('/favorites'); onClose(); } },
    { id: 'theme', label: 'Toggle Dark Mode', icon: isDark ? Sun : Moon, shortcut: 'G D', action: () => { toggleTheme(); onClose(); } },
  ];

  const filtered = query
    ? commands.filter((c) => c.label.toLowerCase().includes(query.toLowerCase()))
    : commands;

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        filtered[selectedIndex].action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [filtered, selectedIndex, onClose]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-md" />
      <div
        className="relative w-full max-w-lg mx-4 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/[0.05] rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200/50 dark:border-white/[0.05]/50">
          <Search size={18} className="text-slate-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command..."
            className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-200 placeholder:text-slate-400 outline-none"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-200 dark:border-white/[0.08] rounded">
            ESC
          </kbd>
        </div>

        {/* Commands list */}
        <div className="max-h-72 overflow-y-auto py-2">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">No commands found</p>
          ) : (
            filtered.map((cmd, i) => {
              const Icon = cmd.icon;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm transition-colors ${
                    i === selectedIndex
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-l-2 border-l-blue-500'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-[#141b2d] border-l-2 border-l-transparent'
                  }`}
                >
                  <Icon size={16} className="shrink-0" />
                  <span className="flex-1 text-left">{cmd.label}</span>
                  {cmd.shortcut && (
                    <kbd className="hidden sm:inline-flex items-center gap-0.5 text-[10px] font-medium text-slate-400">
                      {cmd.shortcut.split(' ').map((k, ki) => (
                        <span
                          key={ki}
                          className="px-1.5 py-0.5 border border-slate-200 dark:border-white/[0.08] rounded"
                        >
                          {k}
                        </span>
                      ))}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
