import { useState, useEffect, useCallback } from 'react';
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
} from 'lucide-react';
import { getMyShares, deleteShare } from '../api/files';
import type { ShareLink } from '../api/files';
import { Layout, Breadcrumb } from '../components/Layout';

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

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

export default function Shares() {
  const [shares, setShares] = useState<ShareLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; name: string } | null>(null);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError('');
      try {
        const data = await getMyShares();
        setShares(data);
      } catch {
        setError('Failed to load shared links.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [refreshKey]);

  async function handleDelete(id: string) {
    try {
      await deleteShare(id);
      setShares((prev) => prev.filter((s) => s.id !== id));
      setConfirmDelete(null);
    } catch {
      setError('Failed to revoke share link.');
    }
  }

  async function handleCopyLink(share: ShareLink) {
    const url = share.share_url || `${window.location.origin}/s/${share.code ?? share.id}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(share.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setError('Failed to copy link.');
    }
  }

  const isEmpty = !loading && shares.length === 0;

  return (
    <Layout onRefresh={refresh}>
      <div className="p-6 dark:bg-slate-900 min-h-full">
        <div className="flex items-center justify-between mb-6">
          <Breadcrumb crumbs={[{ label: 'My Shares' }]} />
          {!isEmpty && (
            <p className="text-xs text-slate-400">
              {shares.length} shared link{shares.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>

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
            <Share2 size={64} className="text-slate-200 dark:text-slate-700 mb-4" />
            <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No shared links</p>
            <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
              When you share a file, it will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {shares.map((share) => {
              const expiry = formatExpiry(share.expires_at);
              const shareUrl = share.share_url || `${window.location.origin}/s/${share.code ?? share.id}`;

              return (
                <div
                  key={share.id}
                  className="bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl group hover:border-slate-200 dark:hover:border-slate-600 hover:shadow-sm transition-all overflow-hidden"
                >
                  <div className="flex items-start gap-3 p-4">
                    {/* Icon */}
                    <div className="shrink-0">
                      <div className="w-14 h-14 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                        <Link2 size={24} className="text-blue-500" />
                      </div>
                    </div>

                    {/* Share info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                        {share.file_name || `Shared file`}
                      </p>

                      {/* Share URL */}
                      <div className="flex items-center gap-1.5 mt-1">
                        <ExternalLink size={12} className="text-slate-400 shrink-0" />
                        <span className="text-xs text-blue-500 truncate font-mono">
                          {shareUrl}
                        </span>
                      </div>

                      {/* Meta row */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Expiry */}
                        <span className={`flex items-center gap-1 text-xs ${
                          expiry.expired
                            ? 'text-red-500'
                            : 'text-slate-400'
                        }`}>
                          <Clock size={12} />
                          {expiry.label}
                        </span>

                        {/* Password badge */}
                        {share.has_password && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full">
                            <Lock size={10} />
                            Password
                          </span>
                        )}

                        {/* Download count */}
                        {share.download_count !== undefined && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Download size={12} />
                            {share.download_count} download{share.download_count !== 1 ? 's' : ''}
                          </span>
                        )}

                        {/* Created date */}
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
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
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
                          setConfirmDelete({ id: share.id, name: share.file_name || 'this share' })
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

      {/* Confirm delete dialog */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm mx-4 animate-fade-in">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center shrink-0">
                  <AlertTriangle size={20} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-200">Revoke share link?</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                    Anyone with this link will no longer be able to access the file.
                  </p>
                </div>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-3 py-2 rounded-lg mb-5 truncate">
                "{confirmDelete.name}"
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-2.5 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(confirmDelete.id)}
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
