import client from './client';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  is_read: boolean;
  created_at: string;
}

export async function getNotifications(limit = 20): Promise<Notification[]> {
  const res = await client.get('/notifications', { params: { limit } });
  return res.data.data.notifications;
}

export async function getUnreadCount(): Promise<number> {
  const res = await client.get('/notifications/count');
  return res.data.data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await client.post(`/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await client.post('/notifications/read-all');
}
