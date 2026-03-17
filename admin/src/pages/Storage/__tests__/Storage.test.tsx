import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StoragePage from '../index';

const mockStats = {
  total_files: 500,
  total_size: 5368709120, // 5 GB
  avg_file_size: 10737418, // ~10 MB
  top_users: [
    { user_id: 'u1', email: 'alice@example.com', display_name: 'Alice', storage_used: 2147483648, file_count: 200 },
    { user_id: 'u2', email: 'bob@example.com', display_name: 'Bob', storage_used: 1073741824, file_count: 100 },
  ],
  by_plan: [
    { plan: 'free', user_count: 10, total_storage: 1073741824 },
    { plan: 'pro', user_count: 5, total_storage: 4294967296 },
  ],
};

const mockPool = {
  total_capacity: 10737418240,
  used_capacity: 5368709120,
  usage_percent: 50,
};

vi.mock('../../../api/admin', () => ({
  adminApi: {
    storageStats: vi.fn(),
    storagePool: vi.fn(),
    mimeTypeStats: vi.fn(),
    uploadTrends: vi.fn(),
  },
}));

vi.mock('../../../utils/format', () => ({
  formatBytes: (v: number) => {
    if (v >= 1073741824) return `${(v / 1073741824).toFixed(0)} GB`;
    if (v >= 1048576) return `${(v / 1048576).toFixed(0)} MB`;
    return `${v} B`;
  },
  planLabel: (p: string) => p.charAt(0).toUpperCase() + p.slice(1),
}));

// Mock recharts to avoid SVG rendering issues in jsdom
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  PieChart: ({ children }: any) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  Tooltip: () => null,
  BarChart: ({ children }: any) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  LineChart: ({ children }: any) => <div>{children}</div>,
  Line: () => null,
  Legend: () => null,
}));

import { adminApi } from '../../../api/admin';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.storageStats).mockResolvedValue({ data: { data: mockStats } } as any);
  vi.mocked(adminApi.storagePool).mockResolvedValue({ data: { data: mockPool } } as any);
  vi.mocked(adminApi.mimeTypeStats).mockResolvedValue({ data: { data: [] } } as any);
  vi.mocked(adminApi.uploadTrends).mockResolvedValue({ data: { data: [] } } as any);
});

describe('StoragePage', () => {
  it('renders a loading spinner initially', () => {
    vi.mocked(adminApi.storageStats).mockReturnValue(new Promise(() => {}));
    render(<StoragePage />);
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('renders the page title after loading', async () => {
    render(<StoragePage />);

    await waitFor(() => {
      expect(screen.getByText('Storage Analytics')).toBeInTheDocument();
    });
  });

  it('renders stat cards with data', async () => {
    render(<StoragePage />);

    await waitFor(() => {
      expect(screen.getByText('Total Files')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Storage Used')).toBeInTheDocument();
    expect(screen.getByText('Avg File Size')).toBeInTheDocument();
    expect(screen.getByText('Storage Pool')).toBeInTheDocument();
  });

  it('renders top users table', async () => {
    render(<StoragePage />);

    await waitFor(() => {
      expect(screen.getByText('Top 10 Users')).toBeInTheDocument();
    });

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
  });

  it('renders chart sections', async () => {
    render(<StoragePage />);

    await waitFor(() => {
      expect(screen.getByText('Storage by Plan')).toBeInTheDocument();
    });

    expect(screen.getByText('Storage by File Type')).toBeInTheDocument();
    expect(screen.getByText('Top Users by Storage')).toBeInTheDocument();
  });

  it('renders nothing when stats API fails', async () => {
    vi.mocked(adminApi.storageStats).mockRejectedValue(new Error('fail'));
    vi.mocked(adminApi.storagePool).mockRejectedValue(new Error('fail'));
    vi.mocked(adminApi.mimeTypeStats).mockRejectedValue(new Error('fail'));
    vi.mocked(adminApi.uploadTrends).mockRejectedValue(new Error('fail'));

    const { container } = render(<StoragePage />);

    await waitFor(() => {
      expect(container.querySelector('.ant-spin')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Storage Analytics')).not.toBeInTheDocument();
  });
});
