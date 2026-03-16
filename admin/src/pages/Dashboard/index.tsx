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
      .then((res) => setStats(res.data.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!stats) return null;

  const cards = [
    { title: 'Total Users', value: stats.total_users, icon: <TeamOutlined />, color: '#1677ff' },
    { title: 'Active Users', value: stats.active_users, icon: <UserOutlined />, color: '#52c41a' },
    { title: 'Signups Today', value: stats.signups_today, icon: <RiseOutlined />, color: '#faad14' },
    { title: 'Total Files', value: stats.total_files, icon: <FileOutlined />, color: '#722ed1' },
    { title: 'Storage Used', value: formatBytes(stats.total_storage_used), icon: <CloudOutlined />, color: '#eb2f96' },
    { title: 'Active Shares', value: stats.active_shares, icon: <ShareAltOutlined />, color: '#13c2c2' },
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
