import { useState, useCallback } from 'react';
import { Download, Trash2, Clock, FileText, X } from 'lucide-react';
import { Layout } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';
import { formatBytes } from '../api/files';
import {
  getDownloadHistory,
  clearDownloadHistory,
  removeDownloadRecord,
} from '../utils/downloadHistory';
import type { DownloadRecord } from '../utils/downloadHistory';

export default function Downloads() {
  const [history, setHistory] = useState<DownloadRecord[]>(() => getDownloadHistory());
  const [refreshKey, setRefreshKey] = useState(0);

  const reload = useCallback(() => {
    setHistory(getDownloadHistory());
    setRefreshKey((k) => k + 1);
  }, []);

  function handleClearAll() {
    clearDownloadHistory();
    setHistory([]);
  }

  function handleRemove(record: DownloadRecord) {
    removeDownloadRecord(record.id, record.downloaded_at);
    setHistory((prev) => prev.filter((r) => !(r.id === record.id && r.downloaded_at === record.downloaded_at)));
  }

  function formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <Layout onRefresh={reload}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-md">
              <Download size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Download History</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {history.length} {history.length === 1 ? 'file' : 'files'} downloaded
              </p>
            </div>
          </div>
          {history.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 size={16} />
              Clear All
            </button>
          )}
        </div>

        {/* Content */}
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
            <Download size={48} className="mb-4 opacity-40" />
            <p className="text-lg font-medium">No downloads yet</p>
            <p className="text-sm mt-1">Files you download will appear here</p>
          </div>
        ) : (
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-white/[0.05] overflow-hidden shadow-sm">
            {history.map((record, index) => (
              <div
                key={`${record.id}-${record.downloaded_at}`}
                className={`flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors group ${
                  index > 0 ? 'border-t border-slate-100 dark:border-white/[0.05]' : ''
                }`}
              >
                <div className="w-10 h-10 bg-slate-100 dark:bg-[#1E293B] rounded-xl flex items-center justify-center shrink-0">
                  <FileIcon mimeType={record.mime_type} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {record.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {formatBytes(record.size)}
                    </span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">|</span>
                    <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                      <Clock size={12} />
                      {formatDate(record.downloaded_at)}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(record)}
                  className="p-2 rounded-lg text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 opacity-0 group-hover:opacity-100 transition-all"
                  title="Remove from history"
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
