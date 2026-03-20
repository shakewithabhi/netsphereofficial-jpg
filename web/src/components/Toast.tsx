import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastData {
  id: string;
  title: string;
  description?: string;
  type: ToastType;
  createdAt: number;
}

interface ToastContextValue {
  toast: (params: { title: string; description?: string; type: ToastType }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const DURATION = 4000;
const MAX_TOASTS = 5;

const ICONS: Record<ToastType, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
  warning: AlertTriangle,
};

const COLORS: Record<ToastType, { bg: string; icon: string; bar: string }> = {
  success: {
    bg: 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800',
    icon: 'text-green-500',
    bar: 'bg-green-500',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
    icon: 'text-red-500',
    bar: 'bg-red-500',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
    icon: 'text-blue-500',
    bar: 'bg-blue-500',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800',
    icon: 'text-yellow-500',
    bar: 'bg-yellow-500',
  },
};

let toastCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (params: { title: string; description?: string; type: ToastType }) => {
      const id = `toast-${++toastCounter}`;
      const newToast: ToastData = { ...params, id, createdAt: Date.now() };
      setToasts((prev) => [...prev.slice(-(MAX_TOASTS - 1)), newToast]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none backdrop-blur-sm">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [progress, setProgress] = useState(100);
  const frameRef = useRef<number>();

  useEffect(() => {
    const start = Date.now();
    function tick() {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 100 - (elapsed / DURATION) * 100);
      setProgress(remaining);
      if (remaining > 0) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        onDismiss(toast.id);
      }
    }
    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [toast.id, onDismiss]);

  const Icon = ICONS[toast.type];
  const colors = COLORS[toast.type];

  return (
    <div
      className={`pointer-events-auto w-80 border rounded-xl shadow-lg overflow-hidden animate-slide-in-right ${colors.bg}`}
    >
      <div className="flex items-start gap-3 p-3">
        <Icon size={18} className={`shrink-0 mt-0.5 ${colors.icon}`} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200">{toast.title}</p>
          {toast.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{toast.description}</p>
          )}
        </div>
        <button
          onClick={() => onDismiss(toast.id)}
          className="shrink-0 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>
      <div className="h-1 w-full bg-slate-200/50 dark:bg-[#1E293B]">
        <div
          className={`h-full transition-none ${colors.bar}`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
