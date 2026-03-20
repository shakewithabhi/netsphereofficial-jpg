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
  Play,
  AudioWaveform,
  FileText as FileTextIcon,
  Eye,
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
  listByCategory,
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
import { ContextMenu } from '../components/ContextMenu';
import type { ContextMenuItem as ContextMenuItemType } from '../components/ContextMenu';
import { HeaderAd, InFeedAd } from '../components/AdBanner';
import { FileGridSkeleton, FileListSkeletonGroup } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';
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
  const [moveFileId, setMoveFileId] = useState<string | null>(null);
  const [moveFolders, setMoveFolders] = useState<FolderItem[]>([]);
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
          // Use backend category endpoint to get all files of this type
          const categoryApiMap: Record<string, string> = {
            image: 'images',
            video: 'videos',
            audio: 'audio',
            document: 'documents',
          };
          const apiCategory = categoryApiMap[categoryFilter];
          setFolders([]);
          if (apiCategory) {
            const data = await listByCategory(apiCategory);
            setFiles(data.files ?? []);
          } else {
            // "other" — fallback to root filter
            const allData = await getRootContents();
            setFiles((allData.files ?? []).filter((f: FileItem) =>
              !['image/', 'video/', 'audio/', 'application/pdf', 'application/msword', 'application/vnd', 'text/'].some(
                (p) => f.mime_type.startsWith(p)
              )
            ));
          }
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
  }, [folderId, searchQuery, categoryFilter, refreshKey]);

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

  const totalSelected = selectedFiles.size + selectedFolders.size;

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

  const downloadCountRef = useRef(0);
  const [adOverlay, setAdOverlay] = useState<{ url: string; countdown: number } | null>(null);

  async function handleDownload(id: string) {
    try {
      const url = await getDownloadUrl(id);
      const file = files.find((f) => f.id === id);
      if (file) {
        trackDownload({ id: file.id, name: file.name, size: file.size, mime_type: file.mime_type });
      }
      downloadCountRef.current += 1;
      const isPaid = user?.plan && user.plan !== 'free';
      // Show ad overlay every 3rd download for free users
      if (!isPaid && downloadCountRef.current % 3 === 0) {
        setAdOverlay({ url, countdown: 5 });
      } else {
        window.open(url, '_blank');
      }
    } catch {
      setError('Failed to get download link.');
    }
  }

  // Ad countdown timer
  useEffect(() => {
    if (!adOverlay || adOverlay.countdown <= 0) return;
    const timer = setTimeout(() => {
      setAdOverlay((prev) => prev ? { ...prev, countdown: prev.countdown - 1 } : null);
    }, 1000);
    return () => clearTimeout(timer);
  }, [adOverlay]);

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
        className={`p-6 min-h-full h-full transition-colors bg-slate-50 dark:bg-[#0B0F19] ${
          dragOver ? 'bg-blue-50 dark:bg-blue-950 drop-zone-active' : ''
        }`}
        onDrop={handleFileDrop}
        onDragOver={(e) => { e.preventDefault(); if (!draggedItemId) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {/* Breadcrumb */}
        <div
          className="mb-4"
          onDragOver={(e) => { if (draggedItemId) { e.preventDefault(); setDropTargetId('breadcrumb'); } }}
          onDragLeave={() => setDropTargetId(null)}
          onDrop={(e) => handleBreadcrumbDrop(e, breadcrumbs[0]?.to === '/' ? undefined : folderId)}
        >
          <Breadcrumb crumbs={breadcrumbs} />
        </div>

        {/* Quick Access */}
        {!folderId && !searchQuery && !categoryFilter && files.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Quick Access</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {files.slice(0, 4).map((file, i) => (
                <button
                  key={file.id}
                  onClick={() => setPreviewFile(file)}
                  className="quick-access-card card-lift-enter flex items-center gap-3 p-3 bg-white dark:bg-[#111118] rounded-xl border border-gray-100 dark:border-white/[0.06] text-left"
                  style={{ animationDelay: `${i * 50}ms` }}
                >
                  <FileIcon mimeType={file.mime_type} size={20} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{formatBytes(file.size)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content area header - TeraBox style: action buttons left, controls right */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-blue-500 hover:from-violet-700 hover:to-blue-600 text-white transition-colors text-sm font-medium shadow-sm"
            >
              <CloudUpload size={18} />
              <span>Upload</span>
            </button>
            <button
              onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-violet-50/50 hover:border-violet-300 hover:text-violet-600 dark:hover:bg-white/[0.08] transition-all duration-200 text-sm font-medium bg-white dark:bg-[#0F172A]"
            >
              <FolderPlus size={18} />
              <span>New Folder</span>
            </button>
            <button
              onClick={() => setShowRemoteUpload(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-gray-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:bg-violet-50/50 hover:border-violet-300 hover:text-violet-600 dark:hover:bg-white/[0.08] transition-all duration-200 text-sm font-medium bg-white dark:bg-[#0F172A]"
              title="Upload from URL"
            >
              <Link2 size={18} />
              <span className="hidden sm:inline">URL</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            {selectionMode && (
              <button
                onClick={selectAll}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-white/[0.08] transition-colors text-sm font-medium"
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
              className="p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
              title={viewMode === 'grid' ? 'List view' : 'Grid view'}
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid3x3 size={18} />}
            </button>
            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setShowSortMenu((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 dark:text-slate-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-white/[0.08] transition-colors text-sm font-medium"
                title="Sort files"
              >
                <ArrowUpDown size={16} />
                <span className="hidden sm:inline">{SORT_LABELS[sortBy]}</span>
                <ChevronDown size={14} className={`transition-transform ${showSortMenu ? 'rotate-180' : ''}`} />
              </button>
              {showSortMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/[0.05] rounded-lg shadow-lg z-30 py-1">
                  {(Object.keys(SORT_LABELS) as SortOption[]).map((option) => (
                    <button
                      key={option}
                      onClick={() => { setSortBy(option); setShowSortMenu(false); }}
                      className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                        sortBy === option
                          ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 font-medium'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/[0.08]'
                      }`}
                    >
                      {SORT_LABELS[option]}
                    </button>
                  ))}
                </div>
              )}
            </div>
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
          viewMode === 'grid' ? <FileGridSkeleton /> : <FileListSkeletonGroup />
        ) : isEmpty ? (
          searchQuery ? (
            <EmptyState type="search" />
          ) : (
            <EmptyState type="files" onAction={() => setShowUpload(true)} />
          )
        ) : (
          <div
            className={
              viewMode === 'grid'
                ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4'
                : 'space-y-1'
            }
          >
            {/* New folder input */}
            {newFolderMode && (
              <div
                className={
                  viewMode === 'grid'
                    ? 'flex flex-col items-center p-4 bg-white dark:bg-[#0F172A] border-2 border-blue-400 rounded-xl'
                    : 'flex items-center gap-3 px-4 py-3 bg-white dark:bg-[#0F172A] border-2 border-blue-400 rounded-xl'
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
                animIndex={idx}
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
                  animIndex={sortedFolders.length + index}
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
                  renamingId={renamingId}
                  renamingName={renamingName}
                  renameRef={renameRef}
                  setRenamingName={setRenamingName}
                  onRename={handleRenameFile}
                  onCancelRename={() => { setRenamingId(null); setRenamingName(''); }}
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
          <div className="drop-overlay pointer-events-none">
            <div className="bg-gradient-to-r from-violet-600 to-blue-500 text-white px-8 py-4 rounded-2xl shadow-2xl shadow-violet-500/30 text-lg font-semibold">
              Drop files to upload
            </div>
          </div>
        )}

        {/* Bulk action bar */}
        {totalSelected > 0 && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#18181b] dark:bg-[#1e1e2e] backdrop-blur-xl border border-white/[0.06] shadow-2xl shadow-black/20 text-white rounded-2xl px-6 py-3 flex items-center gap-4 animate-fade-in">
            <span className="text-sm font-medium">
              {totalSelected} selected
            </span>
            <div className="w-px h-5 bg-slate-600" />
            {selectedFiles.size > 0 && (
              <button
                onClick={handleBulkDownload}
                disabled={bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-700 dark:hover:bg-[#2a3654] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm hover:bg-slate-700 dark:hover:bg-[#2a3654] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              className="p-1.5 hover:bg-slate-700 dark:hover:bg-[#2a3654] rounded-lg transition-colors"
              title="Clear selection"
            >
              <X size={16} />
            </button>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={contextMenu.type === 'file' ? [
            { label: 'Open', icon: Eye, onClick: () => handleFileClick(contextMenu.item as FileItem) },
            { label: 'Download', icon: Download, onClick: () => handleDownload(contextMenu.item.id) },
            { label: 'Share', icon: Share2, onClick: () => setShareFile(contextMenu.item as FileItem) },
            { label: 'Rename', icon: Edit2, onClick: () => { setRenamingId(contextMenu.item.id); setRenamingName(contextMenu.item.name); } },
            { label: 'Move to', icon: Move, onClick: () => { setMoveFileId(contextMenu.item.id); getRootContents().then(r => setMoveFolders((r as any).folders || [])).catch(() => {}); } },
            { label: (contextMenu.item as FileItem).is_starred ? 'Unstar' : 'Star', icon: (contextMenu.item as FileItem).is_starred ? StarOff : Star, onClick: () => handleToggleStar(contextMenu.item as FileItem) },
            { label: 'Move to Trash', icon: Trash2, onClick: () => handleTrashFile(contextMenu.item.id), danger: true, divider: true },
          ] as ContextMenuItemType[] : [
            { label: 'Rename', icon: Edit2, onClick: () => { setRenamingId(contextMenu.item.id); setRenamingName(contextMenu.item.name); } },
            { label: 'Move to Trash', icon: Trash2, onClick: () => handleTrashFolder(contextMenu.item.id), danger: true, divider: true },
          ] as ContextMenuItemType[]}
        />
      )}

      {/* Move File Dialog */}
      {moveFileId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMoveFileId(null)} />
          <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Move to folder</h3>
              <button onClick={() => setMoveFileId(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X size={16} />
              </button>
            </div>
            <div className="p-4 max-h-60 overflow-y-auto space-y-1">
              <button
                onClick={async () => {
                  try { await moveFile(moveFileId, undefined); refresh(); setMoveFileId(null); } catch { setError('Failed to move file.'); }
                }}
                className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-left transition-colors"
              >
                <Folder size={18} className="text-blue-500" />
                <span className="text-sm text-slate-700 dark:text-slate-200">Root (My Files)</span>
              </button>
              {moveFolders.map((f) => (
                <button
                  key={f.id}
                  onClick={async () => {
                    try { await moveFile(moveFileId, f.id); refresh(); setMoveFileId(null); } catch { setError('Failed to move file.'); }
                  }}
                  className="flex items-center gap-3 w-full px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-left transition-colors"
                >
                  <Folder size={18} className="text-yellow-500" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">{f.name}</span>
                </button>
              ))}
              {moveFolders.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">No folders found. Create a folder first.</p>
              )}
            </div>
          </div>
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
          <div className="relative w-full max-w-md bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.05]">
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
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
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
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{exploreCaption.length}/500</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category</label>
                <select
                  value={exploreCategory}
                  onChange={(e) => setExploreCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
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
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0F172A]/50">
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

      {/* Download Ad Overlay */}
      {adOverlay && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="p-6 text-center">
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Your download will start shortly</p>
              <div className="my-4 min-h-[100px] flex items-center justify-center bg-slate-100 dark:bg-[#1E293B] rounded-lg text-xs text-slate-400">
                Advertisement
              </div>
              {adOverlay.countdown > 0 ? (
                <button disabled className="w-full py-2.5 rounded-xl bg-slate-200 dark:bg-white/[0.1] text-slate-500 dark:text-slate-400 font-medium">
                  Download in {adOverlay.countdown}s
                </button>
              ) : (
                <button
                  onClick={() => { window.open(adOverlay.url, '_blank'); setAdOverlay(null); }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
                >
                  Download Now
                </button>
              )}
            </div>
            <button
              onClick={() => setAdOverlay(null)}
              className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 border-t border-slate-100 dark:border-white/[0.05]"
            >
              Cancel
            </button>
          </div>
        </div>
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

function FolderCard({
  folder,
  viewMode,
  animIndex = 0,
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
  animIndex?: number;
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
  const animDelay = `${Math.min(animIndex * 20, 200)}ms`;

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
        className={`file-card-enter flex items-center gap-3 px-4 py-2.5 rounded-xl border cursor-pointer group transition-colors duration-150 ${
          isDropTarget
            ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 ring-2 ring-violet-400'
            : isSelected
            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 ring-2 ring-violet-500/50 dark:ring-violet-400/50'
            : 'bg-white dark:bg-[#0F172A] hover:bg-violet-50/30 dark:hover:bg-white/[0.08] border-gray-100 dark:border-white/[0.05]'
        } ${isDragging ? 'opacity-50' : ''}`}
        style={{ animationDelay: animDelay }}
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
      className={`file-card-enter flex flex-col items-center p-4 rounded-2xl border cursor-pointer group transition-all duration-200 relative ${
        isDropTarget
          ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/30 ring-2 ring-violet-400'
          : isSelected
          ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 ring-2 ring-violet-500/50 dark:ring-violet-400/50'
          : 'bg-white dark:bg-[#0F172A] hover:bg-violet-50/30 dark:hover:bg-white/[0.08] border-gray-100 dark:border-white/[0.06] hover:shadow-md hover:-translate-y-0.5 dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{ animationDelay: animDelay }}
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
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all"
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
  const isVideo = file.mime_type.startsWith('video/');
  const isPreviewable = isImage || isVideo;

  useEffect(() => {
    if (!isPreviewable || thumbnailCache.has(file.id)) return;
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
  }, [file.id, isPreviewable]);

  if (!isPreviewable || error) {
    return <FileIcon mimeType={file.mime_type} size={size === 'large' ? 40 : 20} className={className} />;
  }

  return (
    <div ref={imgRef} className={`${size === 'small' ? 'shrink-0 w-10 h-10' : 'w-full h-24 mb-2'} rounded-lg overflow-hidden bg-slate-100 dark:bg-[#1E293B] flex items-center justify-center relative`}>
      {thumbUrl ? (
        isVideo ? (
          <>
            <video src={thumbUrl + '#t=1'} preload="metadata" muted playsInline
              onLoadedData={() => setLoaded(true)}
              className={`w-full h-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`} />
            {loaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 bg-black/50 backdrop-blur-sm rounded-full flex items-center justify-center">
                  <Play size={14} className="text-white ml-0.5" />
                </div>
              </div>
            )}
          </>
        ) : (
          <img src={thumbUrl} alt={file.name} loading="lazy"
            onError={() => setError(true)} onLoad={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-opacity ${loaded ? 'opacity-100' : 'opacity-0'}`} />
        )
      ) : (
        <FileIcon mimeType={file.mime_type} size={size === 'large' ? 24 : 16} />
      )}
    </div>
  );
}

function FileCard({
  file,
  viewMode,
  animIndex = 0,
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
  renamingId,
  renamingName,
  renameRef,
  setRenamingName,
  onRename,
  onCancelRename,
}: {
  file: FileItem;
  viewMode: 'grid' | 'list';
  animIndex?: number;
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
  renamingId: string | null;
  renamingName: string;
  renameRef: React.RefObject<HTMLInputElement | null>;
  setRenamingName: (v: string) => void;
  onRename: (id: string) => void;
  onCancelRename: () => void;
}) {
  const isImage = file.mime_type.startsWith('image/');
  const isVideo = file.mime_type.startsWith('video/');
  const isAudio = file.mime_type.startsWith('audio/');
  const isPdf = file.mime_type === 'application/pdf';
  const isRenaming = renamingId === file.id;
  const animDelay = `${Math.min(animIndex * 20, 200)}ms`;
  const [hovered, setHovered] = useState(false);
  const [showHoverInfo, setShowHoverInfo] = useState(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fileExt = file.name.includes('.') ? file.name.split('.').pop()?.toUpperCase() ?? '' : '';

  function handleMouseEnter() {
    setHovered(true);
    hoverTimerRef.current = setTimeout(() => setShowHoverInfo(true), 200);
  }
  function handleMouseLeave() {
    setHovered(false);
    setShowHoverInfo(false);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }

  if (viewMode === 'list') {
    return (
      <div
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onContextMenu={onContextMenu}
        className={`file-card-enter flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer group transition-colors duration-150 ${
          isSelected
            ? 'bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-700 ring-2 ring-violet-500/50 dark:ring-violet-400/50'
            : 'bg-white dark:bg-[#0F172A] hover:bg-violet-50/30 dark:hover:bg-white/[0.08] border-gray-100 dark:border-white/[0.05]'
        } ${isDragging ? 'opacity-50' : ''}`}
        style={{ animationDelay: animDelay }}
        onClick={(e: React.MouseEvent) => { e.preventDefault(); onToggleSelect(e); }}
      >
        <button
          onClick={(e) => { e.stopPropagation(); onToggleSelect(e); }}
          className="shrink-0 p-0.5"
        >
          {isSelected ? (
            <CheckSquare size={18} className="text-blue-600" />
          ) : (
            <Square size={18} className="text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" />
          )}
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleStar(); }}
          className="shrink-0 p-0.5 transition-colors"
          title={file.is_starred ? 'Unstar' : 'Star'}
        >
          {file.is_starred ? (
            <Star size={18} className="text-yellow-500 fill-yellow-500" />
          ) : (
            <Star size={18} className="text-slate-300 hover:text-yellow-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          )}
        </button>
        {(isImage || isVideo) ? (
          <FileThumbnail file={file} size="small" />
        ) : (
          <FileIcon mimeType={file.mime_type} size={20} />
        )}
        {isRenaming ? (
          <input
            ref={renameRef}
            type="text"
            value={renamingName}
            onChange={(e) => setRenamingName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRename(file.id);
              if (e.key === 'Escape') onCancelRename();
            }}
            onBlur={() => onRename(file.id)}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 outline-none bg-transparent text-slate-800 dark:text-slate-200"
          />
        ) : (
          <span
            className="flex-1 text-sm font-medium text-slate-800 dark:text-slate-200 truncate hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >{file.name}</span>
        )}
        {fileExt && (
          <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold uppercase bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded">
            {fileExt}
          </span>
        )}
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

  // Determine thumbnail background color based on file type
  const thumbBgColor = isVideo ? 'bg-slate-200 dark:bg-[#1E293B]'
    : isAudio ? 'bg-slate-100 dark:bg-[#1E293B]'
    : isPdf ? 'bg-slate-100 dark:bg-[#1E293B]'
    : 'bg-slate-100 dark:bg-[#1E293B]';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onContextMenu={onContextMenu}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={`file-card-enter flex flex-col rounded-2xl cursor-pointer group transition-all duration-200 relative overflow-hidden ${
        isSelected
          ? 'bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 ring-2 ring-violet-500/50 dark:ring-violet-400/50'
          : 'bg-white dark:bg-[#0F172A] hover:bg-violet-50/30 dark:hover:bg-white/[0.08] shadow-sm hover:shadow-md border border-gray-100 dark:border-white/[0.06] hover:border-violet-200/60 dark:hover:border-violet-500/20 hover:shadow-xl hover:shadow-violet-500/[0.07] dark:hover:shadow-violet-500/[0.15] hover:-translate-y-0.5 dark:hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]'
      } ${isDragging ? 'opacity-50' : ''}`}
      style={{ animationDelay: animDelay }}
      onClick={(e: React.MouseEvent) => { e.preventDefault(); onToggleSelect(e); }}
      onDoubleClick={() => onClick()}
    >
      {/* Thumbnail area */}
      <div className={`relative w-full flex items-center justify-center ${thumbBgColor}`} style={{ aspectRatio: '1' }}>
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
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-white/70 dark:hover:bg-white/[0.08] transition-all z-10"
        >
          <MoreVertical size={14} />
        </button>

        {isImage ? (
          <FileThumbnail file={file} size="large" className="w-full h-full" />
        ) : isVideo ? (
          <div className="relative flex items-center justify-center w-full h-full">
            <FileIcon mimeType={file.mime_type} size={40} />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-white/90 dark:bg-white/[0.15] dark:backdrop-blur-md backdrop-blur-sm flex items-center justify-center shadow-lg">
                <Play size={20} className="text-slate-700 dark:text-white ml-0.5" fill="currentColor" />
              </div>
            </div>
          </div>
        ) : isAudio ? (
          <div className="flex flex-col items-center justify-center gap-1">
            <AudioWaveform size={36} className="text-pink-500" />
            {fileExt && <span className="text-xs font-semibold text-pink-500">{fileExt}</span>}
          </div>
        ) : isPdf ? (
          <FileTextIcon size={40} className="text-red-600" />
        ) : (
          <FileIcon mimeType={file.mime_type} size={40} />
        )}

        {/* File extension badge */}
        {fileExt && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-white/90 dark:bg-white/[0.12] text-slate-600 dark:text-white/90 backdrop-blur-md z-10">
            {fileExt}
          </span>
        )}

        {/* Hover info overlay (grid only) */}
        {showHoverInfo && viewMode === 'grid' && (
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10 transition-opacity duration-200 flex flex-col justify-between p-2.5">
            {/* Action icons - centered */}
            <div className="flex items-center justify-center gap-2 flex-1">
              <button
                onClick={(e) => { e.stopPropagation(); onPreview(file); }}
                className="w-9 h-9 rounded-full bg-white/[0.15] backdrop-blur-md flex items-center justify-center text-white hover:bg-white/[0.25] transition-all hover:scale-110"
                title="Preview"
              >
                <Eye size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDownload(file.id); }}
                className="w-9 h-9 rounded-full bg-white/[0.15] backdrop-blur-md flex items-center justify-center text-white hover:bg-white/[0.25] transition-all hover:scale-110"
                title="Download"
              >
                <Download size={16} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onContextMenu(e as unknown as React.MouseEvent, file); }}
                className="w-9 h-9 rounded-full bg-white/[0.15] backdrop-blur-md flex items-center justify-center text-white hover:bg-white/[0.25] transition-all hover:scale-110"
                title="More"
              >
                <MoreVertical size={16} />
              </button>
            </div>
            {/* File info at bottom */}
            <div className="text-white">
              <p className="text-xs font-medium truncate">{file.name}</p>
              <p className="text-[10px] text-white/70 mt-0.5">
                {formatBytes(file.size)} &middot; {new Date(file.updated_at).toLocaleDateString()} &middot; {fileExt || file.mime_type.split('/')[1]}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Info area below thumbnail */}
      <div className="px-3 py-2.5">
        {isRenaming ? (
          <div className="w-full" onClick={(e) => e.stopPropagation()}>
            <input
              ref={renameRef}
              type="text"
              value={renamingName}
              onChange={(e) => setRenamingName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onRename(file.id);
                if (e.key === 'Escape') onCancelRename();
              }}
              onBlur={() => onRename(file.id)}
              className="w-full text-xs text-center border border-blue-400 rounded px-1 py-0.5 outline-none bg-transparent text-slate-800 dark:text-slate-200"
            />
          </div>
        ) : (
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate w-full leading-tight">
            {file.name}
          </p>
        )}
        <p className="text-xs text-slate-400 mt-0.5">{formatBytes(file.size)}</p>
      </div>
    </div>
  );
}
