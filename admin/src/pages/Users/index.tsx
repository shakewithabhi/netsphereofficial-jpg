import { useEffect, useState, useCallback } from 'react';
import { Table, Input, Tag, Button, Space, Typography, message, Modal, Form, Select, InputNumber, Switch, Tooltip } from 'antd';
import { SearchOutlined, StopOutlined, EditOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminUser, type UpdateUserPayload } from '../../api/admin';
import { formatBytes, formatDate, planLabel } from '../../utils/format';

const { Title } = Typography;

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);
  const [form] = Form.useForm();

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.listUsers({ page, limit: 20, search: search || undefined });
      setUsers(res.data.data || []);
      setHasMore(res.data.pagination?.has_more || false);
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

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
      width: 100,
      render: (_, r) => (
        <Space>
          <Tooltip title="Edit"><Button icon={<EditOutlined />} size="small" onClick={() => handleEdit(r)} /></Tooltip>
          {r.is_active && (
            <Tooltip title="Ban"><Button icon={<StopOutlined />} size="small" danger onClick={() => handleBan(r)} /></Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Users</Title>
        <Input
          placeholder="Search by email or name"
          prefix={<SearchOutlined />}
          style={{ width: 300 }}
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          allowClear
        />
      </Space>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize: 20,
          onChange: setPage,
          showSizeChanger: false,
          total: hasMore ? page * 20 + 1 : users.length + (page - 1) * 20,
        }}
        scroll={{ x: 900 }}
      />

      <Modal title="Edit User" open={!!editUser} onOk={handleSave} onCancel={() => setEditUser(null)} okText="Save">
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
          <Form.Item label="Admin" name="is_admin" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
