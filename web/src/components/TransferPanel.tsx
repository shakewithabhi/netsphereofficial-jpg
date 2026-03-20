import React, { createContext, useContext, useState, useCallback } from 'react';

// --- Types ---

export type TransferStatus = 'uploading' | 'downloading' | 'complete' | 'failed';

export interface Transfer {
  id: string;
  name: string;
  type: 'upload' | 'download';
  status: TransferStatus;
  progress: number;
  error?: string;
}

interface TransferContextValue {
  transfers: Transfer[];
  addTransfer: (id: string, name: string, type: 'upload' | 'download') => void;
  updateProgress: (id: string, progress: number) => void;
  completeTransfer: (id: string) => void;
  failTransfer: (id: string, error: string) => void;
  removeTransfer: (id: string) => void;
}

// --- Context ---

const TransferContext = createContext<TransferContextValue | null>(null);

export function useTransfer(): TransferContextValue {
  const ctx = useContext(TransferContext);
  if (!ctx) {
    throw new Error('useTransfer must be used within a TransferProvider');
  }
  return ctx;
}

// --- Provider ---

export function TransferProvider({ children }: { children: React.ReactNode }) {
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  const addTransfer = useCallback((id: string, name: string, type: 'upload' | 'download') => {
    setTransfers((prev) => {
      if (prev.find((t) => t.id === id)) return prev;
      return [
        ...prev,
        {
          id,
          name,
          type,
          status: type === 'upload' ? 'uploading' : 'downloading',
          progress: 0,
        },
      ];
    });
  }, []);

  const updateProgress = useCallback((id: string, progress: number) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, progress: Math.min(100, Math.max(0, progress)) } : t))
    );
  }, []);

  const completeTransfer = useCallback((id: string) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'complete' as const, progress: 100 } : t))
    );
  }, []);

  const failTransfer = useCallback((id: string, error: string) => {
    setTransfers((prev) =>
      prev.map((t) => (t.id === id ? { ...t, status: 'failed' as const, error } : t))
    );
  }, []);

  const removeTransfer = useCallback((id: string) => {
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <TransferContext.Provider
      value={{ transfers, addTransfer, updateProgress, completeTransfer, failTransfer, removeTransfer }}
    >
      {children}
      <TransferPanel />
    </TransferContext.Provider>
  );
}

// --- Panel UI ---

function TransferPanel() {
  const { transfers, removeTransfer } = useTransfer();
  const [collapsed, setCollapsed] = useState(false);

  if (transfers.length === 0) return null;

  const activeCount = transfers.filter((t) => t.status === 'uploading' || t.status === 'downloading').length;
  const label = activeCount > 0 ? `${activeCount} active transfer${activeCount !== 1 ? 's' : ''}` : `${transfers.length} transfer${transfers.length !== 1 ? 's' : ''}`;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white shadow-xl dark:border-white/[0.05] dark:bg-[#0F172A] overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-white/[0.08] transition-colors"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
          {label}
        </span>
        <svg
          className={`h-4 w-4 text-slate-400 transition-transform ${collapsed ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Body */}
      {!collapsed && (
        <div className="max-h-[300px] overflow-y-auto border-t border-slate-100 dark:border-white/[0.05]">
          {transfers.map((t) => (
            <TransferItem key={t.id} transfer={t} onRemove={() => removeTransfer(t.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// --- Individual transfer row ---

function TransferItem({ transfer, onRemove }: { transfer: Transfer; onRemove: () => void }) {
  const { removeTransfer } = useTransfer();
  const isActive = transfer.status === 'uploading' || transfer.status === 'downloading';

  const statusColor: Record<TransferStatus, string> = {
    uploading: 'text-blue-500 dark:text-blue-400',
    downloading: 'text-blue-500 dark:text-blue-400',
    complete: 'text-green-500 dark:text-green-400',
    failed: 'text-red-500 dark:text-red-400',
  };

  const barColor: Record<TransferStatus, string> = {
    uploading: 'bg-blue-500',
    downloading: 'bg-blue-500',
    complete: 'bg-green-500',
    failed: 'bg-red-500',
  };

  const statusLabel: Record<TransferStatus, string> = {
    uploading: 'Uploading',
    downloading: 'Downloading',
    complete: 'Complete',
    failed: 'Failed',
  };

  return (
    <div className="group px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors">
      <div className="flex items-center justify-between gap-2 mb-1">
        {/* File name */}
        <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200" title={transfer.name}>
          {transfer.name}
        </span>

        {/* Action button */}
        {isActive ? (
          <button
            onClick={() => removeTransfer(transfer.id)}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/[0.1] dark:hover:text-slate-200 transition-colors"
            title="Cancel"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onRemove}
            className="shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-white/[0.1] dark:hover:text-slate-200 transition-colors"
            title="Remove"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-white/[0.1] overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor[transfer.status]}`}
          style={{ width: `${transfer.progress}%` }}
        />
      </div>

      {/* Status line */}
      <div className="mt-1 flex items-center justify-between">
        <span className={`text-xs ${statusColor[transfer.status]}`}>
          {statusLabel[transfer.status]}
          {transfer.status === 'failed' && transfer.error ? ` — ${transfer.error}` : ''}
        </span>
        <span className="text-xs text-slate-400 dark:text-slate-500">{Math.round(transfer.progress)}%</span>
      </div>
    </div>
  );
}
