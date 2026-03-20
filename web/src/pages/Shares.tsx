import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Share2,
  Link2,
  Trash2,
  Clock,
  Download,
  Lock,
  Copy,
  Check,
  X,
  AlertTriangle,
  ExternalLink,
  Plus,
  Upload,
  CloudUpload,
  ChevronDown,
  Eye,
  Settings,
} from 'lucide-react';
import {
  getMyShares,
  deleteShare,
  createShare,
  formatBytes,
  uploadFile,
} from '../api/files';
import type { ShareLink, FileItem } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';
import { FileIcon } from '../components/FileIcon';
import { FilePickerModal } from '../components/FilePickerModal';
import { timeAgo } from '../utils/format';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

type Tab = 'create' | 'links';

interface SelectedFile {
  fileItem: FileItem;
  source: 'bytebox';
}

interface LocalUpload {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  uploadedFile?: FileItem;
  error?: string;
}

const EXPIRY_OPTIONS = [
  { label: 'Permanent', hours: 0 },
  { label: '1 day', hours: 24 },
  { label: '7 days', hours: 168 },
  { label: '30 days', hours: 720 },
];

const ACCESS_OPTIONS = [
  { label: 'Public link', value: 'public' as const },
  { label: 'Password protected', value: 'password' as const },
];

function formatExpiry(dateStr: string | null): { label: string; expired: boolean } {
  if (!dateStr) return { label: 'Never expires', expired: false };
  const expiry = new Date(dateStr);
  const now = new Date();
  if (expiry <= now) return { label: 'Expired', expired: true };
  const diffMs = expiry.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 1) return { label: 'Expires in < 1h', expired: false };
  if (diffHours < 24) return { label: `Expires in ${diffHours}h`, expired: false };
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return { label: `Expires in ${diffDays}d`, expired: false };
  return { label: `Expires ${expiry.toLocaleDateString()}`, expired: false };
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export default function Shares() {
  // Tab state
  const [tab, setTab] = useState<Tab>('create');

  // My Links state
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Create Share state
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [localUploads, setLocalUploads] = useState<LocalUpload[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [showFilePicker, setShowFilePicker] = useState(false);
  const [expiryIndex, setExpiryIndex] = useState(0);
  const [accessMode, setAccessMode] = useState<'public' | 'password'>('public');
  const [password, setPassword] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatedLinks, setGeneratedLinks] = useState<ShareLink[]>([]);
  const [generateError, setGenerateError] = useState('');
  const [copiedGenId, setCopiedGenId] = useState<string | null>(null);
  const [showExpiryDropdown, setShowExpiryDropdown] = useState(false);
  const [showAccessDropdown, setShowAccessDropdown] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const expiryRef = useRef<HTMLDivElement>(null);
  const accessRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (expiryRef.current && !expiryRef.current.contains(e.target as Node)) {
        setShowExpiryDropdown(false);
      }
      if (accessRef.current && !accessRef.current.contains(e.target as Node)) {
        setShowAccessDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Load links when switching to My Links tab
  useEffect(() => {
    if (tab === 'links') {
      loadLinks();
    }
  }, [tab]);

  async function loadLinks() {
    setLinksLoading(true);
    setLinksError('');
    try {
      const data = await getMyShares();
      setShares(data);
    } catch {
      setLinksError('Failed to load shared links.');
    } finally {
      setLinksLoading(false);
    }
  }

  const refresh = useCallback(() => {
    if (tab === 'links') loadLinks();
  }, [tab]);

  /* ---- My Links actions ---- */

  async function handleDeleteShare(id: string) {
    try {
      await deleteShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      setConfirmDelete(null);
    } catch {
      setLinksError('Failed to revoke share link.');
    }
  }

  async function handleCopyLink(share: ShareLink) {
    const url =
      share.share_url ||
      `${window.location.origin}/s/${share.code ?? share.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setLinksError('Failed to copy link.');
    }
  }

  /* ---- Create Share actions ---- */

  function handleByteBoxSelect(files: FileItem[]) {
    const newFiles: SelectedFile[] = files
      .filter(
        (f) => !selectedFiles.some((sf) => sf.fileItem.id === f.id),
      )
      .map((f) => ({ fileItem: f, source: 'bytebox' as const }));
    setSelectedFiles((prev) => [...prev, ...newFiles]);
  }

  function removeSelectedFile(fileId: string) {
    setSelectedFiles((prev) => prev.filter((f) => f.fileItem.id !== fileId));
  }

  function removeLocalUpload(index: number) {
    setLocalUploads((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDesktopFiles(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return;
    const newUploads: LocalUpload[] = Array.from(e.target.files).map(
      (file) => ({
        file,
        progress: 0,
        status: 'pending' as const,
      }),
    );
    setLocalUploads((prev) => [...prev, ...newUploads]);
    // Reset input so the same file can be re-selected
    e.target.value = '';
  }

  async function uploadLocalFiles() {
    const pendingIndexes = localUploads
      .map((u, i) => (u.status === 'pending' ? i : -1))
      .filter((i) => i >= 0);
    if (pendingIndexes.length === 0) return;

    setIsUploading(true);
    for (const idx of pendingIndexes) {
      setLocalUploads((prev) =>
        prev.map((u, i) =>
          i === idx ? { ...u, status: 'uploading' } : u,
        ),
      );
      try {
        const uploaded = await uploadFile(
          localUploads[idx].file,
          undefined,
          (percent) => {
            setLocalUploads((prev) =>
              prev.map((u, i) =>
                i === idx ? { ...u, progress: percent } : u,
              ),
            );
          },
        );
        setLocalUploads((prev) =>
          prev.map((u, i) =>
            i === idx
              ? { ...u, status: 'done', progress: 100, uploadedFile: uploaded }
              : u,
          ),
        );
        // Auto-add to selected files
        setSelectedFiles((prev) => [
          ...prev,
          { fileItem: uploaded, source: 'bytebox' },
        ]);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : 'Upload failed';
        setLocalUploads((prev) =>
          prev.map((u, i) =>
            i === idx ? { ...u, status: 'error', error: message } : u,
          ),
        );
      }
    }
    setIsUploading(false);
  }

  // Auto-upload when files are added from desktop
  useEffect(() => {
    const hasPending = localUploads.some((u) => u.status === 'pending');
    if (hasPending && !isUploading) {
      uploadLocalFiles();
    }
  }, [localUploads.length]);

  async function handleGenerateLinks() {
    if (selectedFiles.length === 0) return;
    setGenerating(true);
    setGenerateError('');
    setGeneratedLinks([]);

    const expiryHours = EXPIRY_OPTIONS[expiryIndex].hours || undefined;
    const pw = accessMode === 'password' && password ? password : undefined;

    const links: ShareLink[] = [];
    try {
      for (const sf of selectedFiles) {
        const link = await createShare(sf.fileItem.id, expiryHours, pw);
        links.push({ ...link, file_name: link.file_name || sf.fileItem.name });
      }
      setGeneratedLinks(links);
    } catch {
      setGenerateError('Failed to generate share links. Please try again.');
    } finally {
      setGenerating(false);
    }
  }

  async function handleCopyGeneratedLink(link: ShareLink) {
    const url =
      link.share_url ||
      `${window.location.origin}/s/${link.code ?? link.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedGenId(link.id);
      setTimeout(() => setCopiedGenId(null), 2000);
    } catch {
      /* ignore */
    }
  }

  function resetCreateForm() {
    setSelectedFiles([]);
    setLocalUploads([]);
    setGeneratedLinks([]);
    setGenerateError('');
    setExpiryIndex(0);
    setAccessMode('public');
    setPassword('');
    setShowSettings(false);
  }

  const allFilesReady =
    selectedFiles.length > 0 && localUploads.every((u) => u.status !== 'uploading');

  /* ------------------------------------------------------------------ */
  /*  Render                                                            */
  /* ------------------------------------------------------------------ */

  return (
    <Layout onRefresh={refresh}>
      <div className="p-6 dark:bg-[#0B0F19] min-h-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb crumbs={[{ label: 'Share' }]} />
          <div className="flex items-center bg-slate-100 dark:bg-white/[0.06] rounded-lg p-0.5">
            <button
              onClick={() => setTab('create')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === 'create'
                  ? 'bg-white dark:bg-[#1E293B] text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              Create
            </button>
            <button
              onClick={() => setTab('links')}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                tab === 'links'
                  ? 'bg-white dark:bg-[#1E293B] text-slate-800 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              My Links
            </button>
          </div>
        </div>

        {/* Errors */}
        {(linksError || generateError) && (
          <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
            <span className="flex-1">{linksError || generateError}</span>
            <button
              onClick={() => {
                setLinksError('');
                setGenerateError('');
              }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* ============ CREATE TAB ============ */}
        {tab === 'create' && (
          <div className="max-w-2xl">
            {/* Generated links success view */}
            {generatedLinks.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Check
                      size={18}
                      className="text-green-600 dark:text-green-400"
                    />
                    <h3 className="font-semibold text-green-800 dark:text-green-300 text-sm">
                      Share link{generatedLinks.length !== 1 ? 's' : ''}{' '}
                      generated!
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {generatedLinks.map((link) => {
                      const url =
                        link.share_url ||
                        `${window.location.origin}/s/${link.code ?? link.id}`;
                      return (
                        <div
                          key={link.id}
                          className="flex items-center gap-3 bg-white dark:bg-[#0F172A] rounded-lg px-4 py-3 border border-green-100 dark:border-green-900"
                        >
                          <Link2
                            size={16}
                            className="text-violet-500 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5 truncate">
                              {link.file_name}
                            </p>
                            <p className="text-sm font-mono text-violet-600 dark:text-violet-400 truncate">
                              {url}
                            </p>
                          </div>
                          <button
                            onClick={() => handleCopyGeneratedLink(link)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-lg transition-all shrink-0"
                          >
                            {copiedGenId === link.id ? (
                              <>
                                <Check size={12} />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={12} />
                                Copy
                              </>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={resetCreateForm}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-violet-600 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                >
                  <Plus size={16} />
                  Share more files
                </button>
              </div>
            ) : (
              /* ---- Create share form ---- */
              <div className="space-y-5">
                {/* Empty state / Add files area */}
                {selectedFiles.length === 0 &&
                  localUploads.filter((u) => u.status !== 'done').length ===
                    0 && (
                    <div className="border-2 border-dashed border-slate-200 dark:border-white/[0.08] rounded-xl p-10 text-center">
                      <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                        <Share2 size={24} className="text-violet-500" />
                      </div>
                      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
                        Please add files to the share list
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mb-6">
                        Select files from your ByteBox or upload from your
                        computer
                      </p>
                      <div className="flex items-center justify-center gap-3">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium border border-slate-200 dark:border-white/[0.1] text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors"
                        >
                          <Upload size={16} />
                          Add from desktop
                        </button>
                        <button
                          onClick={() => setShowFilePicker(true)}
                          className="flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 transition-all"
                        >
                          <CloudUpload size={16} />
                          Add from ByteBox
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleDesktopFiles}
                      />
                    </div>
                  )}

                {/* Selected files list */}
                {(selectedFiles.length > 0 ||
                  localUploads.some(
                    (u) => u.status === 'uploading' || u.status === 'error',
                  )) && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Files to share ({selectedFiles.length})
                      </h3>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.06] rounded-lg transition-colors"
                        >
                          <Upload size={14} />
                          Desktop
                        </button>
                        <button
                          onClick={() => setShowFilePicker(true)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 rounded-lg transition-colors"
                        >
                          <Plus size={14} />
                          ByteBox
                        </button>
                      </div>
                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={handleDesktopFiles}
                      />
                    </div>

                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {/* Uploading items */}
                      {localUploads
                        .filter(
                          (u) =>
                            u.status === 'uploading' || u.status === 'error',
                        )
                        .map((upload, index) => (
                          <div
                            key={`upload-${index}`}
                            className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#1E293B] rounded-lg"
                          >
                            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                              <Upload
                                size={16}
                                className="text-blue-500"
                              />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                                {upload.file.name}
                              </p>
                              {upload.status === 'uploading' && (
                                <div className="mt-1.5">
                                  <div className="w-full bg-slate-200 dark:bg-white/[0.1] rounded-full h-1.5">
                                    <div
                                      className="bg-blue-600 h-1.5 rounded-full transition-all"
                                      style={{
                                        width: `${upload.progress}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    Uploading {upload.progress}%
                                  </p>
                                </div>
                              )}
                              {upload.status === 'error' && (
                                <p className="text-xs text-red-500 mt-0.5">
                                  {upload.error}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}

                      {/* Selected ByteBox files */}
                      {selectedFiles.map((sf) => (
                        <div
                          key={sf.fileItem.id}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#1E293B] rounded-lg group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center shrink-0">
                            <FileIcon
                              mimeType={sf.fileItem.mime_type}
                              size={18}
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                              {sf.fileItem.name}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {formatBytes(sf.fileItem.size)}
                            </p>
                          </div>
                          <button
                            onClick={() =>
                              removeSelectedFile(sf.fileItem.id)
                            }
                            className="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Settings bar */}
                {(selectedFiles.length > 0 ||
                  localUploads.length > 0) && (
                  <div className="bg-slate-50 dark:bg-[#1E293B] rounded-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        <Settings size={16} className="text-slate-400" />
                        Share settings
                      </div>
                      <button
                        onClick={() => setShowSettings(!showSettings)}
                        className="text-xs text-violet-600 hover:text-violet-700 font-medium"
                      >
                        {showSettings ? 'Hide' : 'Change'}
                      </button>
                    </div>

                    {/* Settings summary */}
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Expiry dropdown */}
                      <div className="relative" ref={expiryRef}>
                        <button
                          onClick={() =>
                            setShowExpiryDropdown(!showExpiryDropdown)
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/[0.08] rounded-lg hover:border-slate-300 dark:hover:border-white/[0.15] transition-colors"
                        >
                          <Clock size={12} className="text-slate-400" />
                          <span className="text-slate-600 dark:text-slate-400">
                            {EXPIRY_OPTIONS[expiryIndex].label}
                          </span>
                          <ChevronDown size={12} className="text-slate-400" />
                        </button>
                        {showExpiryDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-40 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-lg z-10 py-1">
                            {EXPIRY_OPTIONS.map((opt, i) => (
                              <button
                                key={opt.label}
                                onClick={() => {
                                  setExpiryIndex(i);
                                  setShowExpiryDropdown(false);
                                }}
                                className={`w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors ${
                                  i === expiryIndex
                                    ? 'text-violet-600 font-medium'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Access dropdown */}
                      <div className="relative" ref={accessRef}>
                        <button
                          onClick={() =>
                            setShowAccessDropdown(!showAccessDropdown)
                          }
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/[0.08] rounded-lg hover:border-slate-300 dark:hover:border-white/[0.15] transition-colors"
                        >
                          {accessMode === 'password' ? (
                            <Lock size={12} className="text-amber-500" />
                          ) : (
                            <Link2 size={12} className="text-slate-400" />
                          )}
                          <span className="text-slate-600 dark:text-slate-400">
                            {ACCESS_OPTIONS.find(
                              (o) => o.value === accessMode,
                            )?.label}
                          </span>
                          <ChevronDown size={12} className="text-slate-400" />
                        </button>
                        {showAccessDropdown && (
                          <div className="absolute top-full left-0 mt-1 w-48 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-white/[0.08] rounded-lg shadow-lg z-10 py-1">
                            {ACCESS_OPTIONS.map((opt) => (
                              <button
                                key={opt.value}
                                onClick={() => {
                                  setAccessMode(opt.value);
                                  setShowAccessDropdown(false);
                                }}
                                className={`w-full px-3 py-2 text-xs text-left hover:bg-slate-50 dark:hover:bg-white/[0.06] transition-colors ${
                                  opt.value === accessMode
                                    ? 'text-violet-600 font-medium'
                                    : 'text-slate-600 dark:text-slate-400'
                                }`}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Password input (shown when settings expanded or password mode) */}
                    {(showSettings || accessMode === 'password') &&
                      accessMode === 'password' && (
                        <div className="mt-3">
                          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">
                            Share password
                          </label>
                          <input
                            type="text"
                            placeholder="Enter a password..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-3 py-2 text-sm bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-white/[0.08] rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500 text-slate-700 dark:text-slate-300 placeholder-slate-400"
                          />
                        </div>
                      )}
                  </div>
                )}

                {/* Generate button */}
                {selectedFiles.length > 0 && (
                  <button
                    onClick={handleGenerateLinks}
                    disabled={
                      generating ||
                      !allFilesReady ||
                      (accessMode === 'password' && !password)
                    }
                    className="w-full py-3 text-sm font-semibold text-white rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {generating ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Link2 size={16} />
                        Generate Link
                        {selectedFiles.length > 1
                          ? `s (${selectedFiles.length})`
                          : ''}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ============ MY LINKS TAB ============ */}
        {tab === 'links' && (
          <div>
            {linksLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="w-8 h-8 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : shares.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center mb-4">
                  <Link2 size={28} className="text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">
                  No shared links yet
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
                  Share files to see your links here
                </p>
                <button
                  onClick={() => setTab('create')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 transition-all"
                >
                  <Plus size={16} />
                  Create share
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs text-slate-400">
                    {shares.length} shared link
                    {shares.length !== 1 ? 's' : ''}
                  </p>
                </div>
                {shares.map((share) => {
                  const expiry = formatExpiry(share.expires_at);
                  const shareUrl =
                    share.share_url ||
                    `${window.location.origin}/s/${share.code ?? share.id}`;

                  return (
                    <div
                      key={share.id}
                      className="bg-white dark:bg-[#0F172A] border border-slate-100 dark:border-white/[0.05] rounded-xl group hover:border-slate-200 dark:hover:border-[#2a3654] hover:shadow-sm transition-all overflow-hidden"
                    >
                      <div className="flex items-start gap-3 p-4">
                        {/* Icon */}
                        <div className="shrink-0">
                          <div className="w-14 h-14 rounded-lg bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                            <Link2 size={24} className="text-violet-500" />
                          </div>
                        </div>

                        {/* Share info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                            {share.file_name || 'Shared file'}
                          </p>

                          <div className="flex items-center gap-1.5 mt-1">
                            <ExternalLink
                              size={12}
                              className="text-slate-400 shrink-0"
                            />
                            <span className="text-xs text-violet-500 truncate font-mono">
                              {shareUrl}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mt-2 flex-wrap">
                            <span
                              className={`flex items-center gap-1 text-xs ${
                                expiry.expired
                                  ? 'text-red-500'
                                  : 'text-slate-400'
                              }`}
                            >
                              <Clock size={12} />
                              {expiry.label}
                            </span>

                            {share.has_password && (
                              <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                                <Lock size={10} />
                                Password
                              </span>
                            )}

                            {share.download_count !== undefined && (
                              <span className="flex items-center gap-1 text-xs text-slate-400">
                                <Download size={12} />
                                {share.download_count} download
                                {share.download_count !== 1 ? 's' : ''}
                              </span>
                            )}

                            <span className="text-xs text-slate-300 dark:text-slate-600 hidden sm:block">
                              Created {timeAgo(share.created_at)}
                            </span>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleCopyLink(share)}
                            title="Copy link"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-violet-600 bg-violet-50 dark:bg-violet-900/30 hover:bg-violet-100 dark:hover:bg-violet-900/50 rounded-lg transition-colors"
                          >
                            {copiedId === share.id ? (
                              <>
                                <Check size={14} />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy size={14} />
                                Copy Link
                              </>
                            )}
                          </button>
                          <button
                            onClick={() =>
                              setConfirmDelete({
                                id: share.id,
                                name: share.file_name || 'this share',
                              })
                            }
                            title="Revoke share"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                          >
                            <Trash2 size={14} />
                            Revoke
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* File Picker Modal */}
      <FilePickerModal
        open={showFilePicker}
        onClose={() => setShowFilePicker(false)}
        onSelect={handleByteBoxSelect}
        multiple
      />

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                    Revoke share link?
                  </h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Anyone with this link will no longer be able to access the
                    file.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-[#1E293B] px-3 py-2 rounded-lg mb-5 truncate">
                "{confirmDelete.name}"
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteShare(confirmDelete.id)}
                  className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
