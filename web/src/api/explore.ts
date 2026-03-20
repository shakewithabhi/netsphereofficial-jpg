import client from './client';

// ─── Types ───────────────────────────────────────────────────

export interface Post {
  id: string;
  file_id: string;
  user_id: string;
  caption: string;
  category: string;
  tags: string[];
  thumbnail_url: string | null;
  video_url: string | null;
  duration_seconds: number;
  view_count: number;
  like_count: number;
  comment_count: number;
  created_at: string;
  updated_at: string;
  creator_name: string;
  creator_avatar: string | null;
  is_liked: boolean;
  is_subscribed: boolean;
}

export interface PostComment {
  id: string;
  post_id: string;
  user_id: string;
  user_name: string;
  user_avatar: string | null;
  content: string;
  created_at: string;
}

export interface CreatorProfile {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  subscriber_count: number;
  post_count: number;
  total_views: number;
  is_subscribed: boolean;
  posts: Post[];
}

export interface TrendingTag {
  tag: string;
  count: number;
}

// ─── Feed Endpoints ──────────────────────────────────────────

export async function getFeed(
  sort = 'latest',
  category?: string,
  tag?: string,
  limit = 20,
  offset = 0
): Promise<Post[]> {
  const params: Record<string, string | number> = { sort, limit, offset };
  if (category) params.category = category;
  if (tag) params.tag = tag;
  const res = await client.get('/explore/feed', { params });
  return res.data.data?.posts ?? res.data.data ?? [];
}

export async function getTrendingFeed(limit = 10, offset = 0): Promise<Post[]> {
  const res = await client.get('/explore/feed/trending', { params: { limit, offset } });
  return res.data.data?.posts ?? res.data.data ?? [];
}

export async function getForYouFeed(limit = 20, offset = 0): Promise<Post[]> {
  const res = await client.get('/explore/feed/foryou', { params: { limit, offset } });
  return res.data.data?.posts ?? res.data.data ?? [];
}

export async function getSubscriptionFeed(limit = 20, offset = 0): Promise<Post[]> {
  const res = await client.get('/explore/feed/subscriptions', { params: { limit, offset } });
  return res.data.data?.posts ?? res.data.data ?? [];
}

export async function searchPosts(query: string, limit = 20): Promise<Post[]> {
  const res = await client.get('/explore/search', { params: { q: query, limit } });
  return res.data.data?.posts ?? res.data.data ?? [];
}

// ─── Post CRUD ───────────────────────────────────────────────

export async function createPost(
  file_id: string,
  caption: string,
  category: string,
  tags: string[]
): Promise<Post> {
  const res = await client.post('/explore/posts', { file_id, caption, category, tags });
  return res.data.data;
}

export async function getPost(id: string): Promise<Post> {
  const res = await client.get(`/explore/posts/${id}`);
  return res.data.data;
}

export async function updatePost(
  id: string,
  data: { caption?: string; category?: string; tags?: string[] }
): Promise<Post> {
  const res = await client.put(`/explore/posts/${id}`, data);
  return res.data.data;
}

export async function deletePost(id: string): Promise<void> {
  await client.delete(`/explore/posts/${id}`);
}

// ─── Engagement ──────────────────────────────────────────────

export async function likePost(id: string): Promise<void> {
  await client.post(`/explore/posts/${id}/like`);
}

export async function unlikePost(id: string): Promise<void> {
  await client.delete(`/explore/posts/${id}/like`);
}

export async function recordView(id: string, duration_seconds: number): Promise<void> {
  await client.post(`/explore/posts/${id}/view`, { duration_seconds });
}

export async function getRelatedPosts(id: string): Promise<Post[]> {
  const res = await client.get(`/explore/posts/${id}/related`);
  return res.data.data?.posts ?? res.data.data ?? [];
}

// ─── Comments ────────────────────────────────────────────────

export async function getPostComments(id: string): Promise<PostComment[]> {
  const res = await client.get(`/explore/posts/${id}/comments`);
  return res.data.data?.comments ?? res.data.data ?? [];
}

export async function addComment(id: string, content: string): Promise<PostComment> {
  const res = await client.post(`/explore/posts/${id}/comments`, { content });
  return res.data.data;
}

export async function deleteComment(postId: string, commentId: string): Promise<void> {
  await client.delete(`/explore/posts/${postId}/comments/${commentId}`);
}

// ─── Subscriptions ───────────────────────────────────────────

export async function subscribe(userId: string): Promise<void> {
  await client.post(`/explore/creators/${userId}/subscribe`);
}

export async function unsubscribe(userId: string): Promise<void> {
  await client.delete(`/explore/creators/${userId}/subscribe`);
}

export async function getCreatorPosts(userId: string, limit = 50): Promise<Post[]> {
  const res = await client.get(`/explore/creators/${userId}/posts`, { params: { limit } });
  return res.data.data?.posts ?? res.data.data ?? [];
}

export async function getCreatorProfile(userId: string): Promise<CreatorProfile> {
  const res = await client.get(`/explore/creators/${userId}`);
  return res.data.data;
}

// ─── History & Reporting ─────────────────────────────────────

export async function getWatchHistory(): Promise<Post[]> {
  const res = await client.get('/explore/history');
  return res.data.data?.posts ?? res.data.data ?? [];
}

export async function reportPost(id: string, reason: string, details?: string): Promise<void> {
  await client.post(`/explore/posts/${id}/report`, { reason, details });
}

// ─── Tags ────────────────────────────────────────────────────

export async function getTrendingTags(): Promise<TrendingTag[]> {
  const res = await client.get('/explore/tags');
  return res.data.data?.tags ?? res.data.data ?? [];
}

// ─── Helpers ─────────────────────────────────────────────────

export function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export const CATEGORIES = [
  'All',
  'Music',
  'Gaming',
  'Education',
  'Sports',
  'Entertainment',
  'Technology',
  'Travel',
  'Food',
  'Art',
  'Science',
  'News',
] as const;
