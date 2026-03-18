import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Spin, Progress, Tag } from 'antd';
import { CloudOutlined, FileOutlined, DatabaseOutlined, HddOutlined } from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import { adminApi, type StorageStats, type StoragePool, type MimeTypeStat, type DailyUploadStat, type TopStorageUser } from '../../api/admin';
import { formatBytes, planLabel } from '../../utils/format';

const { Title } = Typography;
const COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];

export default function StoragePage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [pool, setPool] = useState<StoragePool | null>(null);
  const [mimeStats, setMimeStats] = useState<MimeTypeStat[]>([]);
  const [uploadTrends, setUploadTrends] = useState<DailyUploadStat[]>([]);
  const [topStorageUsers, setTopStorageUsers] = useState<TopStorageUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unwrap = (res: any) => res.data?.data ?? res.data;
    Promise.all([
      adminApi.storageStats().then((res) => setStats(unwrap(res))).catch(() => {}),
      adminApi.storagePool().then((res) => setPool(unwrap(res))).catch(() => {}),
      adminApi.getTopStorageUsers().then((res) => {
        const d = unwrap(res);
        setTopStorageUsers(d.users ?? d ?? []);
      }).catch(() => {}),
      adminApi.mimeTypeStats().then((res) => {
        const d = unwrap(res);
        setMimeStats(Array.isArray(d) ? d : []);
      }).catch(() => {}),
      adminApi.uploadTrends(30).then((res) => {
        const d = unwrap(res);
        setUploadTrends(Array.isArray(d) ? d : []);
      }).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!stats) return null;

  const s = stats as any;

  const planData = (s.by_plan || []).map((p: any) => ({
    name: planLabel(p.plan),
    value: p.total_storage ?? p.total_used_bytes ?? 0,
    users: p.user_count,
  }));

  const topUsersData = (s.top_users || []).map((u: any) => ({
    name: u.display_name || u.email.split('@')[0],
    storage: u.storage_used,
    files: u.file_count,
  }));

  const mimeData = (mimeStats || []).map((m: any) => ({
    name: m.mime_type,
    value: m.total_size,
    count: m.file_count,
  }));

  const trendData = (uploadTrends || []).map((d: any) => ({
    date: String(d.date || '').slice(5) || d.date, // MM-DD
    files: d.file_count,
    bytes: d.total_bytes,
  }));

  return (
    <div>
      <Title level={4}>Storage Analytics</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Total Files" value={s.total_files ?? 0} prefix={<FileOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Total Storage Used" value={formatBytes(s.total_size ?? s.total_used_bytes ?? 0)} prefix={<CloudOutlined style={{ color: '#1677ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Avg File Size" value={formatBytes(s.avg_file_size ?? s.avg_per_user_bytes ?? 0)} prefix={<DatabaseOutlined style={{ color: '#52c41a' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Storage Pool" value={pool ? formatBytes(pool.used_capacity) : '-'} prefix={<HddOutlined style={{ color: '#faad14' }} />} suffix={pool ? `/ ${formatBytes(pool.total_capacity)}` : ''} />
            {pool && <Progress percent={Math.round(pool.usage_percent)} size="small" status={pool.usage_percent >= 90 ? 'exception' : 'active'} style={{ marginTop: 8 }} />}
          </Card>
        </Col>
      </Row>

      {trendData.length > 0 && (
        <Card title="Upload Trends (Last 30 Days)" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis yAxisId="left" />
              <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatBytes(v)} />
              <Tooltip formatter={(v: number, name: string) => name === 'bytes' ? formatBytes(v) : v} />
              <Legend />
              <Line yAxisId="left" type="monotone" dataKey="files" stroke="#1677ff" name="Files" />
              <Line yAxisId="right" type="monotone" dataKey="bytes" stroke="#52c41a" name="Bytes" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={8}>
          <Card title="Storage by Plan">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={planData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}: ${formatBytes(e.value)}`}>
                  {planData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBytes(v)} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Storage by File Type">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={mimeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(e) => `${e.name}`}>
                  {mimeData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatBytes(v)} />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Top Users by Storage">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={topUsersData} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" tickFormatter={(v) => formatBytes(v)} />
                <YAxis type="category" dataKey="name" width={80} />
                <Tooltip formatter={(v: number) => formatBytes(v)} />
                <Bar dataKey="storage" fill="#1677ff" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </Col>
      </Row>

      <Card title="Top 20 Users by Storage Usage" style={{ marginTop: 16 }}>
        <Table
          dataSource={topStorageUsers.length > 0 ? topStorageUsers : (s.top_users || [])}
          rowKey={(r: any) => r.user_id ?? r.id ?? r.email}
          pagination={false}
          size="small"
          columns={[
            { title: 'User', dataIndex: 'display_name', render: (v: string) => v || '-', ellipsis: true },
            { title: 'Email', dataIndex: 'email', ellipsis: true },
            { title: 'Plan', dataIndex: 'plan', width: 90, render: (v: string) => v ? <Tag color={v === 'free' ? 'default' : v === 'pro' ? 'blue' : 'gold'}>{planLabel(v)}</Tag> : '-' },
            { title: 'Storage Used', dataIndex: 'storage_used', width: 120, render: (v: number) => formatBytes(v) },
            { title: 'Storage Limit', dataIndex: 'storage_limit', width: 120, render: (v: number) => v ? formatBytes(v) : '-' },
            {
              title: 'Usage %',
              key: 'usage',
              width: 160,
              render: (_: unknown, r: any) => {
                const pct = r.usage_percent ?? (r.storage_limit > 0 ? Math.round((r.storage_used / r.storage_limit) * 100) : 0);
                return <Progress percent={pct} size="small" status={pct >= 90 ? 'exception' : 'active'} />;
              },
            },
            { title: 'Files', dataIndex: 'file_count', width: 80 },
          ]}
        />
      </Card>
    </div>
  );
}
