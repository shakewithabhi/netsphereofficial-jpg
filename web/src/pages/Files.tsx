import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { DragEvent as ReactDragEvent } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Folder,
  FolderPlus,
  Grid3x3,
  List,
  MoreVertical,
  Download,
  Share2,
  Copy,
  Trash2,
  Edit2,
  X,
  Check,
  CloudUpload,
  Search,
  Star,
  StarOff,
  MessageCircle,
  CheckSquare,
  Square,
  Move,
} from 'lucide-react';
import {
  getRootContents,
  getFolderContents,
  createFolder,
  renameFolder,
  trashFolder,
  trashFile,
  copyFile,
  getDownloadUrl,
  searchFiles,
  uploadFile,
  formatBytes,
  starFile,
  unstarFile,
  moveFile,
  batchTrash,
  batchMove,
} from '../api/files';
import type { FolderItem, FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';
import { ShareDialog } from '../components/ShareDialog';
import { UploadModal } from '../components/UploadModal';
import { CommentsDialog } from '../components/CommentsDialog';
import { FilePreview } from '../components/FilePreview';
import { HeaderAd, InFeedAd } from '../components/AdBanner';
import { useAuth } from '../store/auth';

interface BreadcrumbItem {
  label: string;
  to?: string;
  id?: string;
}

export default function Files() {
  const { user } = useAuth();
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') ?? '';

  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { label: 'My Files', to: '/' },
  ]);

  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');

  const [contextMenu, setContextMenu] = useState<{
    type: 'file' | 'folder';
    item: FileItem | FolderItem;
    x: number;
    y: number;
  } | null>(null);

  const [shareFile, setShareFile] = useState<FileItem | null>(null);
  const [commentsFile, setCommentsFile] = useState<FileItem | null>(null);
  const [showUpload, setShowUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // File Preview state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Bulk selection state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Drag & drop move state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'folder' | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Clear selection when navigating
  useEffect(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setSelectionMode(false);
    setLastClickedIndex(null);
  }, [folderId, searchQuery]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        if (searchQuery) {
          const data = await searchFiles(searchQuery);
          setFolders(data.folders ?? []);
          setFiles(data.files ?? []);
          setBreadcrumbs([
            { label: 'My Files', to: '/' },
            { label: `Search: "${searchQuery}"` },
          ]);
        } else if (!folderId) {
          const data = await getRootContents();
          setFolders(data.folders ?? []);
          setFiles(data.files ?? []);
          setBreadcrumbs([{ label: 'My Files' }]);
        } else {
          const data = await getFolderContents(folderId);
          setFolders(data.folders ?? []);
          setFiles(data.files ?? []);
          setBreadcrumbs([
            { label: 'My Files', to: '/', id: undefined },
            { label: 'Folder' },
          ]);
        }
      } catch {
        setError('Failed to load files. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [folderId, searchQuery, refreshKey]);

  useEffect(() => {
    if (newFolderMode) newFolderRef.current?.focus();
  }, [newFolderMode]);

  useEffect(() => {
    if (renamingId) renameRef.current?.focus();
  }, [renamingId]);

  useEffect(() => {
    function close() {
      setContextMenu(null);
    }
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, []);

  // All items as a flat list for shift-click range selection
  const allItems: { type: 'folder' | 'file'; id: string }[] = [
    ...folders.map((f) => ({ type: 'folder' as const, id: f.id })),
    ...files.map((f) => ({ type: 'file' as const, id: f.id })),
  ];

  const totalSelected = selectedFiles.size + selectedFolders.size;

  function toggleSelectFile(fileId: string, index: number, shiftKey: boolean) {
    if (shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newFiles = new Set(selectedFiles);
      const newFolders = new Set(selectedFolders);
      for (let i = start; i <= end; i++) {
        const item = allItems[i];
        if (item.type === 'file') newFiles.add(item.id);
        else newFolders.add(item.id);
      }
      setSelectedFiles(newFiles);
      setSelectedFolders(newFolders);
    } else {
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        if (next.has(fileId)) next.delete(fileId);
        else next.add(fileId);
        return next;
      });
    }
    setLastClickedIndex(index);
    setSelectionMode(true);
  }

  function toggleSelectFolder(folderId: string, index: number, shiftKey: boolean) {
    if (shiftKey && lastClickedIndex !== null) {
      const start = Math.min(lastClickedIndex, index);
      const end = Math.max(lastClickedIndex, index);
      const newFiles = new Set(selectedFiles);
      const newFolders = new Set(selectedFolders);
      for (let i = start; i <= end; i++) {
        const item = allItems[i];
        if (item.type === 'file') newFiles.add(item.id);
        else newFolders.add(item.id);
      }
      setSelectedFiles(newFiles);
      setSelectedFolders(newFolders);
    } else {
      setSelectedFolders((prev) => {
        const next = new Set(prev);
        if (next.has(folderId)) next.delete(folderId);
        else next.add(folderId);
        return next;
      });
    }
    setLastClickedIndex(index);
    setSelectionMode(true);
  }

  function selectAll() {
    if (totalSelected === allItems.length) {
      setSelectedFiles(new Set());
      setSelectedFolders(new Set());
      setSelectionMode(false);
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
      setSelectedFolders(new Set(folders.map((f) => f.id)));
      setSelectionMode(true);
    }
  }

  function clearSelection() {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setSelectionMode(false);
    setLastClickedIndex(null);
  }

  async function handleBulkTrash() {
    try {
      await batchTrash(Array.from(selectedFiles), Array.from(selectedFolders));
      clearSelection();
      refresh();
    } catch {
      setError('Failed to trash selected items.');
    }
  }

  async function handleBulkDownload() {
    for (const fileId of selectedFiles) {
      try {
        const url = await getDownloadUrl(fileId);
        window.open(url, '_blank');
      } catch {
        // continue with others
      }
    }
  }

  async function handleBulkToggleStar() {
    for (const fileId of selectedFiles) {
      const file = files.find((f) => f.id === fileId);
      if (!file) continue;
      try {
        if (file.is_starred) await unstarFile(fileId);
        else await starFile(fileId);
      } catch {
        // continue
      }
    }
    clearSelection();
    refresh();
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) {
      setNewFolderMode(false);
      return;
    }
    try {
      await createFolder(newFolderName.trim(), folderId);
      setNewFolderMode(false);
      setNewFolderName('');
      refresh();
    } catch {
      setError('Failed to create folder.');
    }
  }

  async function handleRenameFolder(id: string) {
    if (!renamingName.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameFolder(id, renamingName.trim());
      setRenamingId(null);
      setRenamingName('');
      refresh();
    } catch {
      setError('Failed to rename folder.');
    }
  }

  async function handleTrashFile(id: string) {
    try {
      await trashFile(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Failed to move to trash.');
    }
  }

  async function handleTrashFolder(id: string) {
    try {
      await trashFolder(id);
      setFolders((prev) => prev.filter((f) => f.id !== id));
    } catch {
      setError('Failed to move to trash.');
    }
  }

  async function handleDownload(id: string) {
    try {
      const url = await getDownloadUrl(id);
      window.open(url, '_blank');
    } catch {
      setError('Failed to get download link.');
    }
  }

  async function handleCopy(id: string) {
    try {
      await copyFile(id, folderId);
      refresh();
    } catch {
      setError('Failed to copy file.');
    }
  }

  async function handleToggleStar(file: FileItem) {
    try {
      if (file.is_starred) {
        await unstarFile(file.id);
      } else {
        await starFile(file.id);
      }
      setFiles((prev) =>
        prev.map((f) =>
          f.id === file.id ? { ...f, is_starred: !f.is_starred } : f
        )
      );
    } catch {
      setError('Failed to update star.');
    }
  }

  // Drag & drop for uploading files from desktop
  function handleFileDrop(e: ReactDragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);

    // If we're dragging an internal item, don't treat as file upload
    if (draggedItemId) return;

    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles.length > 0) {
      Array.from(droppedFiles).forEach(async (file) => {
        try {
          await uploadFile(file, folderId);
        } catch {
          // handled below
        }
      });
      setTimeout(refresh, 1500);
    }
  }

  // Drag & drop for moving files between folders
  function handleItemDragStart(e: React.DragEvent, type: 'file' | 'folder', id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setDraggedItemId(id);
    setDraggedItemType(type);

    // If multiple items selected, drag them all
    if (selectionMode && (selectedFiles.has(id) || selectedFolders.has(id))) {
      // Already selected, drag the whole selection
    } else {
      // Clear selection and select just this item
      setSelectedFiles(type === 'file' ? new Set([id]) : new Set());
      setSelectedFolders(type === 'folder' ? new Set([id]) : new Set());
    }
  }

  function handleItemDragEnd() {
    setDraggedItemId(null);
    setDraggedItemType(null);
    setDropTargetId(null);
  }

  function handleFolderDragOver(e: React.DragEvent, targetFolderId: string) {
    if (!draggedItemId) return;
    // Prevent dropping a folder onto itself
    if (draggedItemType === 'folder' && draggedItemId === targetFolderId) return;
    if (selectedFolders.has(targetFolderId)) return;

    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetId(targetFolderId);
  }

  function handleFolderDragLeave() {
    setDropTargetId(null);
  }

  async function handleFolderDrop(e: React.DragEvent, targetFolderId: string) {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    setDraggedItemId(null);
    setDraggedItemType(null);

    if (selectedFolders.has(targetFolderId)) return;

    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);

    if (fileIds.length === 0 && folderIds.length === 0) return;

    try {
      if (fileIds.length === 1 && folderIds.length === 0) {
        await moveFile(fileIds[0], targetFolderId);
      } else {
        await batchMove(fileIds, folderIds, targetFolderId);
      }
      clearSelection();
      refresh();
    } catch {
      setError('Failed to move items.');
    }
  }

  // Drop on breadcrumb (move to parent folder)
  async function handleBreadcrumbDrop(e: React.DragEvent, targetFolderId: string | undefined) {
    e.preventDefault();
    e.stopPropagation();
    setDropTargetId(null);
    setDraggedItemId(null);
    setDraggedItemType(null);

    const fileIds = Array.from(selectedFiles);
    const folderIds = Array.from(selectedFolders);

    if (fileIds.length === 0 && folderIds.length === 0) return;

    try {
      if (fileIds.length === 1 && folderIds.length === 0) {
        await moveFile(fileIds[0], targetFolderId ?? null);
      } else {
        await batchMove(fileIds, folderIds, targetFolderId ?? null);
      }
      clearSelection();
      refresh();
    } catch {
      setError('Failed to move items.');
    }
  }

  function openContextMenu(
    e: React.MouseEvent,
    type: 'file' | 'folder',
    item: FileItem | FolderItem
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, item, x: e.clientX, y: e.clientY });
  }

  function handleFileClick(file: FileItem) {
    setPreviewFile(file);
  }

  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  return (
    <Layout onRefresh={refresh} currentFolderId={folderId}>
      <div
        className={`p-6 min-h-full transition-colors dark:bg-slate-900 ${
          dragOver ? 'bg-blue-50 dark:bg-blue-950 drop-zone-active' : ''
        }`}
        onDrop={handleFileDrop}
        onDragOver={(e) => { e.preventDefault(); if (!draggedItemId) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div
            className="flex-1"
            onDragOver={(e) => { if (draggedItemId) { e.preventDefault(); setDropTargetId('breadcrumb'); } }}
            onDragLeave={() => setDropTargetId(null)}
            onDrop={(e) => handleBreadcrumbDrop(e, breadcrumbs[0]?.to === '/' ? undefined : folderId)}
          >
            <Breadcrumb crumbs={breadcrumbs} />
          </div>
          <div className="flex items-center gap-2">
            {selectionMode && (
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                title={totalSelected === allItems.length ? 'Deselect all' : 'Select all'}
              >
                {totalSelected === allItems.length ? <CheckSquare size={18} /> : <Square size={18} />}
                <span className="hidden sm:inline">
                  {totalSelected === allItems.length ? 'Deselect all' : 'Select all'}
                </span>
              </button>
            )}
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              title={viewMode === 'grid' ? 'List view' : 'Grid view'}
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid3x3 size={18} />}
            </button>
            <button
              onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              <FolderPlus size={18} />
              <span className="hidden sm:inline">New folder</span>
            </button>
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors text-sm font-medium"
            >
              <CloudUpload size={18} />
              <span className="hidden sm:inline">Upload</span>
            </button>
          </div>
        </div>

        {/* Header banner ad for free-tier users */}
        {(!user?.plan || user.plan === 'free') && <HeaderAd />}

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
            {searchQuery ? (
              <>
                <Search size={64} className="text-slate-200 dark:text-slate-700 mb-4" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No results for "{searchQuery}"</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Try a different search term</p>
              </>
            ) : (
              <>
                <Folder size={64} className="text-slate-200 dark:text-slate-700 mb-4" />
                <p className="text-lg font-medium text-slate-600 dark:text-slate-400">This folder is empty</p>
                <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                  Upload files or create a folder to get started
                </p>
                <button
                  onClick={() => setShowUpload(true)}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Upload files
                </button>
              </>
            )}
          </div>
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3'
                : 'space-y-1'
            }
          >
            {/* New folder input */}
            {newFolderMode && (
              <div
                className={
                  viewMode === 'grid'
                    ? 'flex flex-col items-center p-4 bg-white dark:bg-slate-800 border-2 border-blue-400 rounded-xl'
                    : 'flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-800 border-2 border-blue-400 rounded-xl'
                }
              >
                <Folder
                  size={viewMode === 'grid' ? 40 : 20}
                  className="text-blue-500 shrink-0"
                />
                <input
                  ref={newFolderRef}
                  type="text"
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateFolder();
                    if (e.key === 'Escape') { setNewFolderMode(false); setNewFolderName(''); }
                  }}
                  onBlur={handleCreateFolder}
                  placeholder="Folder name"
                  className="text-sm text-center w-full border-none outline-none bg-transparent text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                />
              </div>
            )}

            {/* Folders */}
            {folders.map((folder, idx) => (
              <FolderCard
                key={folder.id}
                folder={folder}
                viewMode={viewMode}
                renamingId={renamingId}
                renamingName={renamingName}
                renameRef={renameRef}
                setRenamingName={setRenamingName}
                onRename={handleRenameFolder}
                onCancelRename={() => { setRenamingId(null); setRenamingName(''); }}
                onClick={() => navigate(`/folder/${folder.id}`)}
                onContextMenu={(e) => openContextMenu(e, 'folder', folder)}
                onMenuClick={(e) => openContextMenu(e, 'folder', folder)}
                isSelected={selectedFolders.has(folder.id)}
                selectionMode={selectionMode}
                onToggleSelect={(e) => toggleSelectFolder(folder.id, idx, e.shiftKey)}
                isDropTarget={dropTargetId === folder.id}
                isDragging={draggedItemId === folder.id}
                onDragStart={(e) => handleItemDragStart(e, 'folder', folder.id)}
                onDragEnd={handleItemDragEnd}
                onDragOver={(e) => handleFolderDragOver(e, folder.id)}
                onDragLeave={handleFolderDragLeave}
                onDrop={(e) => handleFolderDrop(e, folder.id)}
              />
            ))}

            {/* Files with in-feed ads every 8 items for free users */}
            {files.map((file, index) => (
              <React.Fragment key={file.id}>
                <FileCard
                  file={file}
                  viewMode={viewMode}
                  onContextMenu={(e) => openContextMenu(e, 'file', file)}
                  onMenuClick={(e) => openContextMenu(e, 'file', file)}
                  onClick={() => handleFileClick(file)}
                  onToggleStar={() => handleToggleStar(file)}
                  isSelected={selectedFiles.has(file.id)}
                  selectionMode={selectionMode}
                  onToggleSelect={(e) => toggleSelectFile(file.id, folders.length + index, e.shiftKey)}
                  isDragging={draggedItemId === file.id}
                  onDragStart={(e) => handleItemDragStart(e, 'file', file.id)}
                  onDragEnd={handleItemDragEnd}
                />
                {(!user?.plan || user.plan === 'free') &&
                  (index + 1) % 8 === 0 &&
                  index < files.length - 1 && (
                    <div className={viewMode === 'grid' ? 'col-span-full' : ''}>
                      <InFeedAd />
                    </div>
                  )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Drag overlay hint (for file upload from desktop) */}
        {dragOver && !draggedItemId && (
          <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl text-lg font-semibold">
              Drop files to upload
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {totalSelected > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-800 dark:bg-slate-700 text-white rounded-2xl shadow-2xl px-6 py-3 flex items-center gap-4 animate-fade-in">
            <span className="text-sm font-medium">
              {totalSelected} selected
            </span>
            <div className="w-px h-5 bg-slate-600" />
            {selectedFiles.size > 0 && (
              <button
                onClick={handleBulkDownload}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title="Download selected files"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
            {selectedFiles.size > 0 && (
              <button
                onClick={handleBulkToggleStar}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
                title="Toggle star"
              >
                <Star size={16} />
                <span className="hidden sm:inline">Star</span>
              </button>
            )}
            <button
              onClick={handleBulkTrash}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition-colors"
              title="Move to trash"
            >
              <Trash2 size={16} />
              <span className="hidden sm:inline">Trash</span>
            </button>
            <div className="w-px h-5 bg-slate-600" />
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors"
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-100 dark:border-slate-700 py-1 min-w-44 animate-fade-in"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.type === 'file' ? (
            <>
              <ContextMenuItem
                icon={<Download size={15} />}
                label="Download"
                onClick={() => {
                  handleDownload(contextMenu.item.id);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                icon={<Share2 size={15} />}
                label="Share"
                onClick={() => {
                  setShareFile(contextMenu.item as FileItem);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                icon={<Copy size={15} />}
                label="Make a copy"
                onClick={() => {
                  handleCopy(contextMenu.item.id);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                icon={(contextMenu.item as FileItem).is_starred ? <StarOff size={15} /> : <Star size={15} />}
                label={(contextMenu.item as FileItem).is_starred ? 'Unstar' : 'Star'}
                onClick={() => {
                  handleToggleStar(contextMenu.item as FileItem);
                  setContextMenu(null);
                }}
              />
              <ContextMenuItem
                icon={<MessageCircle size={15} />}
                label="Comments"
                onClick={() => {
                  setCommentsFile(contextMenu.item as FileItem);
                  setContextMenu(null);
                }}
              />
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              <ContextMenuItem
                icon={<Trash2 size={15} />}
                label="Move to trash"
                danger
                onClick={() => {
                  handleTrashFile(contextMenu.item.id);
                  setContextMenu(null);
                }}
              />
            </>
          ) : (
            <>
              <ContextMenuItem
                icon={<Edit2 size={15} />}
                label="Rename"
                onClick={() => {
                  setRenamingId(contextMenu.item.id);
                  setRenamingName(contextMenu.item.name);
                  setContextMenu(null);
                }}
              />
              <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
              <ContextMenuItem
                icon={<Trash2 size={15} />}
                label="Move to trash"
                danger
                onClick={() => {
                  handleTrashFolder(contextMenu.item.id);
                  setContextMenu(null);
                }}
              />
            </>
          )}
        </div>
      )}

      {shareFile && (
        <ShareDialog
          file={shareFile}
          onClose={() => setShareFile(null)}
        />
      )}

      {commentsFile && (
        <CommentsDialog
          fileId={commentsFile.id}
          fileName={commentsFile.name}
          onClose={() => setCommentsFile(null)}
        />
      )}

      {showUpload && (
        <UploadModal
          folderId={folderId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); refresh(); }}
        />
      )}

      {previewFile && (
        <FilePreview
          file={previewFile}
          files={files}
          onClose={() => setPreviewFile(null)}
          onNavigate={(f) => setPreviewFile(f)}
        />
      )}
    </Layout>
  );
}

function ContextMenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left ${
        danger
          ? 'text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30'
          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function FolderCard({
  folder,
  viewMode,
  renamingId,
  renamingName,
  renameRef,
  setRenamingName,
  onRename,
  onCancelRename,
  onClick,
  onContextMenu,
  onMenuClick,
  isSelected,
  selectionMode,
  onToggleSelect,
  isDropTarget,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  folder: FolderItem;
  viewMode: 'grid' | 'list';
  renamingId: string | null;
  renamingName: string;
  renameRef: React.RefObject<HTMLInputElement | null>;
  setRenamingName: (v: string) => void;
  onRename: (id: string) => void;
  onCancelRename: () => void;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onMenuClick: (e: React.MouseEvent) => void;
  isSelected: boolean;
  selectionMode: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  isDropTarget: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
}) {
  const isRenaming = renamingId === folder.id;

  if (viewMode === 'list') {
    return (
      <div
        draggable={!isRenaming}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onContextMenu={onContextMenu}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer group transition-all ${
          isDropTarget
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400'
            : isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-100 dark:border-slate-700'
        } ${isDragging ? 'opacity-50' : ''}`}
        onClick={!isRenaming ? onClick : undefined}
      >
        {(selectionMode || isSelected) && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
            className="shrink-0 p-0.5"
          >
            {isSelected ? (
              <CheckSquare size={16} className="text-blue-600" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
          </button>
        )}
        <Folder size={20} className="text-blue-500 shrink-0" />
        {isRenaming ? (
          <input
            ref={renameRef}
            type="text"
            value={renamingName}
            onChange={(e) => setRenamingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename(folder.id);
              if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={() => onRename(folder.id)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 outline-none bg-transparent text-slate-800 dark:text-slate-200"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{folder.name}</span>
        )}
        <span className="text-xs text-slate-400">
          {new Date(folder.created_at).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity"
        >
          <MoreVertical size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      draggable={!isRenaming}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onContextMenu={onContextMenu}
      className={`flex flex-col items-center p-4 rounded-xl border cursor-pointer group transition-all relative ${
        isDropTarget
          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-2 ring-blue-400'
          : isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
          : 'bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-slate-750 border-slate-100 dark:border-slate-700'
      } ${isDragging ? 'opacity-50' : ''}`}
      onClick={!isRenaming ? onClick : undefined}
    >
      {(selectionMode || isSelected) && (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
          className="absolute top-2 left-2 p-0.5"
        >
          {isSelected ? (
            <CheckSquare size={14} className="text-blue-600" />
          ) : (
            <Square size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
      >
        <MoreVertical size={14} />
      </button>
      <Folder size={40} className="text-blue-500 mb-2" />
      {isRenaming ? (
        <div className="w-full" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <input
              ref={renameRef}
              type="text"
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename(folder.id);
                if (e.key === 'Escape') onCancelRename();
              }}
              className="w-full text-xs text-center border border-blue-400 rounded px-1 py-0.5 outline-none bg-transparent text-slate-800 dark:text-slate-200"
            />
            <button onClick={() => onRename(folder.id)} className="text-green-600">
              <Check size={14} />
            </button>
            <button onClick={onCancelRename} className="text-slate-400">
              <X size={14} />
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center truncate w-full leading-tight">
          {folder.name}
        </p>
      )}
    </div>
  );
}

function FileCard({
  file,
  viewMode,
  onContextMenu,
  onMenuClick,
  onClick,
  onToggleStar,
  isSelected,
  selectionMode,
  onToggleSelect,
  isDragging,
  onDragStart,
  onDragEnd,
}: {
  file: FileItem;
  viewMode: 'grid' | 'list';
  onContextMenu: (e: React.MouseEvent) => void;
  onMenuClick: (e: React.MouseEvent) => void;
  onClick: () => void;
  onToggleStar: () => void;
  isSelected: boolean;
  selectionMode: boolean;
  onToggleSelect: (e: React.MouseEvent) => void;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  if (viewMode === 'list') {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer group transition-all ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
            : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-100 dark:border-slate-700'
        } ${isDragging ? 'opacity-50' : ''}`}
        onClick={onClick}
      >
        {(selectionMode || isSelected) && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
            className="shrink-0 p-0.5"
          >
            {isSelected ? (
              <CheckSquare size={16} className="text-blue-600" />
            ) : (
              <Square size={16} className="text-slate-400" />
            )}
          </button>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className="shrink-0 p-0.5 transition-colors"
          title={file.is_starred ? 'Unstar' : 'Star'}
        >
          {file.is_starred ? (
            <Star size={16} className="text-yellow-500 fill-yellow-500" />
          ) : (
            <Star size={16} className="text-slate-300 hover:text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
        <FileIcon mimeType={file.mime_type} size={20} />
        <span className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{file.name}</span>
        <span className="text-xs text-slate-400 shrink-0">{formatBytes(file.size)}</span>
        <span className="text-xs text-slate-400 shrink-0 hidden sm:block">
          {new Date(file.created_at).toLocaleDateString()}
        </span>
        <button
          onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 transition-opacity"
        >
          <MoreVertical size={16} />
        </button>
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      className={`flex flex-col items-center p-4 rounded-xl border cursor-pointer group transition-all relative ${
        isSelected
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
          : 'bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-750 border-slate-100 dark:border-slate-700'
      } ${isDragging ? 'opacity-50' : ''}`}
      onClick={onClick}
    >
      {(selectionMode || isSelected) ? (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
          className="absolute top-2 left-2 p-0.5"
        >
          {isSelected ? (
            <CheckSquare size={14} className="text-blue-600" />
          ) : (
            <Square size={14} className="text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className="absolute top-2 left-2 p-0.5 transition-colors"
          title={file.is_starred ? 'Unstar' : 'Star'}
        >
          {file.is_starred ? (
            <Star size={14} className="text-yellow-500 fill-yellow-500" />
          ) : (
            <Star size={14} className="text-slate-300 hover:text-yellow-500 opacity-0 group-hover:opacity-100 transition-all" />
          )}
        </button>
      )}
      <button
        onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
      >
        <MoreVertical size={14} />
      </button>
      <FileIcon mimeType={file.mime_type} size={40} className="mb-2" />
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center truncate w-full leading-tight">
        {file.name}
      </p>
      <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
    </div>
  );
}
