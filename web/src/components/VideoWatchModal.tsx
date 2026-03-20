import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  Heart,
  Eye,
  MessageCircle,
  Share2,
  Send,
  Flag,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Trash2,
} from 'lucide-react';
import type { Post, PostComment } from '../api/explore';
import {
  likePost,
  unlikePost,
  recordView,
  getRelatedPosts,
  getPostComments,
  addComment,
  deleteComment as deleteCommentApi,
  subscribe,
  unsubscribe,
  reportPost,
  formatCount,
  formatDuration,
} from '../api/explore';
import { getDownloadUrl } from '../api/files';
import { timeAgo } from '../utils/format';
import client from '../api/client';

interface VideoWatchModalProps {
  post: Post;
  onClose: () => void;
  onPostUpdate: (post: Post) => void;
  onNavigate: (post: Post) => void;
}

const SPEEDS = [0.5, 1, 1.25, 1.5, 2];

export function VideoWatchModal({ post, onClose, onPostUpdate, onNavigate }: VideoWatchModalProps) {
  const [currentPost, setCurrentPost] = useState(post);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isLiked, setIsLiked] = useState(post.is_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [isSubscribed, setIsSubscribed] = useState(post.is_subscribed);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [commentText, setCommentText] = useState('');
  const [relatedPosts, setRelatedPosts] = useState<Post[]>([]);
  const [loadingComments, setLoadingComments] = useState(true);
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [autoplay, setAutoplay] = useState(true);
  const [likeAnimating, setLikeAnimating] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewRecorded = useRef(false);
  const viewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadVideoUrl();
    loadComments();
    loadRelated();
    startViewTimer();

    return () => {
      if (viewTimer.current) clearTimeout(viewTimer.current);
      setVideoUrl((prev) => { if (prev?.startsWith('blob:')) URL.revokeObjectURL(prev); return prev; });
    };
  }, [currentPost.id]);

  async function loadVideoUrl() {
    // Use video_url from post (presigned MinIO URL) if available
    if (currentPost.video_url) {
      setVideoUrl(currentPost.video_url);
      return;
    }
    // Fallback: fetch via authenticated proxy if file_id exists
    if (currentPost.file_id) {
      try {
        const res = await client.get(`/files/${currentPost.file_id}/download-proxy`, {
          responseType: 'blob',
        });
        const blob = new Blob([res.data], { type: 'video/mp4' });
        setVideoUrl(URL.createObjectURL(blob));
      } catch {
        try {
          const url = await getDownloadUrl(currentPost.file_id);
          setVideoUrl(url);
        } catch {
          setVideoUrl(null);
        }
      }
    } else {
      setVideoUrl(null);
    }
  }

  async function loadComments() {
    setLoadingComments(true);
    try {
      const c = await getPostComments(currentPost.id);
      setComments(c);
    } catch {
      /* ignore */
    }
    setLoadingComments(false);
  }

  async function loadRelated() {
    try {
      const r = await getRelatedPosts(currentPost.id);
      setRelatedPosts(r);
    } catch {
      /* ignore */
    }
  }

  function startViewTimer() {
    viewRecorded.current = false;
    viewTimer.current = setTimeout(() => {
      if (!viewRecorded.current) {
        viewRecorded.current = true;
        recordView(currentPost.id, 3).catch(() => {});
      }
    }, 3000);
  }

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    setDuration(v.duration || 0);
    setProgress(v.duration ? (v.currentTime / v.duration) * 100 : 0);
  }, []);

  function togglePlay() {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }

  function toggleMute() {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  }

  function handleSeek(e: React.MouseEvent<HTMLDivElement>) {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
  }

  function changeSpeed(s: number) {
    setSpeed(s);
    if (videoRef.current) videoRef.current.playbackRate = s;
    setShowSpeedMenu(false);
  }

  function handleFullscreen() {
    videoRef.current?.requestFullscreen?.();
  }

  async function handleLike() {
    setLikeAnimating(true);
    setTimeout(() => setLikeAnimating(false), 600);
    try {
      if (isLiked) {
        await unlikePost(currentPost.id);
        setIsLiked(false);
        setLikeCount((c) => c - 1);
        onPostUpdate({ ...currentPost, is_liked: false, like_count: likeCount - 1 });
      } else {
        await likePost(currentPost.id);
        setIsLiked(true);
        setLikeCount((c) => c + 1);
        onPostUpdate({ ...currentPost, is_liked: true, like_count: likeCount + 1 });
      }
    } catch {
      /* ignore */
    }
  }

  async function handleSubscribe() {
    try {
      if (isSubscribed) {
        await unsubscribe(currentPost.user_id);
        setIsSubscribed(false);
      } else {
        await subscribe(currentPost.user_id);
        setIsSubscribed(true);
      }
    } catch {
      /* ignore */
    }
  }

  async function handleAddComment() {
    if (!commentText.trim()) return;
    try {
      const c = await addComment(currentPost.id, commentText.trim());
      setComments([c, ...comments]);
      setCommentText('');
    } catch {
      /* ignore */
    }
  }

  async function handleDeleteComment(commentId: string) {
    try {
      await deleteCommentApi(currentPost.id, commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch {
      /* ignore */
    }
  }

  async function handleReport() {
    if (!reportReason.trim()) return;
    try {
      await reportPost(currentPost.id, reportReason.trim());
      setShowReport(false);
      setReportReason('');
    } catch {
      /* ignore */
    }
  }

  const [shareToast, setShareToast] = useState(false);

  function handleShare() {
    const url = `${window.location.origin}/explore?watch=${currentPost.id}`;
    if (navigator.share) {
      navigator.share({ title: currentPost.caption, url }).catch(() => {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setShareToast(true);
        setTimeout(() => setShareToast(false), 2000);
      });
    }
  }

  function handleVideoEnd() {
    if (autoplay && relatedPosts.length > 0) {
      navigateToPost(relatedPosts[0]);
    }
  }

  function navigateToPost(p: Post) {
    setCurrentPost(p);
    setIsLiked(p.is_liked);
    setLikeCount(p.like_count);
    setIsSubscribed(p.is_subscribed);
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
    setComments([]);
    setRelatedPosts([]);
    onNavigate(p);
  }

  function timeFormat(s: number): string {
    return formatDuration(s);
  }

  const relativeTime = timeAgo;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-start justify-center overflow-y-auto">
      <div className="w-full max-w-7xl mx-auto p-4 lg:p-6 mt-4 mb-8 modal-enter">
        {/* Close button */}
        <button
          onClick={onClose}
          className="fixed top-4 right-4 z-50 p-2.5 bg-white/10 hover:bg-white/20 backdrop-blur-xl text-white rounded-full ring-1 ring-white/10 hover:ring-white/20 transition-all"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Video player */}
            <div className="relative bg-black rounded-2xl overflow-hidden group aspect-video">
              {videoUrl ? (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={handleVideoEnd}
                  onClick={togglePlay}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-10 h-10 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                </div>
              )}

              {/* Play overlay */}
              {!isPlaying && videoUrl && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <div className="w-16 h-16 bg-white/15 backdrop-blur-xl rounded-full flex items-center justify-center ring-1 ring-white/20 shadow-2xl">
                    <Play size={28} className="text-white ml-1" />
                  </div>
                </button>
              )}

              {/* Controls overlay with glassmorphism */}
              <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pt-16 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="mx-4 mb-4 px-4 py-3 bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10">
                  {/* Gradient progress bar */}
                  <div
                    className="w-full h-1.5 bg-white/10 rounded-full mb-3 cursor-pointer group/progress hover:h-2 transition-all"
                    onClick={handleSeek}
                  >
                    <div
                      className="h-full gradient-progress rounded-full relative"
                      style={{ width: `${progress}%` }}
                    >
                      <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg shadow-indigo-500/50 opacity-0 group-hover/progress:opacity-100 transition-opacity" />
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={togglePlay} className="text-white hover:text-indigo-400 transition-colors">
                        {isPlaying ? <Pause size={20} /> : <Play size={20} />}
                      </button>
                      <button onClick={toggleMute} className="text-white hover:text-indigo-400 transition-colors">
                        {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                      </button>
                      <span className="text-xs text-white/80 font-mono">
                        {timeFormat(currentTime)} / {timeFormat(duration)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <button
                          onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                          className="text-xs text-white bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg transition-colors font-medium"
                        >
                          {speed}x
                        </button>
                        {showSpeedMenu && (
                          <div className="absolute bottom-full right-0 mb-2 bg-black/80 backdrop-blur-xl rounded-xl overflow-hidden shadow-xl border border-white/10">
                            {SPEEDS.map((s) => (
                              <button
                                key={s}
                                onClick={() => changeSpeed(s)}
                                className={`block w-full px-4 py-2 text-xs text-left transition-colors ${
                                  speed === s
                                    ? 'bg-indigo-500 text-white'
                                    : 'text-white/80 hover:bg-white/10'
                                }`}
                              >
                                {s}x
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <button onClick={handleFullscreen} className="text-white hover:text-indigo-400 transition-colors">
                        <Maximize size={18} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Caption + tags */}
            <div className="mt-4">
              <p className="text-white text-lg font-semibold leading-snug">{currentPost.caption}</p>
              {currentPost.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentPost.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-indigo-400 hover:text-indigo-300 text-sm cursor-pointer transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Creator info */}
            <div className="flex items-center justify-between mt-4 py-4 border-t border-white/10">
              <div className="flex items-center gap-3">
                <div className="p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full ring-2 ring-indigo-500/30 shrink-0">
                  {currentPost.creator_avatar ? (
                    <img
                      src={currentPost.creator_avatar}
                      alt={currentPost.creator_name}
                      className="w-9 h-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-9 h-9 bg-black rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {currentPost.creator_name?.[0]?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div>
                  <p className="text-white font-medium text-sm">@{currentPost.creator_name}</p>
                  <p className="text-white/50 text-xs">
                    {formatCount(currentPost.view_count)} views
                  </p>
                </div>
              </div>
              <button
                onClick={handleSubscribe}
                className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                  isSubscribed
                    ? 'border border-white/20 text-white/70 hover:border-white/40'
                    : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 hover:-translate-y-0.5'
                }`}
              >
                {isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-1 py-3 border-t border-white/10">
              <button
                onClick={handleLike}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-medium transition-all ${
                  isLiked
                    ? 'bg-red-500/15 text-red-400 shadow-lg shadow-red-500/10'
                    : 'bg-white/5 text-white/70 hover:bg-white/10'
                }`}
              >
                <Heart
                  size={18}
                  className={`transition-transform ${likeAnimating ? 'animate-heart-burst' : ''} ${
                    isLiked ? 'fill-current' : ''
                  }`}
                />
                {formatCount(likeCount)}
              </button>
              <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 text-white/70 text-sm">
                <Eye size={18} />
                {formatCount(currentPost.view_count)}
              </div>
              <button
                onClick={() => document.getElementById('comment-input')?.focus()}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 text-white/70 hover:bg-white/10 text-sm transition-colors"
              >
                <MessageCircle size={18} />
                {formatCount(currentPost.comment_count)}
              </button>
              <button
                onClick={handleShare}
                className="relative flex items-center gap-2 px-4 py-2 rounded-2xl bg-white/5 text-white/70 hover:bg-white/10 text-sm transition-colors"
              >
                <Share2 size={18} />
                {shareToast ? 'Link copied!' : 'Share'}
              </button>
              <button
                onClick={() => setShowReport(!showReport)}
                className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 text-white/70 hover:bg-red-500/10 hover:text-red-400 text-sm transition-colors ml-auto"
              >
                <Flag size={16} />
              </button>
            </div>

            {/* Report form */}
            {showReport && (
              <div className="bg-white/5 rounded-xl p-4 mt-2 border border-white/10">
                <p className="text-white text-sm font-medium mb-2">Report this video</p>
                <input
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="Reason for reporting..."
                  className="w-full px-3 py-2 bg-white/10 rounded-lg text-sm text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={handleReport}
                    className="px-4 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:bg-red-600 transition-colors"
                  >
                    Submit Report
                  </button>
                  <button
                    onClick={() => setShowReport(false)}
                    className="px-4 py-1.5 bg-white/10 text-white/70 rounded-lg text-xs hover:bg-white/20 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* Comments */}
            <div className="mt-4 border-t border-white/10 pt-4">
              <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                Comments
                <span className="bg-white/10 text-white/60 px-2 py-0.5 rounded-full text-xs font-normal">
                  {comments.length}
                </span>
              </h3>

              {/* Comment input */}
              <div className="flex gap-3 mb-6">
                <div className="p-0.5 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full shrink-0">
                  <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                    Y
                  </div>
                </div>
                <div className="flex-1 flex gap-2">
                  <input
                    id="comment-input"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddComment()}
                    placeholder="Add a comment..."
                    className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-2xl text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:border-transparent transition-all"
                  />
                  <button
                    onClick={handleAddComment}
                    disabled={!commentText.trim()}
                    className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full disabled:opacity-30 transition-colors"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </div>

              {loadingComments ? (
                <div className="flex justify-center py-8">
                  <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : comments.length === 0 ? (
                <p className="text-center text-white/40 text-sm py-8">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-1">
                  {comments.map((c) => (
                    <div key={c.id} className="flex gap-3 group hover:bg-white/[0.03] rounded-xl p-2 transition-colors">
                      <div className="p-0.5 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full shrink-0 h-fit">
                        <div className="w-7 h-7 bg-black rounded-full flex items-center justify-center text-white text-xs font-bold">
                          {c.user_name?.[0]?.toUpperCase() ?? '?'}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium">@{c.user_name}</span>
                          <span className="text-white/30 text-xs">{relativeTime(c.created_at)}</span>
                        </div>
                        <p className="text-white/80 text-sm mt-0.5">{c.content}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteComment(c.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-white/30 hover:text-red-400 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar - Up Next */}
          <div className="w-full lg:w-80 xl:w-96 shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-semibold">Up Next</h3>
              <button
                onClick={() => setAutoplay(!autoplay)}
                className="flex items-center gap-2 text-xs text-white/60"
              >
                Autoplay
                <div
                  className={`relative w-8 h-4 rounded-full transition-colors ${
                    autoplay ? 'bg-indigo-500' : 'bg-white/20'
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform ${
                      autoplay ? 'translate-x-4' : 'translate-x-0.5'
                    }`}
                  />
                </div>
              </button>
            </div>
            <div className="space-y-2">
              {relatedPosts.map((rp, idx) => (
                <button
                  key={rp.id}
                  onClick={() => navigateToPost(rp)}
                  className="flex gap-3 w-full text-left group/card hover:bg-white/5 rounded-2xl p-2 transition-colors"
                >
                  <div className="w-40 aspect-video bg-slate-800 rounded-xl overflow-hidden relative shrink-0 hover:ring-1 ring-indigo-500/30 transition-all">
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center">
                      <Play size={16} className="text-white/40" />
                    </div>
                    <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-white text-[10px] font-medium rounded">
                      {formatDuration(rp.duration_seconds)}
                    </div>
                    {idx === 0 && autoplay && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-indigo-500/80 backdrop-blur-sm text-white text-[9px] font-semibold uppercase rounded tracking-wide">
                        Next
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 py-0.5">
                    <p className="text-white text-sm font-medium line-clamp-2 leading-snug group-hover/card:text-indigo-400 transition-colors">
                      {rp.caption}
                    </p>
                    <p className="text-white/50 text-xs mt-1">@{rp.creator_name}</p>
                    <p className="text-white/40 text-xs">
                      {formatCount(rp.view_count)} views
                    </p>
                  </div>
                </button>
              ))}
              {relatedPosts.length === 0 && (
                <p className="text-white/30 text-sm text-center py-8">No related videos</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
