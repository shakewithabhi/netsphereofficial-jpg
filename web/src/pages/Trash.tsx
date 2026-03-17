import { useState, useEffect, useCallback } from 'react';
import { Folder, Trash2, RotateCcw, AlertTriangle, X } from 'lucide-react';
import {
  getTrash,
  restoreFile,
  restoreFolder,
  deleteFilePermanently,
  deleteFolder,
  formatBytes,
} from '../api/files';
import type { FolderItem, FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';

export default function Trash() {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<{
    type: 'file' | 'folder';
    id: string;
    name: string;
  } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getTrash();
        setFolders(data.folders ?? []);
        setFiles(data.files ?? []);
      } catch {
        setError('Failed to load trash.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  async function handleRestoreFile(id: string) {
    try {
      await restoreFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Failed to restore file.');
    }
  }

  async function handleRestoreFolder(id: string) {
    try {
      await restoreFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Failed to restore folder.');
    }
  }

  async function handleDeleteFile(id: string) {
    try {
      await deleteFilePermanently(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
      setConfirmDelete(null);
    } catch {
      setError('Failed to delete file permanently.');
    }
  }

  async function handleDeleteFolder(id: string) {
    try {
      await deleteFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setConfirmDelete(null);
    } catch {
      setError('Failed to delete folder permanently.');
    }
  }

  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  return (
    <Layout onRefresh={refresh}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb crumbs={[{ label: 'Trash' }]} />
          {!isEmpty && (
            <p className="text-xs text-slate-400">
              {folders.length + files.length} item{folders.length + files.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm">
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
            <Trash2 size={48} className="text-slate-200 mb-4" />
            <p className="text-slate-500 font-medium">Trash is empty</p>
            <p className="text-sm text-slate-400 mt-1">
              Items you delete will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {/* Trashed Folders */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-xl group hover:bg-slate-50 transition-colors"
              >
                <Folder size={20} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-slate-700 truncate line-through decoration-slate-300">
                  {folder.name}
                </span>
                <span className="text-xs text-slate-400 hidden sm:block">
                  Folder
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestoreFolder(folder.id)}
                    title="Restore"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      setConfirmDelete({ type: 'folder', id: folder.id, name: folder.name })
                    }
                    title="Delete permanently"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* Trashed Files */}
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-3 px-4 py-3 bg-white border border-slate-100 rounded-xl group hover:bg-slate-50 transition-colors"
              >
                <FileIcon mimeType={file.mime_type} size={20} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-slate-700 truncate line-through decoration-slate-300">
                  {file.name}
                </span>
                <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
                  {formatBytes(file.size)}
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestoreFile(file.id)}
                    title="Restore"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      setConfirmDelete({ type: 'file', id: file.id, name: file.name })
                    }
                    title="Delete permanently"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800">Delete permanently?</h3>
                  <p className="text-sm text-slate-500 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 bg-slate-50 px-3 py-2 rounded-lg mb-5 truncate">
                "{confirmDelete.name}"
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (confirmDelete.type === 'file') {
                      handleDeleteFile(confirmDelete.id);
                    } else {
                      handleDeleteFolder(confirmDelete.id);
                    }
                  }}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Delete forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
