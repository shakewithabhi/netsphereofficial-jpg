import { useEffect, useState, useCallback } from 'react';
import { Table, Button, Space, Typography, message, Tag } from 'antd';
import { CheckOutlined, CloseOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminUser } from '../../api/admin';
import { formatDate } from '../../utils/format';

const { Title } = Typography;

export default function PendingApprovalsPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminApi.pendingRegistrations({ limit: 20, offset: (page - 1) * 20 });
      const d = res.data as any;
      const userList = d.users ?? [];
      setUsers(Array.isArray(userList) ? userList : []);
      setTotal(d.total ?? 0);
    } catch {
      message.error('Failed to load pending registrations');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  const handleApprove = async (user: AdminUser) => {
    try {
      await adminApi.approveUser(user.id);
      message.success(`${user.email} approved`);
      fetchPending();
    } catch {
      message.error('Failed to approve user');
    }
  };

  const handleReject = async (user: AdminUser) => {
    try {
      await adminApi.rejectUser(user.id);
      message.success(`${user.email} rejected`);
      fetchPending();
    } catch {
      message.error('Failed to reject user');
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
      title: 'Status',
      key: 'status',
      width: 100,
      render: () => <Tag color="orange">Pending</Tag>,
    },
    {
      title: 'Registered',
      dataIndex: 'created_at',
      width: 200,
      render: (v) => formatDate(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, r) => (
        <Space>
          <Button type="primary" icon={<CheckOutlined />} size="small" onClick={() => handleApprove(r)}>
            Approve
          </Button>
          <Button danger icon={<CloseOutlined />} size="small" onClick={() => handleReject(r)}>
            Reject
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }}>
        <Title level={4} style={{ margin: 0 }}>Pending Approvals</Title>
        <Tag color="orange">{total} pending</Tag>
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
          total,
        }}
        scroll={{ x: 700 }}
      />
    </div>
  );
}
