import { useState, useEffect } from 'react';
import { X, Upload, Film, Tag, ChevronRight, Check, Search, Folder, ArrowLeft } from 'lucide-react';
import { getRootContents, getFolderContents, getDownloadUrl } from '../api/files';
import type { FileItem, FolderItem } from '../api/files';
import { createPost, CATEGORIES } from '../api/explore';
import { formatBytes } from '../api/files';
import { useToast } from './Toast';

interface CreatePostModalProps {
  onClose: () => void;
  onCreated: () => void;
}

interface BreadcrumbItem {
  label: string;
  folderId?: string;
}

export function CreatePostModal({ onClose, onCreated }: CreatePostModalProps) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [videoFiles, setVideoFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<FileItem | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState('Entertainment');
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ label: 'My Files' }]);

  useEffect(() => {
    loadContents(currentFolderId);
  }, [currentFolderId]);

  async function loadContents(folderId?: string) {
    setLoading(true);
    try {
      const contents = folderId
        ? await getFolderContents(folderId)
        : await getRootContents('updated_at', 'desc');
      setFolders(contents.folders ?? []);
      const videos = (contents.files ?? []).filter(
        (f) => f.mime_type?.startsWith('video/') ?? false
      );
      setVideoFiles(videos);
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

  const filteredVideos = searchQuery
    ? videoFiles.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : videoFiles;

  const filteredFolders = searchQuery
    ? folders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : folders;

  async function handleSelectFile(file: FileItem) {
    setSelectedFile(file);
    try {
      const url = await getDownloadUrl(file.id);
      setThumbnailUrl(url);
    } catch {
      setThumbnailUrl(null);
    }
  }

  function handleAddTag(e: React.KeyboardEvent) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault();
      const newTag = tagInput.trim().replace(/^#/, '');
      if (newTag && !tags.includes(newTag)) {
        setTags([...tags, newTag]);
      }
      setTagInput('');
    }
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handlePost() {
    if (!selectedFile || !caption.trim()) return;
    setPosting(true);
    setError('');
    try {
      await createPost(selectedFile.id, caption.trim(), category, tags);
      toast({ title: 'Post published!', description: 'Your video is now live on Explore.', type: 'success' });
      onCreated();
    } catch {
      setError('Failed to create post. Please try again.');
      setPosting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Upload size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Post to Explore</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Step {step} of 2</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-slate-100 dark:bg-[#1E293B]">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 transition-all duration-300"
            style={{ width: step === 1 ? '50%' : '100%' }}
          />
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {step === 1 && (
            <div>
              {/* Search bar */}
              <div className="relative mb-3">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search videos by name..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 dark:bg-[#1E293B] border border-transparent focus:border-blue-500 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder:text-slate-400 text-slate-800 dark:text-slate-200"
                />
              </div>

              {/* Breadcrumb */}
              {breadcrumbs.length > 1 && (
                <div className="flex items-center gap-1 mb-3 text-sm">
                  <button
                    onClick={() => navigateToBreadcrumb(breadcrumbs.length - 2)}
                    className="p-1 rounded hover:bg-slate-100 dark:hover:bg-white/[0.05] text-slate-400"
                  >
                    <ArrowLeft size={16} />
                  </button>
                  {breadcrumbs.map((crumb, i) => (
                    <span key={i} className="flex items-center gap-1">
                      {i > 0 && <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />}
                      <button
                        onClick={() => navigateToBreadcrumb(i)}
                        className={`px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors ${
                          i === breadcrumbs.length - 1
                            ? 'text-slate-800 dark:text-white font-medium'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {crumb.label}
                      </button>
                    </span>
                  ))}
                </div>
              )}

              {/* File count */}
              <p className="text-xs text-slate-400 mb-3">
                {filteredFolders.length > 0 && `${filteredFolders.length} folder${filteredFolders.length !== 1 ? 's' : ''}`}
                {filteredFolders.length > 0 && filteredVideos.length > 0 && ', '}
                {filteredVideos.length > 0 && `${filteredVideos.length} video${filteredVideos.length !== 1 ? 's' : ''}`}
                {filteredFolders.length === 0 && filteredVideos.length === 0 && !loading && 'No videos in this folder'}
              </p>

              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredFolders.length === 0 && filteredVideos.length === 0 ? (
                <div className="text-center py-12 text-slate-400 dark:text-slate-500">
                  <Film size={48} className="mx-auto mb-3 opacity-50" />
                  <p className="font-medium">No video files found</p>
                  <p className="text-sm mt-1">
                    {searchQuery ? 'Try a different search term' : 'Upload a video to your ByteBox first'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {/* Folders */}
                  {filteredFolders.map((folder) => (
                    <button
                      key={folder.id}
                      onClick={() => navigateToFolder(folder)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-white/[0.08] hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-white/[0.05] transition-all text-left"
                    >
                      <Folder size={20} className="text-blue-500 shrink-0" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{folder.name}</span>
                    </button>
                  ))}

                  {/* Videos */}
                  {filteredVideos.map((file) => (
                    <button
                      key={file.id}
                      onClick={() => handleSelectFile(file)}
                      className={`group relative aspect-video rounded-xl overflow-hidden border-2 transition-all ${
                        selectedFile?.id === file.id
                          ? 'border-blue-500 ring-2 ring-blue-500/30'
                          : 'border-slate-200 dark:border-white/[0.08] hover:border-blue-400'
                      }`}
                    >
                      <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
                        <Film size={24} className="text-slate-400" />
                      </div>
                      {selectedFile?.id === file.id && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center z-10">
                          <Check size={14} className="text-white" />
                        </div>
                      )}
                      <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                        <p className="text-xs text-white truncate font-medium">{file.name}</p>
                        <p className="text-[10px] text-slate-300">{formatBytes(file.size)}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 2 && selectedFile && (
            <div className="space-y-5">
              {/* Preview */}
              <div className="flex gap-4">
                <div className="w-40 aspect-video rounded-xl overflow-hidden bg-slate-900 flex items-center justify-center shrink-0">
                  {thumbnailUrl ? (
                    <video src={thumbnailUrl} className="w-full h-full object-cover" />
                  ) : (
                    <Film size={24} className="text-slate-500" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedFile.mime_type}
                  </p>
                </div>
              </div>

              {/* Caption */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Caption
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a compelling caption..."
                  rows={3}
                  maxLength={500}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none transition-colors"
                />
                <p className="text-xs text-slate-400 mt-1 text-right">{caption.length}/500</p>
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                >
                  {CATEGORIES.filter((c) => c !== 'All').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tags */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  <Tag size={14} className="inline mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 rounded-full text-xs font-medium"
                    >
                      #{tag}
                      <button
                        onClick={() => removeTag(tag)}
                        className="hover:text-blue-800 dark:hover:text-blue-300"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleAddTag}
                  placeholder="Type a tag and press Enter..."
                  className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              {error && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 px-4 py-2 rounded-lg">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0F172A]/50">
          {step === 2 ? (
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Back
            </button>
          ) : (
            <div />
          )}
          {step === 1 ? (
            <button
              onClick={() => selectedFile && setStep(2)}
              disabled={!selectedFile}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              Next
              <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handlePost}
              disabled={posting || !caption.trim()}
              className={`flex flex-col items-center gap-1 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm ${posting ? 'min-w-[180px]' : ''}`}
            >
              {posting ? (
                <>
                  <span className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Publishing...
                  </span>
                  <div className="w-full h-1.5 bg-white/20 rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full"
                      style={{
                        background: 'linear-gradient(90deg, #ffffff 0%, #e0e7ff 30%, #ffffff 60%, #e0e7ff 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'upload-shimmer 1.2s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <style>{`
                    @keyframes upload-shimmer {
                      0% { background-position: -200% 0; }
                      100% { background-position: 200% 0; }
                    }
                  `}</style>
                </>
              ) : (
                <span className="flex items-center gap-2">
                  <Upload size={16} />
                  Post to Explore
                </span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
