import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.extend(relativeTime);

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function formatDate(date: string | null): string {
  if (!date) return 'Never';
  return dayjs(date).format('MMM D, YYYY h:mm A');
}

export function formatRelative(date: string | null): string {
  if (!date) return 'Never';
  return dayjs(date).fromNow();
}

export function planLabel(plan: string): string {
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}
