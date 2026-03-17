import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import UsersPage from '../index';

const mockUsers = [
  {
    id: 'user-1',
    email: 'alice@example.com',
    display_name: 'Alice',
    plan: 'pro',
    storage_used: 536870912,
    storage_limit: 10737418240,
    is_active: true,
    is_admin: false,
    file_count: 45,
    last_login_at: '2026-03-15T10:00:00Z',
    created_at: '2025-01-01T00:00:00Z',
  },
  {
    id: 'user-2',
    email: 'bob@example.com',
    display_name: 'Bob',
    plan: 'free',
    storage_used: 0,
    storage_limit: 1073741824,
    is_active: true,
    is_admin: false,
    file_count: 0,
    last_login_at: null,
    created_at: '2025-06-01T00:00:00Z',
  },
];

vi.mock('../../../api/admin', () => ({
  adminApi: {
    listUsers: vi.fn(),
    banUser: vi.fn(),
    updateUser: vi.fn(),
  },
}));

import { adminApi } from '../../../api/admin';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.listUsers).mockResolvedValue({
    data: {
      data: {
        users: mockUsers,
        pagination: { has_more: false },
      },
    },
  } as any);
});

describe('UsersPage', () => {
  it('renders the users table with data', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('bob@example.com')).toBeInTheDocument();
    expect(screen.getByText('Users')).toBeInTheDocument();
  });

  it('renders the search input', async () => {
    render(<UsersPage />);

    const searchInput = screen.getByPlaceholderText('Search by email or name');
    expect(searchInput).toBeInTheDocument();
  });

  it('calls listUsers with search term when user types', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(adminApi.listUsers).toHaveBeenCalledTimes(1);
    });

    const searchInput = screen.getByPlaceholderText('Search by email or name');
    await user.type(searchInput, 'alice');

    await waitFor(() => {
      expect(vi.mocked(adminApi.listUsers)).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'alice' }),
      );
    });
  });

  it('opens edit modal when edit button is clicked', async () => {
    const user = userEvent.setup();
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    const editButtons = screen.getAllByRole('button', { name: /edit/i });
    await user.click(editButtons[0]);

    await waitFor(() => {
      expect(screen.getByText('Edit User')).toBeInTheDocument();
    });
  });

  it('displays correct column headers', async () => {
    render(<UsersPage />);

    await waitFor(() => {
      expect(screen.getByText('Email')).toBeInTheDocument();
    });

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Plan')).toBeInTheDocument();
    expect(screen.getByText('Storage')).toBeInTheDocument();
    expect(screen.getByText('Files')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
  });
});
