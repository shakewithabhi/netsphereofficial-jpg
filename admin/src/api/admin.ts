import client from './client';

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_files: number;
  total_storage_bytes: number;
  total_storage_used: number;
  total_storage_allocated: number;
  total_shares: number;
  active_shares: number;
  signups_today: number;
  new_users_today: number;
  uploads_today: number;
  trashed_files: number;
  active_uploads: number;
  total_notifications: number;
  unread_notifications: number;
}

export interface AdminUser {
  id: string;
  email: string;
  display_name: string;
  plan: string;
  storage_used: number;
  storage_limit: number;
  is_active: boolean;
  is_admin: boolean;
  email_verified: boolean;
  approval_status: string;
  file_count: number;
  last_login_at: string | null;
  created_at: string;
}

export interface UpdateUserPayload {
  plan?: string;
  storage_limit?: number;
  is_active?: boolean;
  is_admin?: boolean;
}

export interface StorageStats {
  total_files: number;
  total_size: number;
  total_used_bytes: number;
  total_allocated_bytes: number;
  user_count: number;
  avg_file_size: number;
  avg_per_user_bytes: number;
  top_users: { user_id: string; id: string; email: string; display_name: string; storage_used: number; file_count: number }[];
  by_plan: { plan: string; user_count: number; total_storage: number; total_used_bytes: number }[];
}

export interface MimeTypeStat {
  mime_type: string;
  file_count: number;
  total_size: number;
}

export interface DailyUploadStat {
  date: string;
  file_count: number;
  total_bytes: number;
}

export interface StoragePool {
  total_capacity: number;
  used_capacity: number;
  usage_percent: number;
}

export interface AuditLogEntry {
  id: number;
  user_id: string | null;
  user_email: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AdminFile {
  id: string;
  user_id: string;
  user_email: string;
  name: string;
  mime_type: string;
  size: number;
  folder_id: string | null;
  trashed_at: string | null;
  created_at: string;
}

export interface PlatformSettings {
  default_storage_limit_free: number;
  default_storage_limit_pro: number;
  default_storage_limit_premium: number;
  max_upload_size_mb: number;
  maintenance_mode: boolean;
  require_approval: boolean;
  allow_registration: boolean;
}

export interface DailySignupStat {
  date: string;
  count: number;
}

export interface AdminComment {
  id: string;
  content: string;
  file_id: string;
  file_name: string;
  user_id: string;
  user_email: string;
  created_at: string;
}

export interface AdAnalytics {
  total_free_users: number;
  total_paid_users: number;
  free_user_percentage: number;
  plan_distribution: { plan: string; count: number }[];
  estimated_impressions: number;
  revenue_estimate: number;
}

export interface AdSettings {
  ads_enabled: boolean;
  android_banner_ad_unit_id: string;
  android_interstitial_ad_unit_id: string;
  android_rewarded_ad_unit_id: string;
  web_adsense_client_id: string;
  web_banner_slot_id: string;
  web_sidebar_slot_id: string;
  ad_frequency: number;
}

export interface AdminPost {
  id: string;
  user_id: string;
  user_email: string;
  caption: string;
  tags: string[];
  views: number;
  likes: number;
  status: 'active' | 'hidden' | 'removed';
  created_at: string;
}

export interface UserStorageBreakdown {
  images: { count: number; size: number };
  videos: { count: number; size: number };
  audio: { count: number; size: number };
  docs: { count: number; size: number };
  other: { count: number; size: number };
  total_used: number;
  storage_limit: number;
}

export interface TopStorageUser {
  user_id: string;
  email: string;
  display_name: string;
  plan: string;
  storage_used: number;
  storage_limit: number;
  usage_percent: number;
  file_count: number;
}

export interface AdminNotification {
  id: string;
  user_id: string;
  user_email: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface SendNotificationPayload {
  recipient: 'all' | 'user';
  user_email?: string;
  type: 'info' | 'warning' | 'promo' | 'system';
  title: string;
  message: string;
}

export interface RevenueStats {
  total_paid_users: number;
  monthly_revenue: number;
  avg_revenue_per_user: number;
  plan_distribution: { plan: string; user_count: number; price_per_month: number; monthly_revenue: number }[];
  recent_plan_changes: { user_email: string; old_plan: string; new_plan: string; changed_at: string }[];
  revenue_projection: { month: string; projected_revenue: number }[];
}

export interface SystemHealth {
  status: 'healthy' | 'degraded' | 'down';
  uptime: string;
  goroutines: number;
  memory_used: number;
  memory_total: number;
  cpu_usage: number;
  disk_used: number;
  disk_total: number;
  active_connections: number;
  db_connections: number;
  go_version: string;
  components: { name: string; status: 'up' | 'down'; latency_ms: number }[];
  recent_errors: { timestamp: string; endpoint: string; status_code: number; message: string }[];
  response_times: { timestamp: string; p50: number; p95: number; p99: number }[];
}

export interface BillingStats {
  mrr: number;
  total_revenue: number;
  active_subscriptions: number;
  churn_rate: number;
  revenue_over_time: { month: string; revenue: number }[];
  subscriptions_by_plan: { plan: string; count: number }[];
  recent_transactions: { user_email: string; plan: string; amount: number; date: string; status: string }[];
  revenue_by_plan: { plan: string; revenue: number }[];
}

export interface ExportHistoryEntry {
  id: string;
  report_type: string;
  date_range: string;
  row_count: number;
  exported_at: string;
  file_name: string;
}

export interface NotificationStats {
  total_sent: number;
  read_rate: number;
  unread_count: number;
}

export const adminApi = {
  // Dashboard
  dashboard: () =>
    client.get<{ success: boolean; data: DashboardStats }>('/admin/dashboard'),

  // Users
  listUsers: (params: { page?: number; limit?: number; offset?: number; search?: string }) =>
    client.get<{ success: boolean; data: AdminUser[]; pagination: { has_more: boolean } }>('/admin/users', { params }),

  getUser: (id: string) =>
    client.get<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`),

  updateUser: (id: string, payload: UpdateUserPayload) =>
    client.put<{ success: boolean }>(`/admin/users/${id}`, payload),

  banUser: (id: string) =>
    client.post<{ success: boolean }>(`/admin/users/${id}/ban`),

  bulkUserAction: (userIds: string[], action: string, plan?: string) =>
    client.post<{ message: string; affected: number }>('/admin/users/bulk', {
      user_ids: userIds,
      action,
      plan,
    }),

  userActivity: (id: string, params: { limit?: number; offset?: number }) =>
    client.get<{ logs: AuditLogEntry[]; total: number }>(`/admin/users/${id}/activity`, { params }),

  // Storage
  storagePool: () =>
    client.get<StoragePool>('/admin/storage/pool'),

  updateStoragePool: (totalCapacity: number) =>
    client.put<StoragePool>('/admin/storage/pool', { total_capacity: totalCapacity }),

  storageStats: () =>
    client.get<{ success: boolean; data: StorageStats }>('/admin/storage/stats'),

  mimeTypeStats: () =>
    client.get<MimeTypeStat[]>('/admin/storage/mime-stats'),

  uploadTrends: (days?: number) =>
    client.get<DailyUploadStat[]>('/admin/storage/upload-trends', { params: { days } }),

  // Audit Logs
  auditLogs: (params: { limit?: number; offset?: number; action?: string; user_id?: string }) =>
    client.get<{ logs: AuditLogEntry[]; total: number; limit: number; offset: number }>('/admin/audit-logs', { params }),

  // Pending Approvals
  pendingRegistrations: (params: { limit?: number; offset?: number }) =>
    client.get<{ users: AdminUser[]; total: number; limit: number; offset: number }>('/admin/pending-registrations', { params }),

  approveUser: (id: string) =>
    client.post<{ message: string }>(`/admin/users/${id}/approve`),

  rejectUser: (id: string) =>
    client.post<{ message: string }>(`/admin/users/${id}/reject`),

  // Files
  listFiles: (params: { limit?: number; offset?: number; search?: string; user_id?: string; mime?: string }) =>
    client.get<{ files: AdminFile[]; total: number }>('/admin/files', { params }),

  deleteFile: (id: string) =>
    client.delete<{ message: string }>(`/admin/files/${id}`),

  // Settings
  getSettings: () =>
    client.get<PlatformSettings>('/admin/settings'),

  updateSettings: (settings: PlatformSettings) =>
    client.put<PlatformSettings>('/admin/settings', settings),

  // Signup Trends
  signupTrends: (days?: number) =>
    client.get<DailySignupStat[]>('/admin/signup-trends', { params: { days } }),

  // Comments
  listComments: (params: { limit?: number; offset?: number; search?: string }) =>
    client.get<{ comments: AdminComment[]; total: number }>('/admin/comments', { params }),

  deleteComment: (id: string) =>
    client.delete<{ message: string }>(`/admin/comments/${id}`),

  // Starred stats
  starredStats: () =>
    client.get<{ total_stars: number }>('/admin/starred-stats'),

  // Ad analytics
  getAdAnalytics: () =>
    client.get<AdAnalytics>('/admin/ad-analytics'),

  // Ad settings
  getAdSettings: () =>
    client.get<AdSettings>('/admin/ad-settings'),

  updateAdSettings: (settings: AdSettings) =>
    client.put<AdSettings>('/admin/ad-settings', settings),

  // Posts
  listPosts: (params: { limit?: number; offset?: number; search?: string; status?: string }) =>
    client.get<{ posts: AdminPost[]; total: number }>('/admin/posts', { params }),

  deletePost: (id: string) =>
    client.delete<{ message: string }>(`/admin/posts/${id}`),

  updatePostStatus: (id: string, status: string) =>
    client.put<{ message: string }>(`/admin/posts/${id}/status`, { status }),

  // User storage breakdown
  getUserStorageBreakdown: (userId: string) =>
    client.get<UserStorageBreakdown>(`/admin/users/${userId}/storage-breakdown`),

  getTopStorageUsers: () =>
    client.get<{ users: TopStorageUser[] }>('/admin/storage/top-users'),

  // Notifications
  listAdminNotifications: (params: { limit?: number; offset?: number; type?: string; user_email?: string }) =>
    client.get<{ notifications: AdminNotification[]; total: number }>('/admin/notifications', { params }),

  deleteNotification: (id: string) =>
    client.delete<{ message: string }>(`/admin/notifications/${id}`),

  sendNotification: (data: SendNotificationPayload) =>
    client.post<{ message: string }>('/admin/notifications/send', data),

  // Revenue
  getRevenueStats: () =>
    client.get<RevenueStats>('/admin/revenue'),

  // System health
  getSystemHealth: () =>
    client.get<SystemHealth>('/admin/health'),

  // Exports
  exportUsers: () =>
    client.get('/admin/export/users', { responseType: 'blob' }),

  exportFiles: () =>
    client.get('/admin/export/files', { responseType: 'blob' }),

  exportPosts: () =>
    client.get('/admin/export/posts', { responseType: 'blob' }),

  exportNotifications: () =>
    client.get('/admin/export/notifications', { responseType: 'blob' }),

  exportRevenue: () =>
    client.get('/admin/export/revenue', { responseType: 'blob' }),

  exportAnalytics: () =>
    client.get('/admin/export/analytics', { responseType: 'blob' }),

  // Explore posts (enhanced moderation)
  bulkPostAction: (postIds: string[], action: string) =>
    client.post<{ message: string; affected: number }>('/admin/posts/bulk', { post_ids: postIds, action }),

  // Billing
  getBillingStats: () =>
    client.get<BillingStats>('/admin/billing'),

  // Notification stats
  getNotificationStats: () =>
    client.get<NotificationStats>('/admin/notifications/stats'),

  bulkDeleteNotifications: (olderThanDays: number) =>
    client.delete<{ message: string; deleted: number }>('/admin/notifications/bulk', { params: { older_than_days: olderThanDays } }),

  // Export with date range
  exportWithRange: (reportType: string, startDate: string, endDate: string) =>
    client.get(`/admin/export/${reportType}`, { params: { start_date: startDate, end_date: endDate }, responseType: 'blob' }),

  // Export history
  getExportHistory: () =>
    client.get<{ exports: ExportHistoryEntry[] }>('/admin/export/history'),

  // Preview export
  previewExport: (reportType: string, startDate: string, endDate: string) =>
    client.get<{ columns: string[]; rows: Record<string, unknown>[] }>(`/admin/export/${reportType}/preview`, { params: { start_date: startDate, end_date: endDate, limit: 10 } }),
};
