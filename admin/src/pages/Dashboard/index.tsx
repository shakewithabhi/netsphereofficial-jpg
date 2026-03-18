import { useEffect, useState, useCallback } from 'react';
import { Card, Col, Row, Statistic, Spin, Typography } from 'antd';
import {
  UserOutlined, FileOutlined, CloudOutlined, ShareAltOutlined,
  TeamOutlined, RiseOutlined, DeleteOutlined, UploadOutlined,
  CommentOutlined, StarOutlined, BellOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from 'recharts';
import { adminApi, type DashboardStats, type DailySignupStat, type DailyUploadStat } from '../../api/admin';
import { formatBytes } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title } = Typography;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [signupTrends, setSignupTrends] = useState<DailySignupStat[]>([]);
  const [uploadTrends, setUploadTrends] = useState<DailyUploadStat[]>([]);
  const [loading, setLoading] = useState(true);

  const unwrap = (res: any) => res.data?.data ?? res.data;

  const fetchData = useCallback(() => {
    Promise.all([
      adminApi.dashboard().then((res) => setStats(unwrap(res))).catch(() => {}),
      adminApi.signupTrends(30).then((res) => {
        const d = unwrap(res);
        setSignupTrends(Array.isArray(d) ? d : []);
      }).catch(() => {}),
      adminApi.uploadTrends(30).then((res) => {
        const d = unwrap(res);
        setUploadTrends(Array.isArray(d) ? d : []);
      }).catch(() => {}),
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 30000);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!stats) return null;

  const s = stats as any;
  const cards = [
    { title: 'Total Users', value: s.total_users ?? 0, icon: <TeamOutlined />, color: '#1677ff' },
    { title: 'Active Users', value: s.active_users ?? 0, icon: <UserOutlined />, color: '#52c41a' },
    { title: 'Signups Today', value: s.signups_today ?? s.new_users_today ?? 0, icon: <RiseOutlined />, color: '#faad14' },
    { title: 'Total Files', value: s.total_files ?? 0, icon: <FileOutlined />, color: '#722ed1' },
    { title: 'Storage Used', value: formatBytes(s.total_storage_used ?? s.total_storage_bytes ?? 0), icon: <CloudOutlined />, color: '#eb2f96' },
    { title: 'Active Shares', value: s.active_shares ?? 0, icon: <ShareAltOutlined />, color: '#13c2c2' },
    { title: 'Uploads Today', value: s.uploads_today ?? 0, icon: <UploadOutlined />, color: '#fa8c16' },
    { title: 'Trashed Files', value: s.trashed_files ?? 0, icon: <DeleteOutlined />, color: '#f5222d' },
    { title: 'Total Comments', value: s.total_comments ?? 0, icon: <CommentOutlined />, color: '#2f54eb' },
    { title: 'Total Stars', value: s.total_stars ?? 0, icon: <StarOutlined />, color: '#fadb14' },
    { title: 'Notifications Sent', value: s.total_notifications ?? 0, icon: <BellOutlined />, color: '#597ef7' },
    { title: 'Unread Notifications', value: s.unread_notifications ?? 0, icon: <BellOutlined />, color: '#ff7a45' },
  ];

  const signupData = signupTrends.map((d) => ({
    date: String(d.date || '').slice(5),
    signups: d.count,
  }));

  const uploadData = uploadTrends.map((d: any) => ({
    date: String(d.date || '').slice(5),
    files: d.file_count,
    bytes: d.total_bytes,
  }));

  return (
    <div>
      <Title level={4}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} key={c.title}>
            <Card>
              <Statistic
                title={c.title}
                value={c.value}
                prefix={<span style={{ color: c.color }}>{c.icon}</span>}
              />
            </Card>
          </Col>
        ))}
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {signupData.length > 0 && (
          <Col xs={24} lg={12}>
            <Card title="Signup Trends (Last 30 Days)">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={signupData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="signups" stroke="#1677ff" fill="#1677ff" fillOpacity={0.2} name="Signups" />
                </AreaChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}

        {uploadData.length > 0 && (
          <Col xs={24} lg={12}>
            <Card title="Upload Trends (Last 30 Days)">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={uploadData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" tickFormatter={(v) => formatBytes(v)} />
                  <Tooltip formatter={(v: number, name: string) => name === 'Bytes' ? formatBytes(v) : v} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="files" stroke="#722ed1" name="Files" />
                  <Line yAxisId="right" type="monotone" dataKey="bytes" stroke="#52c41a" name="Bytes" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
