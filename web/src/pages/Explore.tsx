import React, { useState, useEffect, useRef } from 'react';
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
  Eye,
  Heart,
  Sparkles,
  Crown,
  Clock,
  Film,
  Pencil,
  Loader2,
} from 'lucide-react';
import { Layout } from '../components/Layout';
import { CreatePostModal } from '../components/CreatePostModal';
import { VideoWatchModal } from '../components/VideoWatchModal';
import { InFeedAd } from '../components/AdBanner';
import { useToast } from '../components/Toast';
import type { Post } from '../api/explore';
import {
  getFeed,
  getTrendingFeed,
  getForYouFeed,
  getSubscriptionFeed,
  getCreatorPosts,
  deletePost,
  updatePost,
  searchPosts,
  formatCount,
  formatDuration,
  CATEGORIES,
} from '../api/explore';
import { useAuth } from '../store/auth';
import { timeAgo } from '../utils/format';

type Tab = 'foryou' | 'trending' | 'subscriptions' | 'myposts';

const FEED_PAGE_SIZE = 20;

export default function Explore() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>('foryou');
  const [activeCategory, setActiveCategory] = useState('All');
  const [trendingPosts, setTrendingPosts] = useState<Post[]>([]);
  const [feedPosts, setFeedPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Post[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const [showCreatePost, setShowCreatePost] = useState(false);
  const [watchingPost, setWatchingPost] = useState<Post | null>(null);
  const [fadeIn, setFadeIn] = useState(false);
  const trendingRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Edit post state
  const [editingPost, setEditingPost] = useState<Post | null>(null);

  // Hero banner state
  const [heroIndex, setHeroIndex] = useState(0);
  const heroTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Initialize from URL params
  useEffect(() => {
    const watchId = searchParams.get('watch');
    if (watchId) {
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

  // Hero auto-cycle
  useEffect(() => {
    if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    const heroCount = Math.min(trendingPosts.length, 5);
    if (heroCount > 1) {
      heroTimerRef.current = setInterval(() => {
        setHeroIndex((prev) => (prev + 1) % heroCount);
      }, 6000);
    }
    return () => {
      if (heroTimerRef.current) clearInterval(heroTimerRef.current);
    };
  }, [trendingPosts]);

  // Infinite scroll observer
  useEffect(() => {
    if (!loadMoreRef.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && hasMore && !loading && !searchResults) {
          loadMore();
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadingMore, hasMore, loading, searchResults, feedPosts.length, activeTab, activeCategory]);

  async function loadContent() {
    setLoading(true);
    setError('');
    setHasMore(true);
    try {
      // Load trending for all tabs
      const trending = await getTrendingFeed(10);
      setTrendingPosts(trending);

      // Load main feed based on tab
      let posts: Post[] = [];
      if (activeTab === 'foryou') {
        posts = await getForYouFeed(FEED_PAGE_SIZE, 0);
      } else if (activeTab === 'trending') {
        posts = await getTrendingFeed(FEED_PAGE_SIZE, 0);
      } else if (activeTab === 'subscriptions') {
        posts = await getSubscriptionFeed(FEED_PAGE_SIZE, 0);
      } else if (activeTab === 'myposts' && user) {
        posts = await getCreatorPosts(user.id);
      }

      // Filter by category
      if (activeCategory !== 'All') {
        posts = posts.filter((p) => p.category === activeCategory);
      }

      setFeedPosts(posts);
      setHasMore(posts.length >= FEED_PAGE_SIZE);
    } catch {
      setError('Failed to load content. Please try again.');
    }
    setLoading(false);
  }

  async function loadMore() {
    if (loadingMore || !hasMore || activeTab === 'myposts') return;
    setLoadingMore(true);
    try {
      const offset = feedPosts.length;
      let newPosts: Post[] = [];
      if (activeTab === 'foryou') {
        newPosts = await getForYouFeed(FEED_PAGE_SIZE, offset);
      } else if (activeTab === 'trending') {
        newPosts = await getTrendingFeed(FEED_PAGE_SIZE, offset);
      } else if (activeTab === 'subscriptions') {
        newPosts = await getSubscriptionFeed(FEED_PAGE_SIZE, offset);
      }

      if (activeCategory !== 'All') {
        newPosts = newPosts.filter((p) => p.category === activeCategory);
      }

      if (newPosts.length < FEED_PAGE_SIZE) {
        setHasMore(false);
      }

      // Deduplicate
      const existingIds = new Set(feedPosts.map((p) => p.id));
      const unique = newPosts.filter((p) => !existingIds.has(p.id));
      if (unique.length === 0) {
        setHasMore(false);
      } else {
        setFeedPosts((prev) => [...prev, ...unique]);
      }
    } catch {
      // Silently fail on load-more
    }
    setLoadingMore(false);
  }

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    setError('');
    try {
      const results = await searchPosts(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setError('Search failed. Please try again.');
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
    const amount = 360;
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

  async function handleDeletePost(postId: string) {
    try {
      await deletePost(postId);
      setFeedPosts((prev) => prev.filter((p) => p.id !== postId));
      toast({ title: 'Post deleted', type: 'success' });
    } catch {
      toast({ title: 'Failed to delete post', type: 'error' });
    }
  }

  async function handleEditPost(postId: string, data: { caption: string; category: string; tags: string[] }) {
    try {
      const updated = await updatePost(postId, data);
      setFeedPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      setTrendingPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
      setEditingPost(null);
      toast({ title: 'Post updated', type: 'success' });
    } catch {
      toast({ title: 'Failed to update post', type: 'error' });
    }
  }

  const relativeTime = timeAgo;

  const displayPosts = searchResults ?? feedPosts;

  const heroSlices = trendingPosts.slice(0, 5);
  const heroPost = heroSlices[heroIndex] ?? null;

  return (
    <Layout>
      <div className="min-h-full bg-slate-50 dark:bg-[#0B0F19] explore-scrollbar">
        {/* Header */}
        <div className="sticky top-0 z-30 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-white/[0.05]/50">
          <div className="max-w-[1600px] mx-auto px-4 lg:px-6">
            {/* Top row */}
            <div className="flex items-center justify-between py-3">
              <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-500/25">
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
                    className="w-48 lg:w-64 pl-9 pr-8 py-2 bg-slate-100 dark:bg-[#1E293B]/50 border border-transparent focus:border-indigo-500 rounded-xl text-sm text-slate-800 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all"
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
                  className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={16} />
                  <span className="hidden sm:inline">Post</span>
                </button>
              </div>
            </div>

            {/* Tabs + categories */}
            <div className="flex items-center gap-1.5 pb-3 overflow-x-auto scrollbar-hide">
              {/* Premium pill tabs */}
              <button
                onClick={() => { setActiveTab('foryou'); clearSearch(); }}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'foryou' && !searchResults
                    ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400'
                    : 'text-slate-500 hover:bg-white/5'
                }`}
              >
                <Sparkles size={14} />
                For You
                {activeTab === 'foryou' && !searchResults && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('trending'); clearSearch(); }}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'trending' && !searchResults
                    ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400'
                    : 'text-slate-500 hover:bg-white/5'
                }`}
              >
                <Flame size={14} />
                Trending
                {activeTab === 'trending' && !searchResults && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('subscriptions'); clearSearch(); }}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'subscriptions' && !searchResults
                    ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400'
                    : 'text-slate-500 hover:bg-white/5'
                }`}
              >
                <Heart size={14} />
                Subscriptions
                {activeTab === 'subscriptions' && !searchResults && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                )}
              </button>
              <button
                onClick={() => { setActiveTab('myposts'); clearSearch(); }}
                className={`relative shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  activeTab === 'myposts' && !searchResults
                    ? 'bg-gradient-to-r from-indigo-500/10 to-purple-500/10 text-indigo-400'
                    : 'text-slate-500 hover:bg-white/5'
                }`}
              >
                <Play size={14} />
                My Posts
                {activeTab === 'myposts' && !searchResults && (
                  <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" />
                )}
              </button>

              <div className="w-px h-5 bg-slate-200 dark:bg-[#1e293b]/50 mx-1 shrink-0" />

              {/* Category chips */}
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => { setActiveCategory(cat); clearSearch(); }}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    activeCategory === cat
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white shadow-lg shadow-indigo-500/25 chip-glow'
                      : 'bg-slate-100 dark:bg-white/5 text-slate-500 hover:bg-white/10 border border-transparent hover:border-white/10'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="max-w-[1600px] mx-auto px-4 lg:px-6 py-6">
          {error && (
            <div className="mb-6 flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl text-sm">
              <span className="flex-1">{error}</span>
              <button
                onClick={() => { setError(''); loadContent(); }}
                className="px-3 py-1 bg-red-100 dark:bg-red-900/50 hover:bg-red-200 dark:hover:bg-red-800 rounded-lg text-xs font-medium transition-colors"
              >
                Retry
              </button>
              <button onClick={() => setError('')}>
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            /* Premium Skeleton Loading */
            <div className="space-y-8 animate-in fade-in">
              {/* Hero skeleton */}
              <div className="video-skeleton h-[180px] sm:h-[220px] lg:h-[260px] rounded-3xl" />

              {/* Trending row skeleton */}
              <div>
                <div className="h-6 w-40 video-skeleton rounded-lg mb-4" />
                <div className="flex gap-4 overflow-hidden">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="shrink-0 w-80">
                      <div className="video-skeleton aspect-video rounded-2xl" />
                      <div className="mt-3 flex gap-3">
                        <div className="video-skeleton w-9 h-9 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="video-skeleton h-4 w-3/4 rounded-md" />
                          <div className="video-skeleton h-3 w-1/2 rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Grid skeleton */}
              <div>
                <div className="h-6 w-32 video-skeleton rounded-lg mb-4" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
                  {[...Array(8)].map((_, i) => (
                    <div key={i}>
                      <div className="video-skeleton aspect-video rounded-2xl" />
                      <div className="mt-3 flex gap-3">
                        <div className="video-skeleton w-9 h-9 rounded-full shrink-0" />
                        <div className="flex-1 space-y-2">
                          <div className="video-skeleton h-4 w-full rounded-md" />
                          <div className="video-skeleton h-3 w-2/3 rounded-md" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : searchResults !== null ? (
            /* Search results */
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  Search results for &ldquo;{searchQuery}&rdquo;
                </h2>
                <button
                  onClick={clearSearch}
                  className="text-sm text-indigo-500 hover:text-indigo-600 font-medium"
                >
                  Clear search
                </button>
              </div>
              {searching ? (
                <div className="space-y-0">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
                    {[...Array(8)].map((_, i) => (
                      <div key={i}>
                        <div className="video-skeleton aspect-video rounded-2xl" />
                        <div className="mt-3 flex gap-3">
                          <div className="video-skeleton w-9 h-9 rounded-full shrink-0" />
                          <div className="flex-1 space-y-2">
                            <div className="video-skeleton h-4 w-full rounded-md" />
                            <div className="video-skeleton h-3 w-2/3 rounded-md" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : searchResults.length === 0 ? (
                <div className="text-center py-20">
                  <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center">
                    <Search size={32} className="text-indigo-400/50" />
                  </div>
                  <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">No videos found</p>
                  <p className="text-sm mt-2 text-slate-400 dark:text-slate-500">Try a different search term</p>
                </div>
              ) : (
                <VideoGrid
                  posts={searchResults}
                  onWatch={handleWatchPost}
                  relativeTime={relativeTime}
                  currentUserId={user?.id}
                  onDelete={handleDeletePost}
                  onEdit={setEditingPost}
                />
              )}
            </div>
          ) : (
            <>
              {/* Hero Banner */}
              {trendingPosts.length > 0 && activeTab !== 'myposts' && heroPost && (
                <section className="mb-8">
                  <button
                    onClick={() => handleWatchPost(heroPost)}
                    className="group relative w-full h-[180px] sm:h-[220px] lg:h-[260px] rounded-3xl overflow-hidden text-left"
                  >
                    {/* Background */}
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900">
                      {heroPost.thumbnail_url ? (
                        <img
                          src={heroPost.thumbnail_url}
                          alt=""
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : heroPost.video_url ? (
                        <video
                          src={heroPost.video_url + '#t=2'}
                          preload="metadata"
                          muted
                          playsInline
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      ) : null}
                    </div>

                    {/* Multi-layer gradient overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
                    <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />

                    {/* Frosted play button */}
                    <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                      <div className="w-20 h-20 bg-white/15 backdrop-blur-xl rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 ring-1 ring-white/20">
                        <Play size={32} className="text-white ml-1" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5 lg:p-6 z-10">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full text-white text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-orange-500/30">
                          <Crown size={10} />
                          Featured
                        </span>
                        {heroPost.category && (
                          <span className="px-2.5 py-1 bg-white/10 backdrop-blur-md rounded-full text-white/80 text-[10px] font-medium border border-white/10">
                            {heroPost.category}
                          </span>
                        )}
                      </div>

                      <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-white line-clamp-2 mb-2 drop-shadow-lg max-w-3xl leading-tight">
                        {heroPost.caption}
                      </h2>

                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold ring-2 ring-white/20">
                            {heroPost.creator_name?.[0]?.toUpperCase() ?? '?'}
                          </div>
                          <span className="text-white/90 text-sm font-medium">@{heroPost.creator_name}</span>
                        </div>
                        <div className="flex items-center gap-3 text-white/60 text-xs">
                          <span className="flex items-center gap-1">
                            <Eye size={12} />
                            {formatCount(heroPost.view_count)} views
                          </span>
                          <span className="flex items-center gap-1">
                            <Heart size={12} />
                            {formatCount(heroPost.like_count)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Dot indicators */}
                    {heroSlices.length > 1 && (
                      <div className="absolute bottom-6 right-6 sm:bottom-8 sm:right-8 z-20 flex items-center gap-1.5">
                        {heroSlices.map((_, i) => (
                          <button
                            key={i}
                            onClick={(e) => { e.stopPropagation(); setHeroIndex(i); }}
                            className={`h-1.5 rounded-full transition-all duration-300 ${
                              i === heroIndex ? 'w-8 bg-white' : 'w-1.5 bg-white/40 hover:bg-white/60'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </button>
                </section>
              )}

              {/* Trending Carousel */}
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
                        className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-slate-500 dark:text-slate-400 hover:bg-white/20 transition-all"
                      >
                        <ChevronLeft size={18} />
                      </button>
                      <button
                        onClick={() => scrollTrending('right')}
                        className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-slate-500 dark:text-slate-400 hover:bg-white/20 transition-all"
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
                        className="group shrink-0 w-80 sm:w-[340px]"
                      >
                        <div className="relative aspect-video rounded-2xl overflow-hidden bg-slate-900 hover:shadow-xl hover:shadow-indigo-500/10 transition-all duration-300">
                          {/* Gradient overlay */}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />
                          {post.thumbnail_url ? (
                            <img src={post.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
                          ) : post.video_url ? (
                            <video
                              src={post.video_url + '#t=1'}
                              preload="metadata"
                              muted
                              playsInline
                              className="absolute inset-0 w-full h-full object-cover"
                            />
                          ) : (
                            <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/30 to-purple-900/40 flex items-center justify-center">
                              <Play size={32} className="text-white/20" />
                            </div>
                          )}

                          {/* Rank number for top 3 */}
                          {i < 3 && (
                            <div className="absolute top-2 right-3 z-20">
                              <span className="text-[64px] font-black leading-none text-white/10 select-none">
                                #{i + 1}
                              </span>
                            </div>
                          )}

                          {/* Trending badge */}
                          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-orange-500 to-red-500 rounded-full shadow-lg shadow-orange-500/30">
                            <TrendingUp size={12} className="text-white" />
                            <span className="text-white text-[10px] font-bold">#{i + 1} TRENDING</span>
                          </div>

                          {/* Duration */}
                          {post.duration_seconds > 0 && (
                            <div className="absolute bottom-3 right-3 z-20 px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-lg text-white text-[11px] font-medium">
                              {formatDuration(post.duration_seconds)}
                            </div>
                          )}

                          {/* Play on hover */}
                          <div className="absolute inset-0 z-20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300">
                            <div className="w-14 h-14 bg-white/15 backdrop-blur-xl rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 ring-1 ring-white/20">
                              <Play size={22} className="text-white ml-0.5" />
                            </div>
                          </div>

                          {/* Bottom glassmorphism info */}
                          <div className="absolute bottom-0 left-0 right-0 z-20 p-3 bg-gradient-to-t from-black/80 via-black/40 to-transparent backdrop-blur-[2px]">
                            <p className="text-white text-sm font-semibold line-clamp-1 drop-shadow-lg">
                              {post.caption}
                            </p>
                            <p className="text-white/60 text-xs mt-0.5 flex items-center gap-2">
                              <span>@{post.creator_name}</span>
                              <span className="flex items-center gap-0.5">
                                <Eye size={10} />
                                {formatCount(post.view_count)}
                              </span>
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
                  <div className="text-center py-20">
                    <div className="w-20 h-20 mx-auto mb-5 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-3xl flex items-center justify-center">
                      <Play size={32} className="text-indigo-400/50" />
                    </div>
                    <p className="font-semibold text-slate-700 dark:text-slate-300 text-lg">
                      {activeTab === 'myposts' ? 'No posts yet' : 'No videos yet'}
                    </p>
                    <p className="text-sm mt-2 text-slate-400 dark:text-slate-500 max-w-sm mx-auto">
                      {activeTab === 'myposts'
                        ? 'Videos you post to Explore will appear here'
                        : activeTab === 'subscriptions'
                        ? 'Subscribe to creators to see their videos here'
                        : 'Be the first to post a video!'}
                    </p>
                    <button
                      onClick={() => setShowCreatePost(true)}
                      className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                      <Plus size={16} />
                      Create Post
                    </button>
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
                      currentUserId={user?.id}
                      onDelete={handleDeletePost}
                      onEdit={setEditingPost}
                    />
                  </div>
                )}

                {/* Infinite scroll sentinel */}
                <div ref={loadMoreRef} className="h-1" />
                {loadingMore && (
                  <div className="flex items-center justify-center py-8 gap-3">
                    <Loader2 size={20} className="text-indigo-500 animate-spin" />
                    <span className="text-sm text-slate-400 dark:text-slate-500">Loading more videos...</span>
                  </div>
                )}
                {!hasMore && feedPosts.length > 0 && !loading && (
                  <div className="text-center py-8">
                    <p className="text-sm text-slate-400 dark:text-slate-500">You have reached the end</p>
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

      {/* Edit Post Modal */}
      {editingPost && (
        <EditPostModal
          post={editingPost}
          onClose={() => setEditingPost(null)}
          onSave={handleEditPost}
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

        .explore-scrollbar::-webkit-scrollbar { width: 6px; }
        .explore-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .explore-scrollbar::-webkit-scrollbar-thumb { background: rgba(99, 102, 241, 0.2); border-radius: 3px; }
        .explore-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(99, 102, 241, 0.4); }

        .video-skeleton {
          background: linear-gradient(110deg, transparent 30%, rgba(99, 102, 241, 0.04) 50%, transparent 70%),
                      linear-gradient(to right, #f1f5f9, #e2e8f0);
          background-size: 200% 100%, 100% 100%;
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        .dark .video-skeleton {
          background: linear-gradient(110deg, transparent 30%, rgba(99, 102, 241, 0.06) 50%, transparent 70%),
                      linear-gradient(to right, #141b2d, #1a2236);
          background-size: 200% 100%, 100% 100%;
          animation: skeleton-shimmer 1.8s ease-in-out infinite;
        }
        @keyframes skeleton-shimmer {
          0% { background-position: 200% 0, 0 0; }
          100% { background-position: -200% 0, 0 0; }
        }

        .card-enter {
          animation: card-enter-anim 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
          transform: translateY(12px);
        }
        @keyframes card-enter-anim {
          to { opacity: 1; transform: translateY(0); }
        }

        .hover-glow {
          position: relative;
        }
        .hover-glow::after {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          opacity: 0;
          transition: opacity 0.3s;
          box-shadow: 0 0 30px rgba(99, 102, 241, 0.15);
          pointer-events: none;
        }
        .group:hover .hover-glow::after {
          opacity: 1;
        }

        .chip-glow {
          box-shadow: 0 0 12px rgba(99, 102, 241, 0.3), 0 0 4px rgba(99, 102, 241, 0.2);
        }

        @keyframes upload-shimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        .upload-progress-bar {
          background: linear-gradient(90deg, #6366f1 0%, #a855f7 30%, #6366f1 60%, #a855f7 100%);
          background-size: 200% 100%;
          animation: upload-shimmer 1.5s ease-in-out infinite;
        }
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
  currentUserId,
  onDelete,
  onEdit,
}: {
  posts: Post[];
  onWatch: (post: Post) => void;
  relativeTime: (dateStr: string) => string;
  showManage?: boolean;
  currentUserId?: string;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 lg:gap-6">
      {posts.map((post, index) => (
        <React.Fragment key={post.id}>
          <VideoCard
            post={post}
            index={index}
            onWatch={onWatch}
            relativeTime={relativeTime}
            showManage={showManage}
            isOwner={!!currentUserId && post.user_id === currentUserId}
            onDelete={onDelete}
            onEdit={onEdit}
          />
          {(index + 1) % 6 === 0 && (
            <div className="col-span-full">
              <InFeedAd />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ─── Avatar colors for creator initials ──────────────────────

const AVATAR_COLORS = [
  'from-rose-500 to-pink-600',
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-500 to-orange-600',
  'from-indigo-500 to-blue-600',
  'from-fuchsia-500 to-pink-600',
  'from-cyan-500 to-blue-600',
];

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── VideoCard Component ─────────────────────────────────────

function VideoCard({
  post,
  index,
  onWatch,
  relativeTime,
  showManage,
  isOwner,
  onDelete,
  onEdit,
}: {
  post: Post;
  index?: number;
  onWatch: (post: Post) => void;
  relativeTime: (dateStr: string) => string;
  showManage?: boolean;
  isOwner?: boolean;
  onDelete?: (postId: string) => void;
  onEdit?: (post: Post) => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [videoError, setVideoError] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const creatorName = post.creator_name || 'Unknown';
  const avatarGradient = getAvatarColor(creatorName);
  const showOwnerControls = isOwner || showManage;

  function handleMouseEnter() {
    if (videoRef.current && !videoError) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch(() => {});
    }
  }

  function handleMouseLeave() {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 1;
    }
  }

  return (
    <div
      className="group text-left w-full card-enter"
      style={{ animationDelay: `${Math.min(index ?? 0, 11) * 60}ms` }}
    >
      {/* Thumbnail - YouTube-style 16:9 */}
      <div
        onClick={() => onWatch(post)}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className="relative aspect-video rounded-2xl overflow-hidden bg-slate-200 dark:bg-[#0F172A] cursor-pointer hover:shadow-xl hover:shadow-indigo-500/10 hover-glow transform hover:scale-[1.03] transition-all duration-300"
      >
        {post.thumbnail_url && !videoError ? (
          <>
            <img
              src={post.thumbnail_url}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
              loading="lazy"
            />
            {/* Hidden video for hover-play */}
            {post.video_url && (
              <video
                ref={videoRef}
                src={post.video_url}
                preload="metadata"
                muted
                playsInline
                onError={() => setVideoError(true)}
                className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
            )}
          </>
        ) : post.video_url && !videoError ? (
          <video
            ref={videoRef}
            src={post.video_url + '#t=1'}
            preload="metadata"
            muted
            playsInline
            onError={() => setVideoError(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-800 to-purple-900/30 flex items-center justify-center">
            <Film size={28} className="text-slate-500/50" />
          </div>
        )}

        {/* Frosted play button on hover */}
        <div className="absolute inset-0 flex items-center justify-center z-10 opacity-0 group-hover:opacity-100 transition-all duration-300">
          <div className="w-12 h-12 bg-white/15 backdrop-blur-xl rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300 ring-1 ring-white/20">
            <Play size={18} className="text-white ml-0.5" />
          </div>
        </div>

        {/* Duration badge - bottom right */}
        {post.duration_seconds > 0 && (
          <div className="absolute bottom-2 right-2 z-10 px-2 py-0.5 bg-black/80 backdrop-blur-sm rounded-md text-white text-[11px] font-semibold tracking-wide">
            {formatDuration(post.duration_seconds)}
          </div>
        )}

        {/* Gradient overlay on hover */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      {/* Info section below thumbnail - YouTube style */}
      <div className="mt-3 px-0.5">
        {/* Title - truncated to 2 lines */}
        <button onClick={() => onWatch(post)} className="text-left w-full">
          <p className="text-sm font-semibold text-slate-900 dark:text-white line-clamp-2 leading-snug group-hover:text-indigo-400 transition-colors">
            {post.caption}
          </p>
        </button>

        {/* Creator avatar + name */}
        <div className="flex items-center gap-2 mt-2">
          <div className={`w-6 h-6 bg-gradient-to-br ${avatarGradient} rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0 overflow-hidden`}>
            {post.creator_avatar ? (
              <img src={post.creator_avatar} className="w-full h-full object-cover" alt="" />
            ) : (
              creatorName[0]?.toUpperCase() ?? 'U'
            )}
          </div>
          <span className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">
            {creatorName}
          </span>
        </div>

        {/* Views + time ago */}
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
          {formatCount(post.view_count)} views &middot; {relativeTime(post.created_at)}
        </p>

        {/* Owner controls: delete + edit */}
        {showOwnerControls && (
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
                  className="px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-[#1E293B] hover:bg-slate-200 dark:hover:bg-white/[0.1] rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onEdit?.(post)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-colors"
                >
                  <Pencil size={12} />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg transition-colors"
                >
                  <Trash2 size={12} />
                  Delete
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── EditPostModal Component ─────────────────────────────────

function EditPostModal({
  post,
  onClose,
  onSave,
}: {
  post: Post;
  onClose: () => void;
  onSave: (postId: string, data: { caption: string; category: string; tags: string[] }) => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [category, setCategory] = useState(post.category);
  const [tags, setTags] = useState<string[]>(post.tags ?? []);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

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

  async function handleSave() {
    if (!caption.trim()) return;
    setSaving(true);
    await onSave(post.id, { caption: caption.trim(), category, tags });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-lg bg-white dark:bg-[#0F172A] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-white/[0.05]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <Pencil size={16} className="text-white" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Edit Post</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 max-h-[60vh] overflow-y-auto">
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
              className="w-full px-4 py-3 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-colors"
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
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
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
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-medium"
                >
                  #{tag}
                  <button
                    onClick={() => setTags(tags.filter((t) => t !== tag))}
                    className="hover:text-indigo-800 dark:hover:text-indigo-300"
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
              className="w-full px-4 py-2.5 bg-slate-50 dark:bg-[#1E293B]/50 border border-slate-200 dark:border-white/[0.08] rounded-xl text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-white/[0.05] bg-slate-50 dark:bg-[#0F172A]/50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !caption.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl text-sm font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            {saving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
