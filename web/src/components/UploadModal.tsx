import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { X, Upload, CheckCircle, AlertCircle, CloudUpload, Ban } from 'lucide-react';
import { uploadFile, formatBytes } from '../api/files';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error' | 'cancelled';
  error?: string;
  abortController?: AbortController;
}

interface UploadModalProps {
  folderId?: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function UploadModal({ folderId, onClose, onUploaded }: UploadModalProps) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [sizeError, setSizeError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
    const oversized = Array.from(files).filter((f) => f.size > MAX_FILE_SIZE);
    if (oversized.length > 0) {
      const names = oversized.map((f) => f.name).join(', ');
      setSizeError(`File${oversized.length > 1 ? 's' : ''} too large (max 100MB): ${names}`);
      // Still add the files that are within limits
      const valid = Array.from(files).filter((f) => f.size <= MAX_FILE_SIZE);
      if (valid.length === 0) return;
      const newItems: UploadItem[] = valid.map((file) => ({
        file,
        progress: 0,
        status: 'pending',
      }));
      setItems((prev) => [...prev, ...newItems]);
      return;
    }
    setSizeError('');
    const newItems: UploadItem[] = Array.from(files).map((file) => ({
      file,
      progress: 0,
      status: 'pending',
    }));
    setItems((prev) => [...prev, ...newItems]);
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  }

  function handleFileInput(e: ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function cancelUpload(index: number) {
    setItems((prev) =>
      prev.map((item, idx) => {
        if (idx === index && item.status === 'uploading') {
          // Note: actual cancellation would need AbortController in the API
          return { ...item, status: 'cancelled', progress: 0 };
        }
        return item;
      })
    );
  }

  async function handleUpload() {
    if (items.length === 0 || uploading) return;
    setUploading(true);
    let anyUploaded = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'done' || items[i].status === 'cancelled') continue;
      setItems((prev) =>
        prev.map((item, idx) =>
          idx === i ? { ...item, status: 'uploading' } : item
        )
      );
      try {
        await uploadFile(items[i].file, folderId, (percent) => {
          setItems((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, progress: percent } : item
            )
          );
        });
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'done', progress: 100 } : item
          )
        );
        anyUploaded = true;
      } catch (err: unknown) {
        // Check if it was cancelled
        const currentStatus = items[i]?.status;
        if (currentStatus === 'cancelled') continue;
        const message = err instanceof Error ? err.message : 'Upload failed';
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === i ? { ...item, status: 'error', error: message } : item
          )
        );
      }
    }

    setUploading(false);
    if (anyUploaded) {
      onUploaded();
    }
  }

  const allDone = items.length > 0 && items.every((i) => i.status === 'done' || i.status === 'cancelled');
  const hasErrors = items.some((i) => i.status === 'error');
  const pendingCount = items.filter((i) => i.status === 'pending').length;
  const completedCount = items.filter((i) => i.status === 'done').length;
  const activeItems = items.filter((i) => i.status !== 'cancelled');
  const overallProgress = activeItems.length > 0
    ? Math.round(activeItems.reduce((sum, i) => sum + i.progress, 0) / activeItems.length)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2">
            <CloudUpload size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800 dark:text-slate-200">Upload Files</h2>
            {uploading && (
              <span className="text-xs text-slate-400 ml-2">
                {completedCount}/{activeItems.length} - {overallProgress}%
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragging
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                : 'border-blue-200 dark:border-white/[0.08] hover:border-blue-400 hover:bg-blue-50/30 dark:hover:bg-white/[0.08]'
            }`}
          >
            <Upload size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              Drop files here or{' '}
              <span className="text-blue-600">browse</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">Any file type supported</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              onChange={handleFileInput}
            />
          </div>

          {/* File size error */}
          {sizeError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              <AlertCircle size={16} className="shrink-0" />
              <span className="flex-1">{sizeError}</span>
              <button onClick={() => setSizeError('')}><X size={14} /></button>
            </div>
          )}

          {/* Overall progress bar */}
          {uploading && items.length > 1 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Overall progress</span>
                <span>{overallProgress}%</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-white/[0.1] rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${overallProgress}%` }}
                />
              </div>
            </div>
          )}

          {items.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
              {items.map((item, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-3 p-3 rounded-lg ${
                    item.status === 'cancelled'
                      ? 'bg-slate-100 dark:bg-[#1E293B] opacity-50'
                      : 'bg-slate-50 dark:bg-[#1E293B]'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className={`text-sm font-medium truncate ${
                        item.status === 'cancelled'
                          ? 'text-slate-400 line-through'
                          : 'text-slate-700 dark:text-slate-300'
                      }`}>
                        {item.file.name}
                      </p>
                      <span className="text-xs text-slate-400 ml-2 shrink-0">
                        {formatBytes(item.file.size)}
                      </span>
                    </div>
                    {(item.status === 'uploading' || item.status === 'done') && (
                      <div className="w-full bg-slate-200 dark:bg-white/[0.1] rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${
                            item.status === 'done' ? 'bg-green-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'uploading' && (
                      <p className="text-xs text-slate-400 mt-0.5">{item.progress}%</p>
                    )}
                    {item.status === 'error' && (
                      <p className="text-xs text-red-500">{item.error}</p>
                    )}
                    {item.status === 'cancelled' && (
                      <p className="text-xs text-slate-400">Cancelled</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.status === 'done' && (
                      <CheckCircle size={18} className="text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle size={18} className="text-red-500" />
                    )}
                    {item.status === 'uploading' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); cancelUpload(index); }}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                        title="Cancel upload"
                      >
                        <Ban size={16} />
                      </button>
                    )}
                    {item.status === 'pending' && !uploading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
                    )}
                    {item.status === 'cancelled' && (
                      <Ban size={18} className="text-slate-400" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            {allDone ? (
              <button
                onClick={onClose}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
              >
                Done
              </button>
            ) : (
              <>
                <button
                  onClick={onClose}
                  disabled={uploading}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 rounded-lg font-medium text-sm hover:bg-slate-50 dark:hover:bg-white/[0.08] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || items.length === 0 || (pendingCount === 0 && !hasErrors)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading
                    ? `Uploading... ${overallProgress}%`
                    : `Upload ${items.length} file${items.length !== 1 ? 's' : ''}`}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
