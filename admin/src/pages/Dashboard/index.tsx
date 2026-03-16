import { useEffect, useState } from 'react';
import { Card, Col, Row, Statistic, Spin, Typography } from 'antd';
import { UserOutlined, FileOutlined, CloudOutlined, ShareAltOutlined, TeamOutlined, RiseOutlined } from '@ant-design/icons';
import { adminApi, type DashboardStats } from '../../api/admin';
import { formatBytes } from '../../utils/format';

const { Title } = Typography;

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.dashboard()
      .then((res) => setStats(res.data?.data ?? res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
  ];

  return (
    <div>
      <Title level={4}>Dashboard</Title>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={8} key={c.title}>
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
    </div>
  );
}
