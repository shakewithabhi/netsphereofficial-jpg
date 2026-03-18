import { useState, useEffect, useRef } from 'react';
import { MessageCircle, Send, Trash2, X } from 'lucide-react';
import { getComments, createComment, deleteComment } from '../api/files';
import type { Comment } from '../api/files';
import { useAuth } from '../store/auth';

interface CommentsDialogProps {
  fileId: string;
  fileName: string;
  onClose: () => void;
}

export function CommentsDialog({ fileId, fileName, onClose }: CommentsDialogProps) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadComments();
  }, [fileId]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function loadComments() {
    setLoading(true);
    setError('');
    try {
      const data = await getComments(fileId);
      setComments(data ?? []);
    } catch {
      setError('Failed to load comments.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const comment = await createComment(fileId, newComment.trim());
      setComments((prev) => [...prev, comment]);
      setNewComment('');
      setTimeout(() => {
        listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
      }, 50);
    } catch {
      setError('Failed to add comment.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(commentId: string) {
    try {
      await deleteComment(fileId, commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      setError('Failed to delete comment.');
    }
  }

  function formatDate(dateStr: string) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh] animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <MessageCircle size={20} className="text-blue-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-800">Comments</h3>
            <p className="text-xs text-slate-400 truncate">{fileName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Comments list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 text-red-600 rounded-lg text-sm">
              <span className="flex-1">{error}</span>
              <button onClick={() => setError('')}><X size={14} /></button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : comments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MessageCircle size={36} className="text-slate-200 mb-3" />
              <p className="text-sm text-slate-500">No comments yet</p>
              <p className="text-xs text-slate-400 mt-1">Be the first to comment</p>
            </div>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="group">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xs font-semibold shrink-0 mt-0.5">
                    {comment.user_name?.[0]?.toUpperCase() ?? 'U'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-slate-800">{comment.user_name}</span>
                      <span className="text-xs text-slate-400">{formatDate(comment.created_at)}</span>
                      {user?.id === comment.user_id && (
                        <button
                          onClick={() => handleDelete(comment.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-all"
                          title="Delete comment"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-0.5 whitespace-pre-wrap break-words">
                      {comment.content}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-5 py-3 border-t border-slate-100">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a comment..."
              className="flex-1 px-3 py-2 bg-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-colors placeholder:text-slate-400"
              disabled={submitting}
            />
            <button
              type="submit"
              disabled={!newComment.trim() || submitting}
              className="p-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-xl transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
