import { useState, useRef } from 'react';
import type { DragEvent, ChangeEvent } from 'react';
import { X, Upload, CheckCircle, AlertCircle, CloudUpload } from 'lucide-react';
import { uploadFile, formatBytes } from '../api/files';

interface UploadItem {
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'done' | 'error';
  error?: string;
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
  const fileInputRef = useRef<HTMLInputElement>(null);

  function addFiles(files: FileList | File[]) {
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

  async function handleUpload() {
    if (items.length === 0 || uploading) return;
    setUploading(true);
    let anyUploaded = false;

    for (let i = 0; i < items.length; i++) {
      if (items[i].status === 'done') continue;
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

  const allDone = items.length > 0 && items.every((i) => i.status === 'done');
  const hasErrors = items.some((i) => i.status === 'error');
  const pendingCount = items.filter((i) => i.status === 'pending').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 animate-fade-in">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CloudUpload size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">Upload Files</h2>
          </div>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-40"
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
                ? 'border-blue-500 bg-blue-50'
                : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
            }`}
          >
            <Upload size={32} className="mx-auto mb-3 text-slate-400" />
            <p className="text-sm font-medium text-slate-700">
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

          {items.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
              {items.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {item.file.name}
                      </p>
                      <span className="text-xs text-slate-400 ml-2 shrink-0">
                        {formatBytes(item.file.size)}
                      </span>
                    </div>
                    {(item.status === 'uploading' || item.status === 'done') && (
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div
                          className="bg-blue-600 h-1.5 rounded-full transition-all"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <p className="text-xs text-red-500">{item.error}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {item.status === 'done' && (
                      <CheckCircle size={18} className="text-green-500" />
                    )}
                    {item.status === 'error' && (
                      <AlertCircle size={18} className="text-red-500" />
                    )}
                    {item.status === 'pending' && !uploading && (
                      <button
                        onClick={(e) => { e.stopPropagation(); removeItem(index); }}
                        className="p-1 text-slate-400 hover:text-slate-600"
                      >
                        <X size={16} />
                      </button>
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
                  className="flex-1 py-2.5 border border-slate-200 text-slate-700 rounded-lg font-medium text-sm hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpload}
                  disabled={uploading || items.length === 0 || (pendingCount === 0 && !hasErrors)}
                  className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading
                    ? 'Uploading...'
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
