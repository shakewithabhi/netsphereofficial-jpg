import { useEffect, useState, useCallback } from 'react';
import {
  Table, Input, Tag, Button, Space, Typography, message, Modal,
  Form, Select, InputNumber, Switch, Tooltip, Card, DatePicker, Drawer,
  Timeline, Dropdown, Progress, Spin,
} from 'antd';
import {
  SearchOutlined, StopOutlined, EditOutlined, DownloadOutlined,
  EyeOutlined, MoreOutlined, PieChartOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminUser, type UpdateUserPayload, type AuditLogEntry, type UserStorageBreakdown } from '../../api/admin';
import { formatBytes, formatDate, formatRelative, planLabel } from '../../utils/format';
import { exportToCSV } from '../../utils/export';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);

  // Filters
  const [planFilter, setPlanFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // User activity drawer
  const [activityUser, setActivityUser] = useState<AdminUser | null>(null);
  const [activityLogs, setActivityLogs] = useState<AuditLogEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  // Storage breakdown
  const [storageBreakdown, setStorageBreakdown] = useState<UserStorageBreakdown | null>(null);

  const pageSize = 20;

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
      });
      const d = res.data as any;
      const inner = d.data ?? d;
      let userList = inner.users ?? inner.data ?? [];
      userList = Array.isArray(userList) ? userList : [];

      // Client-side filtering for plan and status (backend doesn't support these filters yet)
      if (planFilter) {
        userList = userList.filter((u: AdminUser) => u.plan === planFilter);
      }
      if (statusFilter === 'active') {
        userList = userList.filter((u: AdminUser) => u.is_active);
      } else if (statusFilter === 'banned') {
        userList = userList.filter((u: AdminUser) => !u.is_active);
      } else if (statusFilter === 'admin') {
        userList = userList.filter((u: AdminUser) => u.is_admin);
      }

      setUsers(userList);
      setTotal(inner.total ?? userList.length + (page - 1) * pageSize);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search, planFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  usePolling(fetchUsers, 30000);

  const fetchActivity = async (user: AdminUser) => {
    setActivityUser(user);
    setActivityLoading(true);
    setStorageBreakdown(null);
    try {
      const [activityRes, storageRes] = await Promise.allSettled([
        adminApi.userActivity(user.id, { limit: 50 }),
        adminApi.getUserStorageBreakdown(user.id),
      ]);
      if (activityRes.status === 'fulfilled') {
        setActivityLogs(activityRes.value.data.logs || []);
      }
      if (storageRes.status === 'fulfilled') {
        const sd = (storageRes.value.data as any)?.data ?? storageRes.value.data;
        setStorageBreakdown(sd);
      }
    } catch {
      message.error('Failed to load user activity');
    } finally {
      setActivityLoading(false);
    }
  };

  const handleBan = (user: AdminUser) => {
    Modal.confirm({
      title: `Ban ${user.email}?`,
      content: 'This will deactivate the account and revoke all sessions.',
      okText: 'Ban',
      okType: 'danger',
      onOk: async () => {
        try {
          await adminApi.banUser(user.id);
          message.success('User banned');
          fetchUsers();
        } catch {
          message.error('Failed to ban user');
        }
      },
    });
  };

  const handleEdit = (user: AdminUser) => {
    setEditUser(user);
    form.setFieldsValue({
      plan: user.plan,
      storage_limit: Math.round(user.storage_limit / (1024 * 1024 * 1024)),
      is_active: user.is_active,
      is_admin: user.is_admin,
    });
  };

  const handleSave = async () => {
    if (!editUser) return;
    try {
      const values = form.getFieldsValue();
      const payload: UpdateUserPayload = {
        plan: values.plan,
        storage_limit: values.storage_limit * 1024 * 1024 * 1024,
        is_active: values.is_active,
        is_admin: values.is_admin,
      };
      await adminApi.updateUser(editUser.id, payload);
      message.success('User updated');
      setEditUser(null);
      fetchUsers();
    } catch {
      message.error('Failed to update user');
    }
  };

  // Bulk operations
  const handleBulkAction = async (action: string, plan?: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('No users selected');
      return;
    }
    const actionLabel = action === 'set_plan' ? `change plan to ${plan}` : action;
    Modal.confirm({
      title: `${actionLabel} ${selectedRowKeys.length} user(s)?`,
      okText: 'Confirm',
      okType: action === 'ban' || action === 'deactivate' ? 'danger' : 'primary',
      onOk: async () => {
        setBulkLoading(true);
        try {
          const res = await adminApi.bulkUserAction(selectedRowKeys as string[], action, plan);
          const d = res.data as any;
          message.success(`${d.affected ?? selectedRowKeys.length} user(s) updated`);
          setSelectedRowKeys([]);
          fetchUsers();
        } catch {
          message.error('Bulk action failed');
        } finally {
          setBulkLoading(false);
        }
      },
    });
  };

  const handleExportCSV = () => {
    const data = users.map((u) => ({
      email: u.email,
      name: u.display_name || '',
      plan: u.plan,
      storage_used: formatBytes(u.storage_used),
      storage_limit: formatBytes(u.storage_limit),
      files: u.file_count,
      status: u.is_active ? 'Active' : 'Banned',
      admin: u.is_admin ? 'Yes' : 'No',
      last_login: u.last_login_at || 'Never',
      created: u.created_at,
    }));
    exportToCSV(data, 'bytebox-users');
    message.success('Users exported');
  };

  const columns: ColumnsType<AdminUser> = [
    {
      title: 'Email',
      dataIndex: 'email',
      ellipsis: true,
    },
    {
      title: 'Name',
      dataIndex: 'display_name',
      ellipsis: true,
      render: (v) => v || '-',
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      width: 100,
      render: (v) => <Tag color={v === 'free' ? 'default' : v === 'pro' ? 'blue' : 'gold'}>{planLabel(v)}</Tag>,
    },
    {
      title: 'Storage',
      key: 'storage',
      width: 140,
      render: (_, r) => `${formatBytes(r.storage_used)} / ${formatBytes(r.storage_limit)}`,
    },
    {
      title: 'Files',
      dataIndex: 'file_count',
      width: 80,
    },
    {
      title: 'Status',
      key: 'status',
      width: 100,
      render: (_, r) => (
        <Space>
          {r.is_active ? <Tag color="green">Active</Tag> : <Tag color="red">Banned</Tag>}
          {r.is_admin && <Tag color="purple">Admin</Tag>}
        </Space>
      ),
    },
    {
      title: 'Last Login',
      dataIndex: 'last_login_at',
      width: 180,
      render: (v) => formatDate(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, r) => (
        <Space>
          <Tooltip title="View Activity"><Button icon={<EyeOutlined />} size="small" onClick={() => fetchActivity(r)} /></Tooltip>
          <Tooltip title="Edit"><Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(r)} /></Tooltip>
          {r.is_active && (
            <Tooltip title="Ban"><Button icon={<StopOutlined />} size="small" danger onClick={() => handleBan(r)} /></Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const bulkMenuItems = [
    { key: 'ban', label: 'Ban Selected', danger: true },
    { key: 'activate', label: 'Activate Selected' },
    { key: 'deactivate', label: 'Deactivate Selected', danger: true },
    { type: 'divider' as const },
    { key: 'set_plan:free', label: 'Set Plan: Free' },
    { key: 'set_plan:pro', label: 'Set Plan: Pro' },
    { key: 'set_plan:premium', label: 'Set Plan: Premium' },
  ];

  const actionColor = (action: string): string => {
    if (action.startsWith('admin')) return 'red';
    if (action.startsWith('user')) return 'blue';
    if (action.startsWith('file')) return 'green';
    if (action.startsWith('folder')) return 'orange';
    if (action.startsWith('share')) return 'purple';
    return 'default';
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>Users</Title>
        <Space wrap>
          <Input
            placeholder="Search by email or name"
            prefix={<SearchOutlined />}
            style={{ width: 250 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            allowClear
          />
          <Select
            style={{ width: 120 }}
            value={planFilter}
            onChange={(v) => { setPlanFilter(v); setPage(1); }}
            options={[
              { value: '', label: 'All Plans' },
              { value: 'free', label: 'Free' },
              { value: 'pro', label: 'Pro' },
              { value: 'premium', label: 'Premium' },
            ]}
          />
          <Select
            style={{ width: 130 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={[
              { value: '', label: 'All Status' },
              { value: 'active', label: 'Active' },
              { value: 'banned', label: 'Banned' },
              { value: 'admin', label: 'Admins' },
            ]}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>Export CSV</Button>
        </Space>
      </Space>

      {selectedRowKeys.length > 0 && (
        <Card size="small" style={{ marginBottom: 16, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Space>
            <Text strong>{selectedRowKeys.length} user(s) selected</Text>
            <Dropdown
              menu={{
                items: bulkMenuItems,
                onClick: ({ key }) => {
                  if (key.startsWith('set_plan:')) {
                    handleBulkAction('set_plan', key.split(':')[1]);
                  } else {
                    handleBulkAction(key);
                  }
                },
              }}
            >
              <Button loading={bulkLoading}>Bulk Actions <MoreOutlined /></Button>
            </Dropdown>
            <Button onClick={() => setSelectedRowKeys([])}>Clear</Button>
          </Space>
        </Card>
      )}

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
        }}
        pagination={{
          current: page,
          pageSize,
          onChange: setPage,
          showSizeChanger: false,
          total,
          showTotal: (t) => `${t} users`,
        }}
        scroll={{ x: 1000 }}
      />

      {/* Edit Modal */}
      <Modal
        title="Edit User"
        open={!!editUser}
        onOk={() => {
          const values = form.getFieldsValue();
          if (values.is_admin !== editUser?.is_admin) {
            Modal.confirm({
              title: values.is_admin ? 'Grant admin access?' : 'Revoke admin access?',
              content: values.is_admin
                ? 'This user will gain full access to the admin panel.'
                : 'This user will lose access to the admin panel.',
              okText: 'Confirm',
              okType: 'danger',
              onOk: handleSave,
            });
          } else {
            handleSave();
          }
        }}
        onCancel={() => setEditUser(null)}
        okText="Save"
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Plan" name="plan">
            <Select options={[
              { value: 'free', label: 'Free' },
              { value: 'pro', label: 'Pro' },
              { value: 'premium', label: 'Premium' },
            ]} />
          </Form.Item>
          <Form.Item label="Storage Limit (GB)" name="storage_limit">
            <InputNumber min={1} max={10240} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item label="Admin" extra={<Text type="warning" style={{ fontSize: 12 }}>Grant admin access to this user</Text>}>
            <Form.Item name="is_admin" valuePropName="checked" noStyle>
              <Switch />
            </Form.Item>
          </Form.Item>
        </Form>
      </Modal>

      {/* Activity Drawer */}
      <Drawer
        title={`Activity: ${activityUser?.email || ''}`}
        open={!!activityUser}
        onClose={() => setActivityUser(null)}
        width={520}
      >
        {activityUser && (
          <div style={{ marginBottom: 24 }}>
            <Card size="small">
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text><strong>Name:</strong> {activityUser.display_name || '-'}</Text>
                <Text><strong>Plan:</strong> {planLabel(activityUser.plan)}</Text>
                <Text><strong>Storage:</strong> {formatBytes(activityUser.storage_used)} / {formatBytes(activityUser.storage_limit)}</Text>
                <Text><strong>Files:</strong> {activityUser.file_count}</Text>
                <Text><strong>Joined:</strong> {formatDate(activityUser.created_at)}</Text>
                <Text><strong>Last Login:</strong> {formatDate(activityUser.last_login_at)}</Text>
              </Space>
            </Card>
          </div>
        )}
        {storageBreakdown && (
          <div style={{ marginBottom: 24 }}>
            <Card size="small" title="Storage Breakdown">
              <div style={{ marginBottom: 12 }}>
                <Text strong>Usage: </Text>
                <Text>{formatBytes(storageBreakdown.total_used ?? 0)} / {formatBytes(storageBreakdown.storage_limit ?? 0)}</Text>
                <Progress
                  percent={storageBreakdown.storage_limit > 0 ? Math.round((storageBreakdown.total_used / storageBreakdown.storage_limit) * 100) : 0}
                  size="small"
                  status={storageBreakdown.storage_limit > 0 && (storageBreakdown.total_used / storageBreakdown.storage_limit) >= 0.9 ? 'exception' : 'active'}
                  style={{ marginTop: 4 }}
                />
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Images', value: storageBreakdown.images?.size ?? 0, count: storageBreakdown.images?.count ?? 0 },
                      { name: 'Videos', value: storageBreakdown.videos?.size ?? 0, count: storageBreakdown.videos?.count ?? 0 },
                      { name: 'Audio', value: storageBreakdown.audio?.size ?? 0, count: storageBreakdown.audio?.count ?? 0 },
                      { name: 'Docs', value: storageBreakdown.docs?.size ?? 0, count: storageBreakdown.docs?.count ?? 0 },
                      { name: 'Other', value: storageBreakdown.other?.size ?? 0, count: storageBreakdown.other?.count ?? 0 },
                    ].filter((d) => d.value > 0)}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    label={(e) => `${e.name}: ${formatBytes(e.value)}`}
                  >
                    {['#1677ff', '#722ed1', '#13c2c2', '#52c41a', '#faad14'].map((color, i) => (
                      <Cell key={i} fill={color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(v: number) => formatBytes(v)} />
                </PieChart>
              </ResponsiveContainer>
              <Space direction="vertical" size={2} style={{ width: '100%', marginTop: 8 }}>
                <Text style={{ fontSize: 12 }}>Images: {storageBreakdown.images?.count ?? 0} files ({formatBytes(storageBreakdown.images?.size ?? 0)})</Text>
                <Text style={{ fontSize: 12 }}>Videos: {storageBreakdown.videos?.count ?? 0} files ({formatBytes(storageBreakdown.videos?.size ?? 0)})</Text>
                <Text style={{ fontSize: 12 }}>Audio: {storageBreakdown.audio?.count ?? 0} files ({formatBytes(storageBreakdown.audio?.size ?? 0)})</Text>
                <Text style={{ fontSize: 12 }}>Docs: {storageBreakdown.docs?.count ?? 0} files ({formatBytes(storageBreakdown.docs?.size ?? 0)})</Text>
                <Text style={{ fontSize: 12 }}>Other: {storageBreakdown.other?.count ?? 0} files ({formatBytes(storageBreakdown.other?.size ?? 0)})</Text>
              </Space>
            </Card>
          </div>
        )}

        {activityLoading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
        ) : (
          <Timeline
            items={activityLogs.map((log) => ({
              color: actionColor(log.action),
              children: (
                <div>
                  <Tag color={actionColor(log.action)}>{log.action}</Tag>
                  <Text type="secondary" style={{ fontSize: 12 }}>{formatRelative(log.created_at)}</Text>
                  {log.resource_type && (
                    <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>
                      {log.resource_type} {log.resource_id?.toString().slice(0, 8)}...
                    </div>
                  )}
                  {log.ip_address && (
                    <div style={{ fontSize: 12, color: '#999' }}>IP: {log.ip_address}</div>
                  )}
                </div>
              ),
            }))}
          />
        )}
        {activityLogs.length === 0 && !activityLoading && (
          <Text type="secondary">No activity found</Text>
        )}
      </Drawer>
    </div>
  );
}
