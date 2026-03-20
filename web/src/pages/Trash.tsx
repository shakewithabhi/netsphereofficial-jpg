import { useState, useEffect, useCallback } from 'react';
import { Folder, Trash2, RotateCcw, AlertTriangle, X, Eye, Clock, HardDrive } from 'lucide-react';
import {
  getTrash,
  restoreFile,
  restoreFolder,
  deleteFilePermanently,
  deleteFolder,
  getDownloadUrl,
  formatBytes,
} from '../api/files';
import type { FolderItem, FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';
import { timeAgo } from '../utils/format';

const trashThumbnailCache = new Map<string, string>();

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
  const [previewFile, setPreviewFile] = useState<{ name: string; url: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

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

  async function handlePreview(file: FileItem) {
    if (!file.mime_type.startsWith('image/')) return;
    setPreviewLoading(true);
    try {
      const url = await getDownloadUrl(file.id);
      setPreviewFile({ name: file.name, url });
    } catch {
      setError('Failed to load preview.');
    } finally {
      setPreviewLoading(false);
    }
  }

  // Cache thumbnail URLs per file id
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>(
    () => Object.fromEntries(trashThumbnailCache)
  );

  useEffect(() => {
    const imageFiles = files.filter(
      (f) => f.mime_type.startsWith('image/') && !thumbnailUrls[f.id] && !trashThumbnailCache.has(f.id)
    );
    if (imageFiles.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: Record<string, string> = {};
      // Process in batches of 5 to limit concurrency
      for (let i = 0; i < imageFiles.length; i += 5) {
        const batch = imageFiles.slice(i, i + 5);
        await Promise.allSettled(
          batch.map(async (f) => {
            try {
              const url = await getDownloadUrl(f.id);
              entries[f.id] = url;
              trashThumbnailCache.set(f.id, url);
            } catch {
              // skip failed thumbnails
            }
          })
        );
      }
      if (!cancelled) {
        setThumbnailUrls((prev) => ({ ...prev, ...entries }));
      }
    })();
    return () => { cancelled = true; };
  }, [files]);

  const [bulkLoading, setBulkLoading] = useState<'restore' | 'empty' | null>(null);
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false);

  async function handleRestoreAll() {
    setBulkLoading('restore');
    try {
      await Promise.allSettled([
        ...files.map((f) => restoreFile(f.id)),
        ...folders.map((f) => restoreFolder(f.id)),
      ]);
      refresh();
    } catch {
      setError('Failed to restore some items.');
    } finally {
      setBulkLoading(null);
    }
  }

  async function handleEmptyTrash() {
    setBulkLoading('empty');
    setConfirmEmptyTrash(false);
    try {
      await Promise.allSettled([
        ...files.map((f) => deleteFilePermanently(f.id)),
        ...folders.map((f) => deleteFolder(f.id)),
      ]);
      refresh();
    } catch {
      setError('Failed to delete some items.');
    } finally {
      setBulkLoading(null);
    }
  }

  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  return (
    <Layout onRefresh={refresh}>
      <div className="p-6 dark:bg-slate-900 min-h-full">
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb crumbs={[{ label: 'Trash' }]} />
          {!isEmpty && (
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400">
                {folders.length + files.length} item{folders.length + files.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={handleRestoreAll}
                disabled={bulkLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors disabled:opacity-50"
              >
                <RotateCcw size={14} className={bulkLoading === 'restore' ? 'animate-spin' : ''} />
                Restore All
              </button>
              <button
                onClick={() => setConfirmEmptyTrash(true)}
                disabled={bulkLoading !== null}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors disabled:opacity-50"
              >
                <Trash2 size={14} className={bulkLoading === 'empty' ? 'animate-spin' : ''} />
                Empty Trash
              </button>
            </div>
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
            <Trash2 size={64} className="text-slate-200 dark:text-slate-700 mb-4" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">Trash is empty</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              Items you delete will appear here for 30 days
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Trashed Folders */}
            {folders.map((folder) => (
              <div
                key={folder.id}
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group hover:bg-slate-50 dark:hover:bg-slate-750 transition-colors"
              >
                <Folder size={20} className="text-slate-400 shrink-0" />
                <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate line-through decoration-slate-300 dark:decoration-slate-600">
                  {folder.name}
                </span>
                <span className="text-xs text-slate-400 hidden sm:block">
                  Folder
                </span>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleRestoreFolder(folder.id)}
                    title="Restore"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                  >
                    <RotateCcw size={14} />
                    Restore
                  </button>
                  <button
                    onClick={() =>
                      setConfirmDelete({ type: 'folder', id: folder.id, name: folder.name })
                    }
                    title="Delete permanently"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                </div>
              </div>
            ))}

            {/* Trashed Files as Cards */}
            {files.map((file) => {
              const isImage = file.mime_type.startsWith('image/');
              const thumbUrl = thumbnailUrls[file.id];

              return (
                <div
                  key={file.id}
                  className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Thumbnail / Icon */}
                    <div className="shrink-0">
                      {isImage && thumbUrl ? (
                        <button
                          onClick={() => handlePreview(file)}
                          className="relative block w-14 h-14 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={thumbUrl}
                            alt={file.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/20 transition-colors">
                            <Eye size={16} className="text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow" />
                          </div>
                        </button>
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-slate-50 dark:bg-slate-700 flex items-center justify-center">
                          <FileIcon mimeType={file.mime_type} size={24} className="text-slate-400" />
                        </div>
                      )}
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <HardDrive size={12} />
                          {formatBytes(file.size)}
                        </span>
                        {file.trashed_at && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock size={12} />
                            Trashed {timeAgo(file.trashed_at)}
                          </span>
                        )}
                        <span className="text-xs text-slate-300 dark:text-slate-600 hidden sm:block">
                          {file.mime_type}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isImage && (
                        <button
                          onClick={() => handlePreview(file)}
                          title="Preview"
                          className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                          Preview
                        </button>
                      )}
                      <button
                        onClick={() => handleRestoreFile(file.id)}
                        title="Restore"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-lg transition-colors"
                      >
                        <RotateCcw size={14} />
                        Restore
                      </button>
                      <button
                        onClick={() =>
                          setConfirmDelete({ type: 'file', id: file.id, name: file.name })
                        }
                        title="Delete permanently"
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Confirm empty trash dialog */}
      {confirmEmptyTrash && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Empty trash?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    All {folders.length + files.length} items will be permanently deleted.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmEmptyTrash(false)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEmptyTrash}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Delete all forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Delete permanently?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">This cannot be undone.</p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-2 rounded-lg mb-5 truncate">
                "{confirmDelete.name}"
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
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

      {/* Image preview modal */}
      {previewFile && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setPreviewFile(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] mx-4 animate-fade-in"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewFile(null)}
              className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-white dark:bg-slate-700 rounded-full shadow-lg flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
            >
              <X size={16} className="text-slate-600 dark:text-slate-300" />
            </button>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{previewFile.name}</p>
              </div>
              <div className="p-2 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <img
                  src={previewFile.url}
                  alt={previewFile.name}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview loading overlay */}
      {previewLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-10 h-10 border-2 border-white border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </Layout>
  );
}
