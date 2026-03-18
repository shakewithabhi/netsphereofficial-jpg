import { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Input, Select, Space, Button, Tag, message, Modal, Form, Tooltip, AutoComplete } from 'antd';
import { SearchOutlined, DeleteOutlined, BellOutlined, SendOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminNotification, type SendNotificationPayload } from '../../api/admin';
import { formatDate } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title } = Typography;
const { TextArea } = Input;

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'promo', label: 'Promo' },
  { value: 'system', label: 'System' },
];

const typeColor = (type: string): string => {
  if (type === 'info') return 'blue';
  if (type === 'warning') return 'orange';
  if (type === 'promo') return 'green';
  if (type === 'system') return 'red';
  return 'default';
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [typeFilter, setTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [sendModalOpen, setSendModalOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [form] = Form.useForm();
  const [recipientType, setRecipientType] = useState<'all' | 'user'>('all');
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
      setNotifications(d.notifications ?? []);
      setTotal(d.total ?? 0);
    } catch {
      message.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter, userFilter]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);
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

  const handleSend = async () => {
    try {
      const values = await form.validateFields();
      setSending(true);
      const payload: SendNotificationPayload = {
        recipient: recipientType,
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
    } catch {
      message.error('Failed to send notification');
    } finally {
      setSending(false);
    }
  };

  const columns: ColumnsType<AdminNotification> = [
    {
      title: 'User',
      dataIndex: 'user_email',
      width: 200,
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
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Message',
      dataIndex: 'message',
      ellipsis: true,
      render: (msg: string) => msg.length > 80 ? `${msg.slice(0, 80)}...` : msg,
    },
    {
      title: 'Read',
      dataIndex: 'read',
      width: 70,
      render: (read: boolean) => (
        <span style={{
          display: 'inline-block',
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: read ? '#52c41a' : '#f5222d',
        }} />
      ),
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 180,
      render: (v: string) => formatDate(v),
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
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}><BellOutlined /> Notifications</Title>
        <Space wrap>
          <Input.Search
            placeholder="Filter by user email"
            style={{ width: 220 }}
            allowClear
            onSearch={(v) => { setUserFilter(v.trim()); setPage(1); }}
          />
          <Select
            style={{ width: 130 }}
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            options={TYPE_OPTIONS}
          />
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
        scroll={{ x: 1000 }}
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
              options={[
                { value: 'all', label: 'All Users (Broadcast)' },
                { value: 'user', label: 'Specific User' },
              ]}
            />
          </Form.Item>
          {recipientType === 'user' && (
            <Form.Item label="User Email" name="user_email" rules={[{ required: true, message: 'Please enter user email' }]}>
              <AutoComplete
                placeholder="Enter user email"
                options={[]}
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
