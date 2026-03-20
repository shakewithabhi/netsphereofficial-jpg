import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
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
  Link2,
  Search,
  Star,
  StarOff,
  MessageCircle,
  CheckSquare,
  Square,
  Move,
  ArrowUpDown,
  ChevronDown,
  Compass,
  ExternalLink,
} from 'lucide-react';
import {
  getRootContents,
  getFolderContents,
  createFolder,
  renameFolder,
  renameFile,
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
import { createPost, CATEGORIES } from '../api/explore';
import { trackDownload } from '../utils/downloadHistory';
import type { FolderItem, FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';
import { ShareDialog } from '../components/ShareDialog';
import { UploadModal } from '../components/UploadModal';
import { RemoteUploadModal } from '../components/RemoteUploadModal';
import { CommentsDialog } from '../components/CommentsDialog';
import { FilePreview } from '../components/FilePreview';
import { HeaderAd, InFeedAd } from '../components/AdBanner';
import { useAuth } from '../store/auth';

interface BreadcrumbItem {
  label: string;
  to?: string;
  id?: string;
}

type SortOption =
  | 'name-asc'
  | 'name-desc'
  | 'date-newest'
  | 'date-oldest'
  | 'size-largest'
  | 'size-smallest'
  | 'type';

const SORT_LABELS: Record<SortOption, string> = {
  'name-asc': 'Name (A-Z)',
  'name-desc': 'Name (Z-A)',
  'date-newest': 'Date (Newest)',
  'date-oldest': 'Date (Oldest)',
  'size-largest': 'Size (Largest)',
  'size-smallest': 'Size (Smallest)',
  type: 'Type',
};

export default function Files() {
  const { user } = useAuth();
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') ?? '';
  const categoryFilter = searchParams.get('category') ?? '';

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
  const [exploreFile, setExploreFile] = useState<FileItem | null>(null);
  const [exploreCaption, setExploreCaption] = useState('');
  const [exploreCategory, setExploreCategory] = useState('Entertainment');
  const [explorePosting, setExplorePosting] = useState(false);
  const [exploreError, setExploreError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [showRemoteUpload, setShowRemoteUpload] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const newFolderRef = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);

  // Sort state
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // File Preview state
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);

  // Bulk selection state
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [selectedFolders, setSelectedFolders] = useState<Set<string>>(new Set());
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);

  // Bulk operation loading state
  const [bulkLoading, setBulkLoading] = useState(false);

  // Drag & drop move state
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [draggedItemType, setDraggedItemType] = useState<'file' | 'folder' | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Close sort menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Sorted folders and files (folders always first)
  const sortedFolders = useMemo(() => {
    const sorted = [...folders];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
        break;
      case 'date-newest':
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'date-oldest':
        sorted.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        break;
      // Folders have no size or type distinction, fall back to name
      case 'size-largest':
      case 'size-smallest':
      case 'type':
        sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        break;
    }
    return sorted;
  }, [folders, sortBy]);

  const sortedFiles = useMemo(() => {
    const sorted = [...files];
    switch (sortBy) {
      case 'name-asc':
        sorted.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        break;
      case 'name-desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name, undefined, { sensitivity: 'base' }));
        break;
      case 'date-newest':
        sorted.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case 'date-oldest':
        sorted.sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        break;
      case 'size-largest':
        sorted.sort((a, b) => b.size - a.size);
        break;
      case 'size-smallest':
        sorted.sort((a, b) => a.size - b.size);
        break;
      case 'type':
        sorted.sort((a, b) => a.mime_type.localeCompare(b.mime_type) || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        break;
    }
    return sorted;
  }, [files, sortBy]);

  // Clear selection when navigating
  useEffect(() => {
    setSelectedFiles(new Set());
    setSelectedFolders(new Set());
    setSelectionMode(false);
    setLastClickedIndex(null);
  }, [folderId, searchQuery, categoryFilter]);

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
        } else if (categoryFilter) {
          // Load all files and filter by category
          const data = await getRootContents();
          setFolders([]);
          const categoryMap: Record<string, string[]> = {
            image: ['image/'],
            video: ['video/'],
            audio: ['audio/'],
            document: ['application/pdf', 'application/msword', 'application/vnd', 'text/'],
            other: [],
          };
          const prefixes = categoryMap[categoryFilter] ?? [];
          const filtered = (data.files ?? []).filter((f: FileItem) => {
            if (categoryFilter === 'other') {
              return !['image/', 'video/', 'audio/', 'application/pdf', 'application/msword', 'application/vnd', 'text/'].some(
                (p) => f.mime_type.startsWith(p)
              );
            }
            return prefixes.some((p) => f.mime_type.startsWith(p));
          });
          setFiles(filtered);
          const labels: Record<string, string> = { image: 'Pictures', video: 'Videos', audio: 'Music', document: 'Documents', other: 'Other' };
          setBreadcrumbs([
            { label: 'My Files', to: '/' },
            { label: labels[categoryFilter] ?? categoryFilter },
          ]);
        } else if (!folderId) {
          const data = await getRootContents();
          setFolders(data.folders ?? []);
          setFiles(data.files ?? []);
          setBreadcrumbs([{ label: 'All Files' }]);
        } else {
          const data = await getFolderContents(folderId);
          setFolders(data.folders ?? []);
          setFiles(data.files ?? []);
          setBreadcrumbs([
            { label: 'All Files', to: '/', id: undefined },
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

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't fire shortcuts when typing in an input/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      if (e.key === 'Escape') {
        clearSelection();
        setContextMenu(null);
        setRenamingId(null);
        return;
      }

      if (e.ctrlKey && e.key === 'a') {
        e.preventDefault();
        selectAll();
        return;
      }

      if (e.key === 'Delete') {
        if (totalSelected > 0) {
          handleBulkTrash();
        }
        return;
      }

      if (e.key === 'F2') {
        e.preventDefault();
        // Rename first selected item
        if (selectedFolders.size > 0) {
          const id = Array.from(selectedFolders)[0];
          const folder = folders.find((f) => f.id === id);
          if (folder) { setRenamingId(id); setRenamingName(folder.name); }
        } else if (selectedFiles.size > 0) {
          const id = Array.from(selectedFiles)[0];
          const file = files.find((f) => f.id === id);
          if (file) { setRenamingId(id); setRenamingName(file.name); }
        }
        return;
      }

      if (e.key === 'Enter') {
        if (selectedFiles.size > 0) {
          const id = Array.from(selectedFiles)[0];
          const file = files.find((f) => f.id === id);
          if (file) setPreviewFile(file);
        }
        return;
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [folders, files, selectedFiles, selectedFolders, totalSelected]);

  // All items as a flat list for shift-click range selection
  const allItems: { type: 'folder' | 'file'; id: string }[] = [
    ...sortedFolders.map((f) => ({ type: 'folder' as const, id: f.id })),
    ...sortedFiles.map((f) => ({ type: 'file' as const, id: f.id })),
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
    setBulkLoading(true);
    try {
      await batchTrash(Array.from(selectedFiles), Array.from(selectedFolders));
      clearSelection();
      refresh();
    } catch {
      setError('Failed to trash selected items.');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkDownload() {
    setBulkLoading(true);
    try {
      for (const fileId of selectedFiles) {
        try {
          const url = await getDownloadUrl(fileId);
          window.open(url, '_blank');
        } catch {
          // continue with others
        }
      }
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleBulkToggleStar() {
    setBulkLoading(true);
    try {
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
    } finally {
      setBulkLoading(false);
    }
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

  async function handleRenameFile(id: string) {
    if (!renamingName.trim()) {
      setRenamingId(null);
      return;
    }
    try {
      await renameFile(id, renamingName.trim());
      setRenamingId(null);
      setRenamingName('');
      refresh();
    } catch {
      setError('Failed to rename file.');
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
      const file = files.find((f) => f.id === id);
      if (file) {
        trackDownload({ id: file.id, name: file.name, size: file.size, mime_type: file.mime_type });
      }
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
        className={`p-6 min-h-full h-full transition-colors bg-slate-50 dark:bg-slate-900 ${
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
            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                title="Sort files"
              >
                <ArrowUpDown size={16} />
                <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 py-1">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => { setSortBy(option); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sortBy === option
                          ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      {SORT_LABELS[option]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
            >
              <FolderPlus size={18} />
              <span className="hidden sm:inline">New folder</span>
            </button>
            <button
              onClick={() => setShowRemoteUpload(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
              title="Upload from URL"
            >
              <Link2 size={18} />
              <span className="hidden sm:inline">URL</span>
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
            {sortedFolders.map((folder, idx) => (
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
            {sortedFiles.map((file, index) => (
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
                  onToggleSelect={(e) => toggleSelectFile(file.id, sortedFolders.length + index, e.shiftKey)}
                  isDragging={draggedItemId === file.id}
                  onDragStart={(e) => handleItemDragStart(e, 'file', file.id)}
                  onDragEnd={handleItemDragEnd}
                />
                {(!user?.plan || user.plan === 'free') &&
                  (index + 1) % 8 === 0 &&
                  index < sortedFiles.length - 1 && (
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
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Download selected files"
              >
                <Download size={16} />
                <span className="hidden sm:inline">Download</span>
              </button>
            )}
            {selectedFiles.size > 0 && (
              <button
                onClick={handleBulkToggleStar}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-700 dark:hover:bg-slate-600 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Toggle star"
              >
                <Star size={16} />
                <span className="hidden sm:inline">Star</span>
              </button>
            )}
            <button
              onClick={handleBulkTrash}
              disabled={bulkLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              {(contextMenu.item as FileItem).mime_type?.startsWith('video/') && (
                <ContextMenuItem
                  icon={<Compass size={15} />}
                  label="Share to Explore"
                  onClick={() => {
                    setExploreFile(contextMenu.item as FileItem);
                    setExploreCaption('');
                    setExploreCategory('Entertainment');
                    setExploreError('');
                    setContextMenu(null);
                  }}
                />
              )}
              <ContextMenuItem
                icon={<ExternalLink size={15} />}
                label="Share via..."
                onClick={async () => {
                  const file = contextMenu.item as FileItem;
                  const shareUrl = `${window.location.origin}/s/${file.id}`;
                  if (navigator.share) {
                    try {
                      await navigator.share({ title: file.name, text: `Check out ${file.name} on ByteBox`, url: shareUrl });
                    } catch { /* user cancelled */ }
                  } else if (navigator.clipboard) {
                    await navigator.clipboard.writeText(shareUrl);
                    setError('');
                  }
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

      {/* Share to Explore Modal */}
      {exploreFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setExploreFile(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                  <Compass size={16} className="text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">Share to Explore</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[200px]">{exploreFile.name}</p>
                </div>
              </div>
              <button
                onClick={() => setExploreFile(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Caption</label>
                <textarea
                  value={exploreCaption}
                  onChange={(e) => setExploreCaption(e.target.value)}
                  placeholder="Write a caption for your post..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{exploreCaption.length}/500</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                <select
                  value={exploreCategory}
                  onChange={(e) => setExploreCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              {exploreError && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-lg">{exploreError}</p>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <button
                onClick={() => setExploreFile(null)}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!exploreFile || !exploreCaption.trim()) return;
                  setExplorePosting(true);
                  setExploreError('');
                  try {
                    await createPost(exploreFile.id, exploreCaption.trim(), exploreCategory, []);
                    setExploreFile(null);
                  } catch {
                    setExploreError('Failed to post. Please try again.');
                  }
                  setExplorePosting(false);
                }}
                disabled={explorePosting || !exploreCaption.trim()}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                {explorePosting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Posting...
                  </>
                ) : (
                  <>
                    <Compass size={16} />
                    Post to Explore
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUpload && (
        <UploadModal
          folderId={folderId}
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); refresh(); }}
        />
      )}

      {showRemoteUpload && (
        <RemoteUploadModal
          folderId={folderId}
          onClose={() => setShowRemoteUpload(false)}
          onUploaded={() => { setShowRemoteUpload(false); refresh(); }}
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
        onClick={!isRenaming ? (e: React.MouseEvent) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            onToggleSelect(e);
          } else if (selectionMode) {
            onToggleSelect(e);
          } else {
            onClick?.();
          }
        } : undefined}
      >
        {(selectionMode || isSelected) ? (
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
        ) : null}
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
      onClick={!isRenaming ? (e: React.MouseEvent) => {
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          onToggleSelect(e);
        } else if (selectionMode) {
          onToggleSelect(e);
        } else {
          onClick?.();
        }
      } : undefined}
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
      ) : null}
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

// Thumbnail cache to avoid refetching URLs
const thumbnailCache = new Map<string, string>();

function FileThumbnail({
  file,
  size,
  className = '',
}: {
  file: FileItem;
  size: 'small' | 'large';
  className?: string;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(
    thumbnailCache.get(file.id) ?? null
  );
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);
  const isImage = file.mime_type.startsWith('image/');

  useEffect(() => {
    if (!isImage || thumbnailCache.has(file.id)) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          getDownloadUrl(file.id)
            .then((url) => { if (!cancelled) { thumbnailCache.set(file.id, url); setThumbUrl(url); } })
            .catch(() => { if (!cancelled) setError(true); });
          observer.disconnect();
        }
      },
      { rootMargin: '100px' }
    );
    if (imgRef.current) observer.observe(imgRef.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [file.id, isImage]);

  if (!isImage || error) {
    return <FileIcon mimeType={file.mime_type} size={size === 'large' ? 40 : 20} className={className} />;
  }

  return (
    <div ref={imgRef} className={`${size === 'small' ? 'shrink-0 w-10 h-10' : 'w-full h-24 mb-2'} rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-700 flex items-center justify-center`}>
      {thumbUrl ? (
        <img src={thumbUrl} alt={file.name} loading="lazy"
          onError={() => setError(true)} onLoad={() => setLoaded(true)}
          className={`w-full h-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`} />
      ) : (
        <FileIcon mimeType={file.mime_type} size={size === 'large' ? 24 : 16} />
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
  const isImage = file.mime_type.startsWith('image/');

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
        onClick={(e: React.MouseEvent) => { e.preventDefault(); onToggleSelect(e); }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
          className="shrink-0 p-0.5"
        >
          {isSelected ? (
            <CheckSquare size={16} className="text-blue-600" />
          ) : (
            <Square size={16} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
          )}
        </button>
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
        {isImage ? (
          <FileThumbnail file={file} size="small" />
        ) : (
          <FileIcon mimeType={file.mime_type} size={20} />
        )}
        <span
          className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >{file.name}</span>
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
      onClick={(e: React.MouseEvent) => { e.preventDefault(); onToggleSelect(e); }}
      onDoubleClick={() => onClick()}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
        className="absolute top-2 left-2 p-0.5 z-10"
      >
        {isSelected ? (
          <CheckSquare size={14} className="text-blue-600" />
        ) : (
          <Square size={14} className="text-slate-400 group-hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
        className="absolute top-2 right-8 p-0.5 transition-colors z-10"
        title={file.is_starred ? 'Unstar' : 'Star'}
      >
        {file.is_starred ? (
          <Star size={14} className="text-yellow-500 fill-yellow-500" />
        ) : (
          <Star size={14} className="text-slate-300 hover:text-yellow-500 opacity-0 group-hover:opacity-100 transition-all" />
        )}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-all z-10"
      >
        <MoreVertical size={14} />
      </button>
      {isImage ? (
        <FileThumbnail file={file} size="large" />
      ) : (
        <FileIcon mimeType={file.mime_type} size={40} className="mb-2" />
      )}
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300 text-center truncate w-full leading-tight">
        {file.name}
      </p>
      <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
    </div>
  );
}
