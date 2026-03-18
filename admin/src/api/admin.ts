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
};
