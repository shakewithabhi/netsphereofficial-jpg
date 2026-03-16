import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Spin, Progress } from 'antd';
import { CloudOutlined, FileOutlined, DatabaseOutlined, HddOutlined } from '@ant-design/icons';
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, Legend,
} from 'recharts';
import { adminApi, type StorageStats, type StoragePool, type MimeTypeStat, type DailyUploadStat } from '../../api/admin';
import { formatBytes, planLabel } from '../../utils/format';

const { Title } = Typography;
const COLORS = ['#1677ff', '#52c41a', '#faad14', '#eb2f96', '#722ed1', '#13c2c2'];

export default function StoragePage() {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [pool, setPool] = useState<StoragePool | null>(null);
  const [mimeStats, setMimeStats] = useState<MimeTypeStat[]>([]);
  const [uploadTrends, setUploadTrends] = useState<DailyUploadStat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.storageStats().then((res) => setStats(res.data.data)),
      adminApi.storagePool().then((res) => setPool(res.data as unknown as StoragePool)).catch(() => {}),
      adminApi.mimeTypeStats().then((res) => setMimeStats(res.data as unknown as MimeTypeStat[])).catch(() => {}),
      adminApi.uploadTrends(30).then((res) => setUploadTrends(res.data as unknown as DailyUploadStat[])).catch(() => {}),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!stats) return null;

  const planData = (stats.by_plan || []).map((p) => ({
    name: planLabel(p.plan),
    value: p.total_storage,
    users: p.user_count,
  }));

  const topUsersData = (stats.top_users || []).map((u) => ({
    name: u.display_name || u.email.split('@')[0],
    storage: u.storage_used,
    files: u.file_count,
  }));

  const mimeData = (mimeStats || []).map((m) => ({
    name: m.mime_type,
    value: m.total_size,
    count: m.file_count,
  }));

  const trendData = (uploadTrends || []).map((d) => ({
    date: d.date.slice(5), // MM-DD
    files: d.file_count,
    bytes: d.total_bytes,
  }));

  return (
    <div>
      <Title level={4}>Storage Analytics</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Total Files" value={stats.total_files} prefix={<FileOutlined style={{ color: '#722ed1' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Total Storage Used" value={formatBytes(stats.total_size)} prefix={<CloudOutlined style={{ color: '#1677ff' }} />} />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic title="Avg File Size" value={formatBytes(stats.avg_file_size)} prefix={<DatabaseOutlined style={{ color: '#52c41a' }} />} />
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

      <Card title="Top 10 Users" style={{ marginTop: 16 }}>
        <Table
          dataSource={stats.top_users || []}
          rowKey="user_id"
          pagination={false}
          columns={[
            { title: 'Email', dataIndex: 'email', ellipsis: true },
            { title: 'Name', dataIndex: 'display_name', render: (v) => v || '-' },
            { title: 'Storage Used', dataIndex: 'storage_used', render: (v) => formatBytes(v) },
            { title: 'Files', dataIndex: 'file_count' },
          ]}
        />
      </Card>
    </div>
  );
}
