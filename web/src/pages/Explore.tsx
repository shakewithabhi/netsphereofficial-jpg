import { useState, useEffect, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  TrendingUp,
  Play,
  ChevronLeft,
  ChevronRight,
  Flame,
  X,
  Trash2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { CreatePostModal } from '../components/CreatePostModal';
import { VideoWatchModal } from '../components/VideoWatchModal';
import type { Post } from '../api/explore';
import {
  getFeed,
  getTrendingFeed,
  getForYouFeed,
  getSubscriptionFeed,
  getCreatorPosts,
  deletePost,
  searchPosts,
  formatCount,
  formatDuration,
  CATEGORIES,
} from '../api/explore';
import { useAuth } from '../store/auth';

type Tab = 'foryou' | 'trending' | 'subscriptions' | 'myposts';

export default function Explore() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('foryou');
  const [activeCategory, setActiveCategory] = useState('All');
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [watchingPost, setWatchingPost] = useState<Post | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const trendingRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Initialize from URL params
  useEffect(() => {
    const watchId = searchParams.get('watch');
    if (watchId) {
      // Load that post
      import('../api/explore').then(({ getPost }) => {
        getPost(watchId).then(setWatchingPost).catch(() => {});
      });
    }
  }, []);

  useEffect(() => {
    loadContent();
  }, [activeTab, activeCategory]);

  useEffect(() => {
    setFadeIn(false);
    const timer = setTimeout(() => setFadeIn(true), 50);
    return () => clearTimeout(timer);
  }, [feedPosts]);

  async function loadContent() {
    setLoading(true);
    try {
      // Load trending for all tabs
      const trending = await getTrendingFeed(10);
      setTrendingPosts(trending);

      // Load main feed based on tab
      let posts: Post[] = [];
      if (activeTab === 'foryou') {
        posts = await getForYouFeed(20);
      } else if (activeTab === 'trending') {
        posts = await getTrendingFeed(20);
      } else if (activeTab === 'subscriptions') {
        posts = await getSubscriptionFeed(20);
      } else if (activeTab === 'myposts' && user) {
        posts = await getCreatorPosts(user.id);
      }

      // Filter by category
      if (activeCategory !== 'All') {
        posts = posts.filter((p) => p.category === activeCategory);
      }

      setFeedPosts(posts);
    } catch {
      /* ignore */
    }
    setLoading(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    try {
      const results = await searchPosts(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    }
    setSearching(false);
  }

  function clearSearch() {
    setSearchQuery('');
    setSearchResults(null);
  }

  function scrollTrending(dir: 'left' | 'right') {
    if (!trendingRef.current) return;
    const amount = 320;
    trendingRef.current.scrollBy({
      left: dir === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  }

  function handleWatchPost(post: Post) {
    setWatchingPost(post);
    setSearchParams({ watch: post.id });
  }

  function handleCloseWatch() {
    setWatchingPost(null);
    setSearchParams({});
  }

  function handlePostUpdate(updatedPost: Post) {
    setFeedPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
    setTrendingPosts((prev) =>
      prev.map((p) => (p.id === updatedPost.id ? updatedPost : p))
    );
  }

  function relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  }

  const displayPosts = searchResults ?? feedPosts;

  return (
    <Layout>
      <div className="min-h-full bg-slate-50 dark:bg-slate-900">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
            {/* Top row */}
            <div className="flex items-center justify-between py-3">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Play size={14} className="text-white ml-0.5" />
                </div>
                Explore
              </h1>

              <div className="flex items-center gap-3">
                {/* Search */}
                <form onSubmit={handleSearch} className="relative hidden sm:block">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search videos..."
                    className="w-48 lg:w-64 pl-9 pr-8 py-2 bg-slate-100 dark:bg-slate-700/50 border border-transparent focus:border-blue-500 rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 transition-all"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={clearSearch}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </form>

                {/* Create post */}
                <button
                  onClick={() => setShowCreatePost(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Post</span>
                </button>
              </div>
            </div>

            {/* Tabs + categories */}
            <div className="flex items-center gap-2 pb-3 overflow-x-auto scrollbar-hide">
              {/* Main tabs */}
              <button
                onClick={() => { setActiveTab('foryou'); clearSearch(); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'foryou' && !searchResults
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                For You
              </button>
              <button
                onClick={() => { setActiveTab('trending'); clearSearch(); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'trending' && !searchResults
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Trending
              </button>
              <button
                onClick={() => { setActiveTab('subscriptions'); clearSearch(); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'subscriptions' && !searchResults
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                Subscriptions
              </button>
              <button
                onClick={() => { setActiveTab('myposts'); clearSearch(); }}
                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  activeTab === 'myposts' && !searchResults
                    ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                }`}
              >
                My Posts
              </button>

              <div className="w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1 shrink-0" />

              {/* Category chips */}
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); clearSearch(); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm'
                      : 'bg-slate-100 dark:bg-slate-700/50 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-600'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Loading explore...</p>
              </div>
            </div>
          ) : searchResults !== null ? (
            /* Search results */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Search results for "{searchQuery}"
                </h2>
                <button
                  onClick={clearSearch}
                  className="text-sm text-blue-500 hover:text-blue-600"
                >
                  Clear search
                </button>
              </div>
              {searching ? (
                <div className="flex justify-center py-16">
                  <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <Search size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No videos found</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                <VideoGrid posts={searchResults} onWatch={handleWatchPost} relativeTime={relativeTime} />
              )}
            </div>
          ) : (
            <>
              {/* Trending section */}
              {trendingPosts.length > 0 && activeTab !== 'subscriptions' && (
                <section className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <Flame size={20} className="text-orange-500" />
                      Trending Now
                    </h2>
                    <div className="flex gap-2">
                      <button
                        onClick={() => scrollTrending('left')}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => scrollTrending('right')}
                        className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                      >
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>
                  <div
                    ref={trendingRef}
                    className="flex gap-4 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
                  >
                    {trendingPosts.map((post, i) => (
                      <button
                        key={post.id}
                        onClick={() => handleWatchPost(post)}
                        className="group shrink-0 w-72 sm:w-80"
                      >
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900">
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent z-10" />
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/30 flex items-center justify-center">
                            <Play size={32} className="text-white/30" />
                          </div>

                          {/* Trending badge */}
                          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full">
                            <TrendingUp size={12} className="text-white" />
                            <span className="text-white text-[10px] font-bold">#{i + 1} TRENDING</span>
                          </div>

                          {/* Duration */}
                          <div className="absolute bottom-3 right-3 z-20 px-2 py-0.5 bg-black/70 backdrop-blur-sm rounded-md text-white text-xs font-medium">
                            {formatDuration(post.duration_seconds)}
                          </div>

                          {/* Play on hover */}
                          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center transform group-hover:scale-110 transition-transform">
                              <Play size={20} className="text-white ml-0.5" />
                            </div>
                          </div>

                          {/* Bottom info */}
                          <div className="absolute bottom-3 left-3 z-20">
                            <p className="text-white text-sm font-semibold line-clamp-1 drop-shadow-lg">
                              {post.caption}
                            </p>
                            <p className="text-white/70 text-xs mt-0.5">
                              @{post.creator_name} &middot; {formatCount(post.view_count)} views
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {/* Main feed grid */}
              <section>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">
                  {activeTab === 'foryou'
                    ? 'For You'
                    : activeTab === 'trending'
                    ? 'Trending'
                    : activeTab === 'myposts'
                    ? `My Posts (${feedPosts.length})`
                    : 'Subscriptions'}
                </h2>
                {feedPosts.length === 0 ? (
                  <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                    <Play size={48} className="mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                      {activeTab === 'myposts' ? 'No posts yet' : 'No videos yet'}
                    </p>
                    <p className="text-sm mt-1">
                      {activeTab === 'myposts'
                        ? 'Videos you post to Explore will appear here'
                        : activeTab === 'subscriptions'
                        ? 'Subscribe to creators to see their videos here'
                        : 'Be the first to post a video!'}
                    </p>
                  </div>
                ) : (
                  <div
                    className={`transition-opacity duration-300 ${
                      fadeIn ? 'opacity-100' : 'opacity-0'
                    }`}
                  >
                    <VideoGrid
                      posts={feedPosts}
                      onWatch={handleWatchPost}
                      relativeTime={relativeTime}
                      showManage={activeTab === 'myposts'}
                      onDelete={async (postId) => {
                        try {
                          await deletePost(postId);
                          setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
                        } catch { /* ignore */ }
                      }}
                    />
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      {showCreatePost && (
        <CreatePostModal
          onClose={() => setShowCreatePost(false)}
          onCreated={() => {
            setShowCreatePost(false);
            loadContent();
          }}
        />
      )}

      {/* Watch Modal */}
      {watchingPost && (
        <VideoWatchModal
          post={watchingPost}
          onClose={handleCloseWatch}
          onPostUpdate={handlePostUpdate}
          onNavigate={(p) => {
            setWatchingPost(p);
            setSearchParams({ watch: p.id });
          }}
        />
      )}

      {/* Global styles */}
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </Layout>
  );
}

// ─── VideoGrid Component ─────────────────────────────────────

function VideoGrid({
  posts,
  onWatch,
  relativeTime,
  showManage,
  onDelete,
}: {
  posts: Post[];
  onWatch: (post: Post) => void;
  relativeTime: (dateStr: string) => string;
  showManage?: boolean;
  onDelete?: (postId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 lg:gap-5">
      {posts.map((post) => (
        <VideoCard key={post.id} post={post} onWatch={onWatch} relativeTime={relativeTime} showManage={showManage} onDelete={onDelete} />
      ))}
    </div>
  );
}

// ─── VideoCard Component ─────────────────────────────────────

function VideoCard({
  post,
  onWatch,
  relativeTime,
  showManage,
  onDelete,
}: {
  post: Post;
  onWatch: (post: Post) => void;
  relativeTime: (dateStr: string) => string;
  showManage?: boolean;
  onDelete?: (postId: string) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="group text-left w-full">
      {/* Thumbnail */}
      <button
        onClick={() => onWatch(post)}
        className="w-full text-left"
      >
        <div className="relative aspect-video rounded-xl overflow-hidden bg-slate-200 dark:bg-slate-800 hover:scale-[1.02] transition-transform duration-200 shadow-sm hover:shadow-lg">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-300 dark:from-slate-700 to-slate-400 dark:to-slate-800 flex items-center justify-center">
            <Play size={24} className="text-slate-400 dark:text-slate-500" />
          </div>

          {/* Hover play */}
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10">
            <div className="w-11 h-11 bg-black/40 backdrop-blur-sm rounded-full flex items-center justify-center">
              <Play size={18} className="text-white ml-0.5" />
            </div>
          </div>

          {/* Duration badge */}
          <div className="absolute bottom-2 right-2 z-10 px-1.5 py-0.5 bg-black/75 backdrop-blur-sm rounded text-white text-[11px] font-medium">
            {formatDuration(post.duration_seconds)}
          </div>

          {/* Gradient overlay on hover */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>
      </button>

      {/* Info */}
      <div className="flex gap-3 mt-3">
        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0">
          {post.creator_name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div className="flex-1 min-w-0">
          <button onClick={() => onWatch(post)} className="text-left">
            <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
              {post.caption}
            </p>
          </button>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {formatCount(post.view_count)} views &middot; {formatCount(post.like_count)} likes &middot; {relativeTime(post.created_at)}
          </p>

          {/* Manage controls for own posts */}
          {showManage && (
            <div className="flex items-center gap-2 mt-2">
              {confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-red-500">Delete this post?</span>
                  <button
                    onClick={() => { onDelete?.(post.id); setConfirmDelete(false); }}
                    className="px-2 py-1 text-xs font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors"
                  >
                    Yes, delete
                  </button>
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                >
                  <Trash2 size={12} />
                  Delete from Explore
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
