import { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  Folder,
  ChevronRight,
  Check,
  ArrowLeft,
} from 'lucide-react';
import { getRootContents, getFolderContents, formatBytes } from '../api/files';
import type { FileItem, FolderItem } from '../api/files';
import { FileIcon } from './FileIcon';

export interface FilePickerModalProps {
  open: boolean;
  onClose: () => void;
  onSelect: (files: FileItem[]) => void;
  multiple?: boolean;
  accept?: string[]; // mime prefix filter, e.g. ['video/']
}

interface BreadcrumbItem {
  label: string;
  folderId?: string;
}

export function FilePickerModal({
  open,
  onClose,
  onSelect,
  multiple = true,
  accept,
}: FilePickerModalProps) {
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Map<string, FileItem>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(
    undefined,
  );
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'My Files' },
  ]);

  useEffect(() => {
    if (!open) return;
    loadContents(currentFolderId);
  }, [currentFolderId, open]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setSelected(new Map());
      setSearchQuery('');
      setCurrentFolderId(undefined);
      setBreadcrumbs([{ label: 'My Files' }]);
      setError('');
    }
  }, [open]);

  async function loadContents(folderId?: string) {
    setLoading(true);
    setError('');
    try {
      const contents = folderId
        ? await getFolderContents(folderId)
        : await getRootContents('name', 'asc');
      setFolders(contents.folders ?? []);
      let fileList = contents.files ?? [];
      // Filter by accepted mime types if provided
      if (accept && accept.length > 0) {
        fileList = fileList.filter((f) =>
          accept.some((a) => f.mime_type?.startsWith(a)),
        );
      }
      setFiles(fileList);
    } catch {
      setError('Failed to load files');
    }
    setLoading(false);
  }

  function navigateToFolder(folder: FolderItem) {
    setCurrentFolderId(folder.id);
    setBreadcrumbs([...breadcrumbs, { label: folder.name, folderId: folder.id }]);
    setSearchQuery('');
  }

  function navigateToBreadcrumb(index: number) {
    const crumb = breadcrumbs[index];
    setCurrentFolderId(crumb.folderId);
    setBreadcrumbs(breadcrumbs.slice(0, index + 1));
    setSearchQuery('');
  }

  function toggleFile(file: FileItem) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        if (!multiple) {
          next.clear();
        }
        next.set(file.id, file);
      }
      return next;
    });
  }

  function handleConfirm() {
    onSelect(Array.from(selected.values()));
    onClose();
  }

  const query = searchQuery.toLowerCase();

  const filteredFolders = useMemo(
    () =>
      query
        ? folders.filter((f) => f.name.toLowerCase().includes(query))
        : folders,
    [folders, query],
  );

  const filteredFiles = useMemo(
    () =>
      query
        ? files.filter((f) => f.name.toLowerCase().includes(query))
        : files,
    [files, query],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-xl w-full max-w-xl mx-4 animate-fade-in flex flex-col max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.05] shrink-0">
          <div className="flex items-center gap-2">
            <Folder size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">
              Select from ByteBox
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Breadcrumbs */}
        <div className="px-6 pt-3 pb-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 shrink-0 flex-wrap">
          {breadcrumbs.map((crumb, i) => (
            <span key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />}
              <button
                onClick={() => navigateToBreadcrumb(i)}
                className={`hover:text-blue-600 transition-colors ${
                  i === breadcrumbs.length - 1
                    ? 'font-medium text-slate-700 dark:text-slate-300'
                    : ''
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>

        {/* Search */}
        <div className="px-6 pb-3 shrink-0">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              type="text"
              placeholder="Search files..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm bg-slate-50 dark:bg-[#1E293B] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 text-slate-700 dark:text-slate-300 placeholder-slate-400"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mx-6 mb-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg text-sm shrink-0">
            {error}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 pb-3 min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-7 h-7 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Folder size={32} className="mb-2" />
              <p className="text-sm">
                {searchQuery ? 'No matching files' : 'This folder is empty'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {/* Back button when in subfolder */}
              {breadcrumbs.length > 1 && !searchQuery && (
                <button
                  onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-left"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                    <ArrowLeft size={18} className="text-slate-400" />
                  </div>
                  <span className="text-sm text-slate-500 dark:text-slate-400">
                    Back
                  </span>
                </button>
              )}

              {/* Folders */}
              {filteredFolders.map((folder) => (
                <button
                  key={folder.id}
                  onClick={() => navigateToFolder(folder)}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] transition-colors text-left group"
                >
                  <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <Folder size={18} className="text-blue-500" />
                  </div>
                  <span className="flex-1 text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {folder.name}
                  </span>
                  <ChevronRight
                    size={16}
                    className="text-slate-300 dark:text-slate-600 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  />
                </button>
              ))}

              {/* Files */}
              {filteredFiles.map((file) => {
                const isSelected = selected.has(file.id);
                return (
                  <button
                    key={file.id}
                    onClick={() => toggleFile(file)}
                    className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-colors text-left ${
                      isSelected
                        ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800'
                        : 'hover:bg-slate-50 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    {/* Checkbox */}
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                        isSelected
                          ? 'bg-blue-600 border-blue-600'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {isSelected && <Check size={12} className="text-white" />}
                    </div>
                    {/* File icon */}
                    <div className="w-9 h-9 rounded-lg bg-slate-50 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                      <FileIcon mimeType={file.mime_type} size={18} />
                    </div>
                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatBytes(file.size)} &middot;{' '}
                        {new Date(file.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/[0.05] flex items-center justify-between shrink-0">
          <p className="text-xs text-slate-400">
            {selected.size > 0
              ? `${selected.size} file${selected.size !== 1 ? 's' : ''} selected`
              : 'No files selected'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Select {selected.size > 0 ? `${selected.size} file${selected.size !== 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
