import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCw } from 'lucide-react';
import type { FileItem } from '../api/files';
import { getDownloadUrl, formatBytes } from '../api/files';
import { FileIcon } from './FileIcon';

interface FilePreviewProps {
  file: FileItem;
  files: FileItem[];
  onClose: () => void;
  onNavigate: (file: FileItem) => void;
}

function getFileCategory(mimeType: string): 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'other' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType === 'application/pdf') return 'pdf';
  if (
    mimeType.startsWith('text/') ||
    mimeType.includes('javascript') ||
    mimeType.includes('typescript') ||
    mimeType.includes('json') ||
    mimeType.includes('xml') ||
    mimeType.includes('html') ||
    mimeType.includes('css')
  ) return 'text';
  return 'other';
}

export function FilePreview({ file, files, onClose, onNavigate }: FilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [videoSpeed, setVideoSpeed] = useState(1);

  const category = getFileCategory(file.mime_type);
  const currentIndex = files.findIndex((f) => f.id === file.id);

  const goToPrev = useCallback(() => {
    if (files.length <= 1) return;
    const prevIndex = currentIndex <= 0 ? files.length - 1 : currentIndex - 1;
    onNavigate(files[prevIndex]);
  }, [currentIndex, files, onNavigate]);

  const goToNext = useCallback(() => {
    if (files.length <= 1) return;
    const nextIndex = currentIndex >= files.length - 1 ? 0 : currentIndex + 1;
    onNavigate(files[nextIndex]);
  }, [currentIndex, files, onNavigate]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') goToPrev();
      if (e.key === 'ArrowRight') goToNext();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrev, goToNext]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    setUrl(null);
    setTextContent(null);
    setZoom(1);
    setVideoSpeed(1);

    (async () => {
      try {
        const downloadUrl = await getDownloadUrl(file.id);
        if (cancelled) return;
        setUrl(downloadUrl);

        if (category === 'text') {
          try {
            const res = await fetch(downloadUrl);
            const text = await res.text();
            if (!cancelled) setTextContent(text);
          } catch {
            // Failed to fetch text content, will show download instead
          }
        }
      } catch {
        if (!cancelled) setError('Failed to load file preview.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [file.id, category]);

  async function handleDownload() {
    try {
      const downloadUrl = url || await getDownloadUrl(file.id);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = file.name;
      a.target = '_blank';
      a.click();
    } catch {
      // Fall back to opening in new tab
    }
  }

  function renderContent() {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      );
    }

    if (error || !url) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-white">
          <FileIcon mimeType={file.mime_type} size={64} className="mb-4 opacity-50" />
          <p className="text-lg font-medium mb-2">{error || 'Unable to preview'}</p>
          <button
            onClick={handleDownload}
            className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors"
          >
            Download file
          </button>
        </div>
      );
    }

    switch (category) {
      case 'image':
        return (
          <div className="flex items-center justify-center h-full overflow-auto p-4">
            <img
              src={url}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded-lg transition-transform"
              style={{ transform: `scale(${zoom})` }}
            />
          </div>
        );

      case 'video':
        return (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <video
              src={url}
              controls
              className="max-w-full max-h-[75vh] rounded-lg"
              ref={(el) => { if (el) el.playbackRate = videoSpeed; }}
            >
              Your browser does not support video playback.
            </video>
            <div className="flex items-center gap-2 mt-3">
              <span className="text-xs text-slate-300">Speed:</span>
              {[0.5, 1, 1.5, 2].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setVideoSpeed(speed)}
                  className={`px-2 py-1 text-xs rounded-lg transition-colors ${
                    videoSpeed === speed
                      ? 'bg-blue-600 text-white'
                      : 'bg-white/10 text-slate-300 hover:bg-white/20'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center h-full p-4">
            <FileIcon mimeType={file.mime_type} size={80} className="mb-6 opacity-70" />
            <p className="text-white text-lg font-medium mb-4">{file.name}</p>
            <audio src={url} controls className="w-full max-w-md">
              Your browser does not support audio playback.
            </audio>
          </div>
        );

      case 'pdf':
        return (
          <div className="flex items-center justify-center h-full p-4">
            <iframe
              src={url}
              title={file.name}
              className="w-full h-full rounded-lg bg-white"
              style={{ maxWidth: '900px' }}
            />
          </div>
        );

      case 'text':
        return (
          <div className="flex items-center justify-center h-full p-4 overflow-auto">
            <pre className="w-full max-w-4xl max-h-[80vh] overflow-auto bg-slate-900 text-slate-200 p-6 rounded-xl text-sm font-mono leading-relaxed whitespace-pre-wrap break-words border border-slate-700">
              {textContent ?? 'Loading...'}
            </pre>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-full text-white">
            <FileIcon mimeType={file.mime_type} size={80} className="mb-4 opacity-50" />
            <p className="text-lg font-medium mb-1">{file.name}</p>
            <p className="text-sm text-slate-400 mb-1">{file.mime_type}</p>
            <p className="text-sm text-slate-400 mb-6">{formatBytes(file.size)}</p>
            <button
              onClick={handleDownload}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Download size={16} />
              Download
            </button>
          </div>
        );
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex flex-col"
      onClick={onClose}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-black/60 backdrop-blur-sm shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <FileIcon mimeType={file.mime_type} size={20} />
          <span className="text-white text-sm font-medium truncate">{file.name}</span>
          <span className="text-slate-400 text-xs shrink-0">{formatBytes(file.size)}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {category === 'image' && (
            <>
              <button
                onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Zoom out"
              >
                <ZoomOut size={18} />
              </button>
              <span className="text-xs text-slate-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Zoom in"
              >
                <ZoomIn size={18} />
              </button>
              <button
                onClick={() => setZoom(1)}
                className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                title="Reset zoom"
              >
                <RotateCw size={18} />
              </button>
              <div className="w-px h-5 bg-slate-600 mx-1" />
            </>
          )}
          <button
            onClick={handleDownload}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Download"
          >
            <Download size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            title="Close (Esc)"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 relative min-h-0" onClick={(e) => e.stopPropagation()}>
        {renderContent()}

        {/* Navigation arrows */}
        {files.length > 1 && (
          <>
            <button
              onClick={goToPrev}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
              title="Previous file"
            >
              <ChevronLeft size={24} />
            </button>
            <button
              onClick={goToNext}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 text-white rounded-full transition-colors backdrop-blur-sm"
              title="Next file"
            >
              <ChevronRight size={24} />
            </button>
          </>
        )}
      </div>

      {/* Footer with file counter */}
      {files.length > 1 && (
        <div
          className="text-center py-2 text-xs text-slate-400 bg-black/60 backdrop-blur-sm shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          {currentIndex + 1} of {files.length}
        </div>
      )}
    </div>
  );
}
