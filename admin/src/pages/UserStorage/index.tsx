import { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Spin, Space, Select, Input, Button, Progress, Card, message,
} from 'antd';
import {
  CloudOutlined, SearchOutlined, DownloadOutlined,
  PictureOutlined, VideoCameraOutlined, FileTextOutlined,
  SoundOutlined, FileUnknownOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { adminApi, type TopStorageUser, type UserStorageBreakdown } from '../../api/admin';
import { formatBytes, planLabel } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;

const PLAN_OPTIONS = [
  { value: '', label: 'All Plans' },
  { value: 'free', label: 'Free' },
  { value: 'pro', label: 'Pro' },
  { value: 'premium', label: 'Premium' },
];

const FILE_TYPE_COLORS: Record<string, string> = {
  images: '#1677ff',
  videos: '#722ed1',
  docs: '#52c41a',
  audio: '#faad14',
  other: '#8c8c8c',
};

export default function UserStoragePage() {
  const [users, setUsers] = useState<TopStorageUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [planFilter, setPlanFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [breakdowns, setBreakdowns] = useState<Record<string, UserStorageBreakdown>>({});
  const [breakdownLoading, setBreakdownLoading] = useState<Record<string, boolean>>({});

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.getTopStorageUsers();
      const d = data as any;
      setUsers(d.users ?? d ?? []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);
  usePolling(fetchUsers, 60000);

  const fetchBreakdown = async (userId: string) => {
    if (breakdowns[userId]) return;
    setBreakdownLoading((prev) => ({ ...prev, [userId]: true }));
    try {
      const { data } = await adminApi.getUserStorageBreakdown(userId);
      const d = (data as any)?.data ?? data;
      setBreakdowns((prev) => ({ ...prev, [userId]: d as UserStorageBreakdown }));
    } catch {
      // Set mock fallback on failure
      setBreakdowns((prev) => ({
        ...prev,
        [userId]: {
          images: { count: 0, size: 0 },
          videos: { count: 0, size: 0 },
          audio: { count: 0, size: 0 },
          docs: { count: 0, size: 0 },
          other: { count: 0, size: 0 },
          total_used: 0,
          storage_limit: 0,
        },
      }));
    } finally {
      setBreakdownLoading((prev) => ({ ...prev, [userId]: false }));
    }
  };

  const filteredUsers = users.filter((u) => {
    if (planFilter && u.plan !== planFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (u.email || '').toLowerCase().includes(s) || (u.display_name || '').toLowerCase().includes(s);
    }
    return true;
  });

  const exportCsv = () => {
    const headers = ['Email', 'Display Name', 'Plan', 'Storage Used', 'Storage Limit', '% Used', 'File Count'];
    const rows = filteredUsers.map((u) => [
      u.email,
      u.display_name,
      u.plan,
      u.storage_used,
      u.storage_limit,
      u.usage_percent,
      u.file_count,
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user_storage_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    message.success('CSV exported');
  };

  const columns: ColumnsType<TopStorageUser> = [
    {
      title: 'Email',
      dataIndex: 'email',
      width: 220,
      ellipsis: true,
      sorter: (a, b) => a.email.localeCompare(b.email),
    },
    {
      title: 'Display Name',
      dataIndex: 'display_name',
      width: 160,
      ellipsis: true,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      width: 100,
      render: (v: string) => planLabel(v),
      sorter: (a, b) => a.plan.localeCompare(b.plan),
    },
    {
      title: 'Storage Used',
      dataIndex: 'storage_used',
      width: 130,
      render: (v: number) => formatBytes(v ?? 0),
      sorter: (a, b) => (a.storage_used ?? 0) - (b.storage_used ?? 0),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Storage Limit',
      dataIndex: 'storage_limit',
      width: 130,
      render: (v: number) => formatBytes(v ?? 0),
    },
    {
      title: '% Used',
      dataIndex: 'usage_percent',
      width: 150,
      render: (v: number) => (
        <Progress
          percent={Math.min(v ?? 0, 100)}
          size="small"
          status={v >= 90 ? 'exception' : v >= 70 ? 'active' : 'normal'}
          format={(p) => `${(p ?? 0).toFixed(1)}%`}
        />
      ),
      sorter: (a, b) => (a.usage_percent ?? 0) - (b.usage_percent ?? 0),
    },
    {
      title: 'Files',
      dataIndex: 'file_count',
      width: 80,
      sorter: (a, b) => (a.file_count ?? 0) - (b.file_count ?? 0),
    },
  ];

  const renderBreakdown = (userId: string) => {
    if (breakdownLoading[userId]) return <Spin size="small" />;
    const bd = breakdowns[userId];
    if (!bd) return <Text type="secondary">No breakdown data available</Text>;

    const chartData = [
      { type: 'Images', size: bd.images?.size ?? 0, count: bd.images?.count ?? 0, fill: FILE_TYPE_COLORS.images },
      { type: 'Videos', size: bd.videos?.size ?? 0, count: bd.videos?.count ?? 0, fill: FILE_TYPE_COLORS.videos },
      { type: 'Documents', size: bd.docs?.size ?? 0, count: bd.docs?.count ?? 0, fill: FILE_TYPE_COLORS.docs },
      { type: 'Audio', size: bd.audio?.size ?? 0, count: bd.audio?.count ?? 0, fill: FILE_TYPE_COLORS.audio },
      { type: 'Other', size: bd.other?.size ?? 0, count: bd.other?.count ?? 0, fill: FILE_TYPE_COLORS.other },
    ];

    return (
      <div style={{ padding: '8px 0' }}>
        <Space size={24} wrap style={{ marginBottom: 16 }}>
          <span><PictureOutlined style={{ color: FILE_TYPE_COLORS.images }} /> Images: {bd.images?.count ?? 0} files ({formatBytes(bd.images?.size ?? 0)})</span>
          <span><VideoCameraOutlined style={{ color: FILE_TYPE_COLORS.videos }} /> Videos: {bd.videos?.count ?? 0} files ({formatBytes(bd.videos?.size ?? 0)})</span>
          <span><FileTextOutlined style={{ color: FILE_TYPE_COLORS.docs }} /> Docs: {bd.docs?.count ?? 0} files ({formatBytes(bd.docs?.size ?? 0)})</span>
          <span><SoundOutlined style={{ color: FILE_TYPE_COLORS.audio }} /> Audio: {bd.audio?.count ?? 0} files ({formatBytes(bd.audio?.size ?? 0)})</span>
          <span><FileUnknownOutlined style={{ color: FILE_TYPE_COLORS.other }} /> Other: {bd.other?.count ?? 0} files ({formatBytes(bd.other?.size ?? 0)})</span>
        </Space>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={chartData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(v) => formatBytes(v)} />
            <YAxis type="category" dataKey="type" width={90} />
            <RechartsTooltip
              formatter={(value: number) => formatBytes(value)}
              labelFormatter={(label) => `${label}`}
            />
            <Bar dataKey="size" name="Storage Used" fill="#1677ff" radius={[0, 4, 4, 0]}>
              {chartData.map((entry, index) => (
                <rect key={index} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}><CloudOutlined /> Per-user Storage Breakdown</Title>
        <Space wrap>
          <Input
            placeholder="Search by email or name"
            prefix={<SearchOutlined />}
            style={{ width: 240 }}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
          <Select
            style={{ width: 130 }}
            value={planFilter}
            onChange={setPlanFilter}
            options={PLAN_OPTIONS}
          />
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>Export CSV</Button>
        </Space>
      </Space>

      <Table
        rowKey="user_id"
        columns={columns}
        dataSource={filteredUsers}
        size="small"
        pagination={{
          pageSize: 20,
          showSizeChanger: false,
          showTotal: (t) => `${t} users`,
        }}
        scroll={{ x: 1100 }}
        expandable={{
          expandedRowKeys: expandedUserId ? [expandedUserId] : [],
          onExpand: (expanded, record) => {
            if (expanded) {
              setExpandedUserId(record.user_id);
              fetchBreakdown(record.user_id);
            } else {
              setExpandedUserId(null);
            }
          },
          expandedRowRender: (record) => renderBreakdown(record.user_id),
        }}
      />
    </div>
  );
}
