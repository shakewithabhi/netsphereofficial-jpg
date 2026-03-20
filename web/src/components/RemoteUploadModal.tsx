import React, { useState } from 'react';
import { Link2, X, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { remoteUpload } from '../api/files';

interface RemoteUploadModalProps {
  folderId?: string;
  onClose: () => void;
  onUploaded: () => void;
}

export function RemoteUploadModal({ folderId, onClose, onUploaded }: RemoteUploadModalProps) {
  const [url, setUrl] = useState('');
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  function isValidUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  function isPrivateUrl(value: string): boolean {
    try {
      const parsed = new URL(value);
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname === '[::1]' ||
        hostname === '::1'
      ) {
        return true;
      }
      // Check private IP ranges
      const parts = hostname.split('.').map(Number);
      if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
        if (parts[0] === 10) return true; // 10.x.x.x
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true; // 172.16-31.x.x
        if (parts[0] === 192 && parts[1] === 168) return true; // 192.168.x.x
      }
      return false;
    } catch {
      return false;
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setError('Please enter a URL.');
      return;
    }
    if (!isValidUrl(trimmedUrl)) {
      setError('Please enter a valid URL starting with http:// or https://');
      return;
    }
    if (isPrivateUrl(trimmedUrl)) {
      setError('URLs pointing to private/internal network addresses are not allowed.');
      return;
    }

    setLoading(true);
    try {
      const file = await remoteUpload(
        trimmedUrl,
        folderId,
        fileName.trim() || undefined
      );
      setSuccess(file.name);
      setTimeout(() => {
        onUploaded();
      }, 1500);
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || 'Failed to download file from URL.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-xl flex items-center justify-center">
              <Link2 size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Upload from URL
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Download a file from the web to your ByteBox
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <X size={18} className="text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/file.zip"
              disabled={loading || !!success}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm disabled:opacity-50"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              File name <span className="text-slate-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              placeholder="Auto-detect from URL"
              disabled={loading || !!success}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all text-sm disabled:opacity-50"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle size={16} className="text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="flex items-start gap-2 px-3.5 py-2.5 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-xl">
              <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
              <p className="text-sm text-green-600 dark:text-green-400">
                <span className="font-medium">{success}</span> — File saved!
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center gap-2 py-2">
              <Loader2 size={18} className="animate-spin text-blue-500" />
              <span className="text-sm text-slate-600 dark:text-slate-400">Downloading file...</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !url.trim() || !!success}
              className="px-4 py-2.5 rounded-xl text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Downloading...' : 'Download to ByteBox'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
