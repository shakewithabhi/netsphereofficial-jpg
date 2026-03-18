import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '/api/v1';

export interface ShareInfo {
  code: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  is_video: boolean;
  is_image: boolean;
  is_folder: boolean;
  has_password: boolean;
  preview_available: boolean;
  thumbnail_url?: string;
  video_thumbnail_url?: string;
  expires_at?: string;
  download_count: number;
  video_duration_seconds?: number;
  app_download_url: string;
}

export interface SharePreview {
  url: string;
  preview_duration_seconds: number;
  file_name: string;
  file_size: number;
  mime_type: string;
  is_video: boolean;
  is_image: boolean;
  requires_login: boolean;
  thumbnail_url?: string;
  hls_url?: string;
  video_thumbnail_url?: string;
  video_duration_seconds?: number;
}

export interface ShareFolderItem {
  name: string;
  size: number;
  mime_type: string;
  is_folder: boolean;
  path: string;
}

export async function getShareInfo(code: string, password?: string): Promise<ShareInfo> {
  const res = await axios.get(`${API_BASE}/s/${code}`, {
    headers: password ? { 'X-Share-Password': password } : {},
  });
  return res.data.data;
}

export async function getSharePreview(code: string, password?: string): Promise<SharePreview> {
  const res = await axios.get(`${API_BASE}/s/${code}/preview`, {
    headers: password ? { 'X-Share-Password': password } : {},
  });
  return res.data.data;
}

export async function getShareDownload(code: string, password?: string): Promise<string> {
  const res = await axios.post(`${API_BASE}/s/${code}/download`, {}, {
    headers: password ? { 'X-Share-Password': password } : {},
  });
  return res.data.data.url;
}

export async function getShareFolderContents(code: string, path?: string, password?: string): Promise<ShareFolderItem[]> {
  const res = await axios.get(`${API_BASE}/s/${code}/contents`, {
    params: path ? { path } : {},
    headers: password ? { 'X-Share-Password': password } : {},
  });
  return res.data.data;
}

export async function saveToStorage(code: string, folderId?: string, password?: string): Promise<any> {
  const client = (await import('./client')).default;
  const res = await client.post(`/s/${code}/save`, { folder_id: folderId || null }, {
    headers: password ? { 'X-Share-Password': password } : {},
  });
  return res.data.data;
}
