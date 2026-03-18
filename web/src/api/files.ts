import client from './client';

export interface FileItem {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  folder_id: string | null;
  created_at: string;
  updated_at: string;
  is_trashed?: boolean;
  is_starred?: boolean;
  trashed_at?: string;
}

export interface FolderItem {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
  is_trashed?: boolean;
}

export interface FolderContents {
  folders: FolderItem[];
  files: FileItem[];
}

export interface ShareLink {
  id: string;
  share_url: string;
  file_id: string;
  expires_at: string | null;
  created_at: string;
}

export async function getRootContents(sort = 'name', order = 'asc'): Promise<FolderContents> {
  const res = await client.get('/folders/root/contents', {
    params: { limit: 50, sort, order },
  });
  return res.data.data;
}

export async function getFolderContents(
  folderId: string,
  sort = 'name',
  order = 'asc'
): Promise<FolderContents> {
  const res = await client.get(`/folders/${folderId}/contents`, {
    params: { limit: 50, sort, order },
  });
  return res.data.data;
}

export async function createFolder(name: string, parent_id?: string): Promise<FolderItem> {
  const res = await client.post('/folders', { name, parent_id });
  return res.data.data ?? res.data;
}

export async function renameFolder(id: string, name: string): Promise<FolderItem> {
  const res = await client.put(`/folders/${id}`, { name });
  return res.data.data ?? res.data;
}

export async function trashFolder(id: string): Promise<void> {
  await client.post(`/folders/${id}/trash`);
}

export async function restoreFolder(id: string): Promise<void> {
  await client.post(`/folders/${id}/restore`);
}

export async function deleteFolder(id: string): Promise<void> {
  await client.delete(`/folders/${id}`);
}

export async function uploadFile(
  file: File,
  folder_id?: string,
  onProgress?: (percent: number) => void
): Promise<FileItem> {
  const formData = new FormData();
  formData.append('file', file);
  if (folder_id) {
    formData.append('folder_id', folder_id);
  }
  const res = await client.post('/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) {
        onProgress(Math.round((evt.loaded * 100) / evt.total));
      }
    },
  });
  return res.data.data ?? res.data;
}

export async function getDownloadUrl(id: string): Promise<string> {
  const res = await client.get(`/files/${id}/download`);
  return res.data.data.url;
}

export async function trashFile(id: string): Promise<void> {
  await client.post(`/files/${id}/trash`);
}

export async function restoreFile(id: string): Promise<void> {
  await client.post(`/files/${id}/restore`);
}

export async function deleteFilePermanently(id: string): Promise<void> {
  await client.delete(`/files/${id}`);
}

export async function copyFile(id: string, folder_id?: string): Promise<FileItem> {
  const res = await client.post(`/files/${id}/copy`, { folder_id });
  return res.data.data ?? res.data;
}

export async function getTrash(): Promise<FolderContents> {
  const res = await client.get('/files/trash', { params: { limit: 50 } });
  return res.data.data;
}

export async function searchFiles(q: string): Promise<FolderContents> {
  const res = await client.get('/files/search', { params: { q, limit: 50 } });
  return res.data.data;
}

export async function createShare(
  file_id: string,
  expires_in_hours?: number,
  password?: string
): Promise<ShareLink> {
  const res = await client.post('/shares', {
    file_id,
    ...(expires_in_hours ? { expires_in_hours } : {}),
    ...(password ? { password } : {}),
  });
  return res.data.data;
}

export async function starFile(id: string): Promise<void> {
  await client.post(`/files/${id}/star`);
}

export async function unstarFile(id: string): Promise<void> {
  await client.delete(`/files/${id}/star`);
}

export async function getStarredFiles(): Promise<{ files: FileItem[] }> {
  const res = await client.get('/files/starred');
  return res.data.data;
}

export interface Comment {
  id: string;
  file_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
  updated_at: string;
}

export async function getComments(fileId: string): Promise<Comment[]> {
  const res = await client.get(`/files/${fileId}/comments`);
  return res.data.data.comments;
}

export async function createComment(fileId: string, content: string): Promise<Comment> {
  const res = await client.post(`/files/${fileId}/comments`, { content });
  return res.data.data;
}

export async function deleteComment(fileId: string, commentId: string): Promise<void> {
  await client.delete(`/files/${fileId}/comments/${commentId}`);
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
