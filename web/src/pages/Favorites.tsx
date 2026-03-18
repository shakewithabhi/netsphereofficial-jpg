import { useState, useEffect, useCallback } from 'react';
import { Star, X } from 'lucide-react';
import {
  getStarredFiles,
  unstarFile,
  getDownloadUrl,
  formatBytes,
} from '../api/files';
import type { FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';

export default function Favorites() {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getStarredFiles();
        setFiles(data.files ?? []);
      } catch {
        setError('Failed to load favorites.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  async function handleDownload(id: string) {
    try {
      const url = await getDownloadUrl(id);
      window.open(url, '_blank');
    } catch {
      setError('Failed to get download link.');
    }
  }

  async function handleUnstar(id: string) {
    try {
      await unstarFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Failed to unstar file.');
    }
  }

  const isEmpty = !loading && files.length === 0;

  return (
    <Layout onRefresh={refresh}>
      <div className="p-6 dark:bg-slate-900 min-h-full">
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb crumbs={[{ label: 'Favorites' }]} />
          {!isEmpty && (
            <p className="text-xs text-slate-400">
              {files.length} item{files.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
            <span className="flex-1">{error}</span>
            <button onClick={() => setError('')}><X size={16} /></button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Star size={64} className="text-slate-200 dark:text-slate-700 mb-4" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No favorites yet</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Star files to quickly access them here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors cursor-pointer"
                onClick={() => handleDownload(file.id)}
              >
                <Star size={16} className="text-yellow-500 fill-yellow-500 shrink-0" />
                <FileIcon mimeType={file.mime_type} size={20} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                  {file.name}
                </span>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                  {formatBytes(file.size)}
                </span>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                  {new Date(file.created_at).toLocaleDateString()}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleUnstar(file.id);
                  }}
                  title="Remove from favorites"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-amber-600 bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Star size={14} />
                  Unstar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
