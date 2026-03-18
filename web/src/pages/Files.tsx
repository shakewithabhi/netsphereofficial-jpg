import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from 'react';
import type { DragEvent } from 'react';
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
} from '../api/files';
import type { FolderItem, FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';
import { ShareDialog } from '../components/ShareDialog';
import { UploadModal } from '../components/UploadModal';
import { CommentsDialog } from '../components/CommentsDialog';

interface BreadcrumbItem {
  label: string;
  to?: string;
  id?: string;
}

export default function Files() {
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

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

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
            { label: 'My Files', to: '/' },
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

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
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

  function openContextMenu(
    e: React.MouseEvent,
    type: 'file' | 'folder',
    item: FileItem | FolderItem
  ) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ type, item, x: e.clientX, y: e.clientY });
  }

  const isEmpty = !loading && folders.length === 0 && files.length === 0;

  return (
    <Layout onRefresh={refresh} currentFolderId={folderId}>
      <div
        className={`p-6 min-h-full transition-colors ${
          dragOver ? 'bg-blue-50 drop-zone-active' : ''
        }`}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb crumbs={breadcrumbs} />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title={viewMode === 'grid' ? 'List view' : 'Grid view'}
            >
              {viewMode === 'grid' ? <List size={18} /> : <Grid3x3 size={18} />}
            </button>
            <button
              onClick={() => { setNewFolderMode(true); setNewFolderName(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-slate-600 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm font-medium"
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
            {searchQuery ? (
              <>
                <Search size={48} className="text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">No results for "{searchQuery}"</p>
                <p className="text-sm text-slate-400 mt-1">Try a different search term</p>
              </>
            ) : (
              <>
                <CloudUpload size={48} className="text-slate-200 mb-4" />
                <p className="text-slate-500 font-medium">This folder is empty</p>
                <p className="text-sm text-slate-400 mt-1">
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
                    ? 'flex flex-col items-center p-4 bg-white border-2 border-blue-400 rounded-xl'
                    : 'flex items-center gap-3 px-4 py-3 bg-white border-2 border-blue-400 rounded-xl'
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
                  className="text-sm text-center w-full border-none outline-none bg-transparent text-slate-800 placeholder:text-slate-400"
                />
              </div>
            )}

            {/* Folders */}
            {folders.map((folder) => (
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
              />
            ))}

            {/* Files */}
            {files.map((file) => (
              <FileCard
                key={file.id}
                file={file}
                viewMode={viewMode}
                onContextMenu={(e) => openContextMenu(e, 'file', file)}
                onMenuClick={(e) => openContextMenu(e, 'file', file)}
                onDownload={() => handleDownload(file.id)}
                onToggleStar={() => handleToggleStar(file)}
              />
            ))}
          </div>
        )}

        {/* Drag overlay hint */}
        {dragOver && (
          <div className="fixed inset-0 z-30 flex items-center justify-center pointer-events-none">
            <div className="bg-blue-600 text-white px-8 py-4 rounded-2xl shadow-2xl text-lg font-semibold">
              Drop files to upload
            </div>
          </div>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-xl shadow-xl border border-slate-100 py-1 min-w-44 animate-fade-in"
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
              <div className="my-1 border-t border-slate-100" />
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
              <div className="my-1 border-t border-slate-100" />
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
          ? 'text-red-600 hover:bg-red-50'
          : 'text-slate-700 hover:bg-slate-50'
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
}) {
  const isRenaming = renamingId === folder.id;

  if (viewMode === 'list') {
    return (
      <div
        onContextMenu={onContextMenu}
        className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-100 cursor-pointer group transition-colors"
        onClick={!isRenaming ? onClick : undefined}
      >
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
            className="flex-1 text-sm border border-blue-400 rounded px-2 py-0.5 outline-none"
          />
        ) : (
          <span className="flex-1 text-sm font-medium text-slate-800 truncate">{folder.name}</span>
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
      onContextMenu={onContextMenu}
      className="flex flex-col items-center p-4 bg-white hover:bg-blue-50 border border-slate-100 rounded-xl cursor-pointer group transition-colors relative"
      onClick={!isRenaming ? onClick : undefined}
    >
      <button
        onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
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
              className="w-full text-xs text-center border border-blue-400 rounded px-1 py-0.5 outline-none"
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
        <p className="text-xs font-medium text-slate-700 text-center truncate w-full leading-tight">
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
  onDownload,
  onToggleStar,
}: {
  file: FileItem;
  viewMode: 'grid' | 'list';
  onContextMenu: (e: React.MouseEvent) => void;
  onMenuClick: (e: React.MouseEvent) => void;
  onDownload: () => void;
  onToggleStar: () => void;
}) {
  if (viewMode === 'list') {
    return (
      <div
        onContextMenu={onContextMenu}
        className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-slate-50 rounded-xl border border-slate-100 cursor-pointer group transition-colors"
        onDoubleClick={onDownload}
      >
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
        <span className="flex-1 text-sm font-medium text-slate-800 truncate">{file.name}</span>
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
      onContextMenu={onContextMenu}
      className="flex flex-col items-center p-4 bg-white hover:bg-slate-50 border border-slate-100 rounded-xl cursor-pointer group transition-colors relative"
      onDoubleClick={onDownload}
    >
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
      <button
        onClick={(e) => { e.stopPropagation(); onMenuClick(e); }}
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-all"
      >
        <MoreVertical size={14} />
      </button>
      <FileIcon mimeType={file.mime_type} size={40} className="mb-2" />
      <p className="text-xs font-medium text-slate-700 text-center truncate w-full leading-tight">
        {file.name}
      </p>
      <p className="text-xs text-slate-400 mt-1">{formatBytes(file.size)}</p>
    </div>
  );
}
