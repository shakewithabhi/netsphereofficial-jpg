import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuditLogsPage from '../index';

const mockLogs = [
  {
    id: 1,
    user_id: 'user-1',
    user_email: 'alice@example.com',
    action: 'file.upload',
    resource_type: 'file',
    resource_id: 'file-abc12345',
    metadata: { size: 1024 },
    ip_address: '192.168.1.1',
    created_at: '2026-03-15T10:00:00Z',
  },
  {
    id: 2,
    user_id: null,
    user_email: null,
    action: 'admin.user.ban',
    resource_type: 'user',
    resource_id: 'user-xyz98765',
    metadata: null,
    ip_address: null,
    created_at: '2026-03-14T08:00:00Z',
  },
];

vi.mock('../../../api/admin', () => ({
  adminApi: {
    auditLogs: vi.fn(),
  },
}));

vi.mock('../../../utils/format', () => ({
  formatDate: (v: string) => v,
}));

import { adminApi } from '../../../api/admin';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(adminApi.auditLogs).mockResolvedValue({
    data: { logs: mockLogs, total: 2, limit: 50, offset: 0 },
  } as any);
});

describe('AuditLogsPage', () => {
  it('renders the page title', async () => {
    render(<AuditLogsPage />);
    expect(screen.getByText('Audit Logs')).toBeInTheDocument();
  });

  it('renders log entries after loading', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    });

    expect(screen.getByText('file.upload')).toBeInTheDocument();
    expect(screen.getByText('admin.user.ban')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('renders column headers', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('Time')).toBeInTheDocument();
    });

    expect(screen.getByText('Action')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('Resource')).toBeInTheDocument();
    expect(screen.getByText('IP')).toBeInTheDocument();
    expect(screen.getByText('Metadata')).toBeInTheDocument();
  });

  it('renders the action filter select', () => {
    render(<AuditLogsPage />);
    expect(screen.getByText('All actions')).toBeInTheDocument();
  });

  it('renders the user ID search input', () => {
    render(<AuditLogsPage />);
    expect(screen.getByPlaceholderText('Filter by user ID')).toBeInTheDocument();
  });

  it('calls auditLogs on initial render', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(adminApi.auditLogs).toHaveBeenCalledTimes(1);
    });

    expect(adminApi.auditLogs).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50, offset: 0 }),
    );
  });

  it('displays total entry count in pagination', async () => {
    render(<AuditLogsPage />);

    await waitFor(() => {
      expect(screen.getByText('2 entries')).toBeInTheDocument();
    });
  });
});
