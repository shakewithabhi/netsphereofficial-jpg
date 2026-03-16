import client from './client';

export interface DashboardStats {
  total_users: number;
  active_users: number;
  total_files: number;
  total_storage_used: number;
  total_storage_allocated: number;
  total_shares: number;
  active_shares: number;
  signups_today: number;
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
  avg_file_size: number;
  top_users: { user_id: string; email: string; display_name: string; storage_used: number; file_count: number }[];
  by_plan: { plan: string; user_count: number; total_storage: number }[];
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

export const adminApi = {
  dashboard: () =>
    client.get<{ success: boolean; data: DashboardStats }>('/admin/dashboard'),

  listUsers: (params: { page?: number; limit?: number; search?: string }) =>
    client.get<{ success: boolean; data: AdminUser[]; pagination: { has_more: boolean } }>('/admin/users', { params }),

  getUser: (id: string) =>
    client.get<{ success: boolean; data: AdminUser }>(`/admin/users/${id}`),

  updateUser: (id: string, payload: UpdateUserPayload) =>
    client.put<{ success: boolean }>(`/admin/users/${id}`, payload),

  banUser: (id: string) =>
    client.post<{ success: boolean }>(`/admin/users/${id}/ban`),

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

  auditLogs: (params: { limit?: number; offset?: number; action?: string; user_id?: string }) =>
    client.get<{ logs: AuditLogEntry[]; total: number; limit: number; offset: number }>('/admin/audit-logs', { params }),
};
