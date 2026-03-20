import { useEffect, useState, useCallback, useRef } from 'react';
import {
  Table, Typography, Input, Select, Space, Button, Tag, message,
  Modal, Form, Tooltip, AutoComplete, Card, Col, Row, Statistic,
  InputNumber, Popconfirm,
} from 'antd';
import {
  SearchOutlined, DeleteOutlined, BellOutlined, SendOutlined,
  MailOutlined, EyeOutlined, ClockCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminNotification, type SendNotificationPayload } from '../../api/admin';
import { formatDate } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;
const { TextArea } = Input;

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'promo', label: 'Promo' },
  { value: 'system', label: 'System' },
  { value: 'share', label: 'Share' },
  { value: 'comment', label: 'Comment' },
  { value: 'upload', label: 'Upload' },
];

const READ_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'read', label: 'Read' },
  { value: 'unread', label: 'Unread' },
];

const PLAN_OPTIONS = [
  { value: 'all', label: 'All Users (Broadcast)' },
  { value: 'user', label: 'Specific User' },
  { value: 'free', label: 'Free Plan Users' },
  { value: 'pro', label: 'Pro Plan Users' },
  { value: 'premium', label: 'Premium Plan Users' },
];

const typeColor = (type: string): string => {
  if (type === 'info') return 'blue';
  if (type === 'warning') return 'orange';
  if (type === 'promo') return 'green';
  if (type === 'system') return 'red';
  if (type === 'share') return 'cyan';
  if (type === 'comment') return 'purple';
  if (type === 'upload') return 'geekblue';
  return 'default';
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [readFilter, setReadFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form] = Form.useForm();
  const [recipientType, setRecipientType] = useState<string>('all');
  const [stats, setStats] = useState({ total_sent: 0, read_rate: 0, unread_count: 0 });
  const [searchUsers, setSearchUsers] = useState<{ value: string; label: string }[]>([]);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pageSize = 20;

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listAdminNotifications({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        type: typeFilter || undefined,
        user_email: userFilter || undefined,
      });
      const d = data as any;
      let results: AdminNotification[] = d.notifications ?? [];
      // Client-side read filter
      if (readFilter === 'read') results = results.filter((n) => n.read);
      if (readFilter === 'unread') results = results.filter((n) => !n.read);
      setNotifications(results);
      setTotal(d.total ?? 0);
    } catch {
      setNotifications([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, userFilter, readFilter]);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await adminApi.getNotificationStats();
      const d = (data as any)?.data ?? data;
      setStats({
        total_sent: d.total_sent ?? 0,
        read_rate: d.read_rate ?? 0,
        unread_count: d.unread_count ?? 0,
      });
    } catch {
      // Calculate from available data
      setStats({
        total_sent: total,
        read_rate: notifications.length > 0
          ? Math.round((notifications.filter((n) => n.read).length / notifications.length) * 100)
          : 0,
        unread_count: notifications.filter((n) => !n.read).length,
      });
    }
  }, [total, notifications]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
  useEffect(() => { fetchStats(); }, [fetchStats]);
  usePolling(fetchNotifications, 30000);

  const handleDelete = (notification: AdminNotification) => {
    Modal.confirm({
      title: 'Delete this notification?',
      content: `Notification "${notification.title}" for ${notification.user_email}. This action is permanent.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await adminApi.deleteNotification(notification.id);
          message.success('Notification deleted');
          fetchNotifications();
        } catch {
          message.error('Failed to delete notification');
        }
      },
    });
  };

  const handleBulkDeleteOld = async (days: number) => {
    try {
      await adminApi.bulkDeleteNotifications(days);
      message.success(`Old notifications (>${days} days) deleted`);
      fetchNotifications();
    } catch {
      message.error('Failed to delete old notifications');
    }
  };

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setSending(true);
      const recipientValue = recipientType === 'user' ? 'user' : 'all';
      const payload: SendNotificationPayload = {
        recipient: recipientValue,
        type: values.type,
        title: values.title,
        message: values.message,
      };
      if (recipientType === 'user') {
        payload.user_email = values.user_email;
      }
      await adminApi.sendNotification(payload);
      message.success('Notification sent');
      setSendModalOpen(false);
      form.resetFields();
      setRecipientType('all');
      fetchNotifications();
      fetchStats();
    } catch {
      message.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const columns: ColumnsType<AdminNotification> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 80,
      ellipsis: true,
      render: (id: string) => <Text style={{ fontSize: 11 }}>{(id || '').slice(0, 8)}...</Text>,
    },
    {
      title: 'User',
      dataIndex: 'user_email',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 100,
      render: (type: string) => <Tag color={typeColor(type)}>{type}</Tag>,
    },
    {
      title: 'Title',
      dataIndex: 'title',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      ellipsis: true,
      render: (msg: string) => msg && msg.length > 60 ? `${msg.slice(0, 60)}...` : msg,
    },
    {
      title: 'Read',
      dataIndex: 'read',
      width: 70,
      render: (read: boolean) => (
        <Tag color={read ? 'green' : 'red'} style={{ margin: 0 }}>
          {read ? 'Read' : 'Unread'}
        </Tag>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => formatDate(v),
      sorter: (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Tooltip title="Delete">
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(r)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      {/* Stats cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Sent"
              value={stats.total_sent || total}
              prefix={<MailOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Read Rate"
              value={stats.read_rate}
              prefix={<EyeOutlined style={{ color: '#52c41a' }} />}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Unread Count"
              value={stats.unread_count}
              prefix={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}><BellOutlined /> Notifications</Title>
        <Space wrap>
          <Input.Search
            placeholder="Filter by user email"
            style={{ width: 200 }}
            allowClear
            onSearch={(v) => { setUserFilter(v.trim()); setPage(1); }}
          />
          <Select
            style={{ width: 120 }}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={TYPE_OPTIONS}
          />
          <Select
            style={{ width: 110 }}
            value={readFilter}
            onChange={(v) => { setReadFilter(v); setPage(1); }}
            options={READ_OPTIONS}
          />
          <Popconfirm
            title="Delete old notifications"
            description="Delete all notifications older than 30 days?"
            onConfirm={() => handleBulkDeleteOld(30)}
            okText="Delete"
            okType="danger"
          >
            <Button icon={<DeleteOutlined />} danger>
              Delete Old
            </Button>
          </Popconfirm>
          <Button type="primary" icon={<SendOutlined />} onClick={() => setSendModalOpen(true)}>
            Send Notification
          </Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={notifications}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `${t} notifications`,
        }}
        scroll={{ x: 1100 }}
      />

      <Modal
        title="Send Notification"
        open={sendModalOpen}
        onOk={handleSend}
        onCancel={() => { setSendModalOpen(false); form.resetFields(); setRecipientType('all'); }}
        okText="Send"
        confirmLoading={sending}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="Recipient">
            <Select
              value={recipientType}
              onChange={(v) => setRecipientType(v)}
              options={PLAN_OPTIONS}
            />
          </Form.Item>
          {recipientType === 'user' && (
            <Form.Item label="User Email" name="user_email" rules={[{ required: true, message: 'Please enter user email' }]}>
              <AutoComplete
                placeholder="Enter user email"
                options={searchUsers}
                onSearch={(value) => {
                  if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                  if (!value || value.length < 2) {
                    setSearchUsers([]);
                    return;
                  }
                  searchTimerRef.current = setTimeout(async () => {
                    try {
                      const res = await adminApi.listUsers({ limit: 10, offset: 0, search: value });
                      const d = res.data as any;
                      const inner = d.data ?? d;
                      const userList = inner.users ?? inner.data ?? [];
                      setSearchUsers(
                        (Array.isArray(userList) ? userList : []).map((u: any) => ({
                          value: u.email,
                          label: u.email,
                        }))
                      );
                    } catch {
                      setSearchUsers([]);
                    }
                  }, 300);
                }}
              />
            </Form.Item>
          )}
          <Form.Item label="Type" name="type" rules={[{ required: true, message: 'Please select type' }]}>
            <Select
              options={[
                { value: 'info', label: 'Info' },
                { value: 'warning', label: 'Warning' },
                { value: 'promo', label: 'Promo' },
                { value: 'system', label: 'System' },
              ]}
            />
          </Form.Item>
          <Form.Item label="Title" name="title" rules={[{ required: true, message: 'Please enter title' }]}>
            <Input placeholder="Notification title" />
          </Form.Item>
          <Form.Item label="Message" name="message" rules={[{ required: true, message: 'Please enter message' }]}>
            <TextArea rows={4} placeholder="Notification message" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
