import { useEffect, useState } from 'react';
import { Table, Typography, Select, Input, Tag, Space, Card } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { adminApi } from '../../api/admin';
import type { AuditLogEntry } from '../../api/admin';
import { formatDate } from '../../utils/format';

const { Title } = Typography;

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'user.register', label: 'User Register' },
  { value: 'user.login', label: 'User Login' },
  { value: 'user.logout', label: 'User Logout' },
  { value: 'file.upload', label: 'File Upload' },
  { value: 'file.download', label: 'File Download' },
  { value: 'file.delete', label: 'File Delete' },
  { value: 'file.trash', label: 'File Trash' },
  { value: 'file.restore', label: 'File Restore' },
  { value: 'folder.create', label: 'Folder Create' },
  { value: 'folder.delete', label: 'Folder Delete' },
  { value: 'share.create', label: 'Share Create' },
  { value: 'share.delete', label: 'Share Delete' },
  { value: 'share.download', label: 'Share Download' },
  { value: 'admin.user.update', label: 'Admin User Update' },
  { value: 'admin.user.ban', label: 'Admin User Ban' },
];

const actionColor = (action: string): string => {
  if (action.startsWith('admin')) return 'red';
  if (action.startsWith('user')) return 'blue';
  if (action.startsWith('file')) return 'green';
  if (action.startsWith('folder')) return 'orange';
  if (action.startsWith('share')) return 'purple';
  return 'default';
};

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
  const [actionFilter, setActionFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.auditLogs({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        action: actionFilter || undefined,
        user_id: userIdFilter || undefined,
      });
      setLogs(data.logs || []);
      setTotal(data.total);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [page, actionFilter, userIdFilter]);

  const columns: ColumnsType<AuditLogEntry> = [
    {
      title: 'Time',
      dataIndex: 'created_at',
      width: 180,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Action',
      dataIndex: 'action',
      width: 160,
      render: (v: string) => <Tag color={actionColor(v)}>{v}</Tag>,
    },
    {
      title: 'User',
      dataIndex: 'user_email',
      width: 220,
      render: (email: string | null, record) =>
        email ? (
          <span title={record.user_id || ''}>{email}</span>
        ) : (
          <span style={{ color: '#999' }}>System</span>
        ),
    },
    {
      title: 'Resource',
      width: 200,
      render: (_: unknown, record) =>
        record.resource_type ? (
          <span>
            <Tag>{record.resource_type}</Tag>
            <span style={{ fontSize: 12, color: '#999' }}>
              {record.resource_id?.slice(0, 8)}...
            </span>
          </span>
        ) : (
          '-'
        ),
    },
    {
      title: 'IP',
      dataIndex: 'ip_address',
      width: 140,
      render: (v: string | null) => v || '-',
    },
    {
      title: 'Metadata',
      dataIndex: 'metadata',
      ellipsis: true,
      render: (v: Record<string, unknown> | null) =>
        v ? (
          <span style={{ fontSize: 12, color: '#666' }}>
            {JSON.stringify(v)}
          </span>
        ) : (
          '-'
        ),
    },
  ];

  return (
    <div>
      <Title level={4}>Audit Logs</Title>
      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            style={{ width: 200 }}
            value={actionFilter}
            onChange={(v) => { setActionFilter(v); setPage(1); }}
            options={ACTION_OPTIONS}
            placeholder="Filter by action"
          />
          <Input.Search
            style={{ width: 300 }}
            placeholder="Filter by user ID"
            allowClear
            onSearch={(v) => { setUserIdFilter(v.trim()); setPage(1); }}
          />
        </Space>
      </Card>
      <Table
        rowKey="id"
        columns={columns}
        dataSource={logs}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          showTotal: (t) => `${t} entries`,
          onChange: setPage,
          showSizeChanger: false,
        }}
      />
    </div>
  );
}
