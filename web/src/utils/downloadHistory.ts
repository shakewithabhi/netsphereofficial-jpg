const STORAGE_KEY = 'bytebox-download-history';
const MAX_ENTRIES = 100;

export interface DownloadRecord {
  id: string;
  name: string;
  size: number;
  mime_type: string;
  downloaded_at: string;
}

export function trackDownload(file: { id: string; name: string; size: number; mime_type: string }): void {
  try {
    const history = getDownloadHistory();
    const record: DownloadRecord = {
      id: file.id,
      name: file.name,
      size: file.size,
      mime_type: file.mime_type,
      downloaded_at: new Date().toISOString(),
    };
    // Remove duplicate if exists, add to front
    const filtered = history.filter((r) => !(r.id === file.id && r.name === file.name));
    const updated = [record, ...filtered].slice(0, MAX_ENTRIES);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // localStorage might be full or unavailable
  }
}

export function getDownloadHistory(): DownloadRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as DownloadRecord[];
  } catch {
    return [];
  }
}

export function clearDownloadHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function removeDownloadRecord(id: string, downloaded_at: string): void {
  try {
    const history = getDownloadHistory();
    const updated = history.filter((r) => !(r.id === id && r.downloaded_at === downloaded_at));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}
