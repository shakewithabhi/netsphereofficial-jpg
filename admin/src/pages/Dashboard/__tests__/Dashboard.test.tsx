import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DashboardPage from '../index';

const mockDashboardData = {
  total_users: 150,
  active_users: 120,
  signups_today: 5,
  total_files: 3200,
  total_storage_used: 1073741824, // 1 GB
  active_shares: 42,
};

vi.mock('../../../api/admin', () => ({
  adminApi: {
    dashboard: vi.fn(),
  },
}));

import { adminApi } from '../../../api/admin';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('DashboardPage', () => {
  it('renders a loading spinner initially', () => {
    vi.mocked(adminApi.dashboard).mockReturnValue(new Promise(() => {}));

    render(<DashboardPage />);
    expect(document.querySelector('.ant-spin')).toBeInTheDocument();
  });

  it('renders stat cards with correct values after data loads', async () => {
    vi.mocked(adminApi.dashboard).mockResolvedValue({
      data: { data: mockDashboardData },
    } as any);

    render(<DashboardPage />);

    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });

    expect(screen.getByText('Total Users')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();

    expect(screen.getByText('Active Users')).toBeInTheDocument();
    expect(screen.getByText('120')).toBeInTheDocument();

    expect(screen.getByText('Signups Today')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();

    expect(screen.getByText('Total Files')).toBeInTheDocument();
    expect(screen.getByText('3,200')).toBeInTheDocument();

    expect(screen.getByText('Storage Used')).toBeInTheDocument();
    expect(screen.getByText('1 GB')).toBeInTheDocument();

    expect(screen.getByText('Active Shares')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('renders nothing when API call fails', async () => {
    vi.mocked(adminApi.dashboard).mockRejectedValue(new Error('Network error'));

    const { container } = render(<DashboardPage />);

    await waitFor(() => {
      expect(container.querySelector('.ant-spin')).not.toBeInTheDocument();
    });

    expect(screen.queryByText('Dashboard')).not.toBeInTheDocument();
  });
});
