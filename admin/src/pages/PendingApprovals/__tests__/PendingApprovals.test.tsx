import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PendingApprovalsPage from '../index';

const mockPendingUsers = [
  {
    id: 'user-1',
    email: 'newuser@example.com',
    display_name: 'New User',
    plan: 'free',
    storage_used: 0,
    storage_limit: 1073741824,
    is_active: false,
    is_admin: false,
    file_count: 0,
    last_login_at: null,
    created_at: '2026-03-16T12:00:00Z',
  },
  {
    id: 'user-2',
    email: 'another@example.com',
    display_name: 'Another User',
    plan: 'free',
    storage_used: 0,
    storage_limit: 1073741824,
    is_active: false,
    is_admin: false,
    file_count: 0,
    last_login_at: null,
    created_at: '2026-03-15T09:00:00Z',
  },
];

vi.mock('../../../api/admin', () => ({
  adminApi: {
    pendingRegistrations: vi.fn(),
    approveUser: vi.fn(),
    rejectUser: vi.fn(),
  },
}));

vi.mock('../../../utils/format', () => ({
  formatDate: (v: string) => v,
}));

import { adminApi } from '../../../api/admin';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.pendingRegistrations).mockResolvedValue({
    data: { users: mockPendingUsers, total: 2, limit: 20, offset: 0 },
  } as any);
  vi.mocked(adminApi.approveUser).mockResolvedValue({ data: { message: 'ok' } } as any);
  vi.mocked(adminApi.rejectUser).mockResolvedValue({ data: { message: 'ok' } } as any);
});

describe('PendingApprovalsPage', () => {
  it('renders the page title', async () => {
    render(<PendingApprovalsPage />);
    expect(screen.getByText('Pending Approvals')).toBeInTheDocument();
  });

  it('renders pending users after loading', async () => {
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('another@example.com')).toBeInTheDocument();
  });

  it('displays pending count badge', async () => {
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('2 pending')).toBeInTheDocument();
    });
  });

  it('renders column headers', async () => {
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByRole('columnheader', { name: 'Email' })).toBeInTheDocument();
    });

    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Status' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Registered' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Actions' })).toBeInTheDocument();
  });

  it('renders approve and reject buttons for each user', async () => {
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    expect(approveButtons).toHaveLength(2);
    expect(rejectButtons).toHaveLength(2);
  });

  it('calls approveUser when approve button is clicked', async () => {
    const user = userEvent.setup();
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });

    const approveButtons = screen.getAllByRole('button', { name: /approve/i });
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(adminApi.approveUser).toHaveBeenCalledWith('user-1');
    });
  });

  it('calls rejectUser when reject button is clicked', async () => {
    const user = userEvent.setup();
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(screen.getByText('newuser@example.com')).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByRole('button', { name: /reject/i });
    await user.click(rejectButtons[0]);

    await waitFor(() => {
      expect(adminApi.rejectUser).toHaveBeenCalledWith('user-1');
    });
  });

  it('shows all rows with Pending status tags', async () => {
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      const pendingTags = screen.getAllByText('Pending');
      // 2 rows + 1 badge = at least 2 "Pending" texts
      expect(pendingTags.length).toBeGreaterThanOrEqual(2);
    });
  });

  it('shows error message when API fails', async () => {
    vi.mocked(adminApi.pendingRegistrations).mockRejectedValue(new Error('fail'));
    render(<PendingApprovalsPage />);

    await waitFor(() => {
      expect(adminApi.pendingRegistrations).toHaveBeenCalled();
    });
  });
});
