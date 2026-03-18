import { useEffect, useState, useCallback } from 'react';
import { Card, Col, Row, Statistic, Spin, Typography, Table, Progress } from 'antd';
import {
  UserOutlined, DollarOutlined, EyeOutlined, TeamOutlined,
  PercentageOutlined, RiseOutlined,
} from '@ant-design/icons';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend,
} from 'recharts';
import { adminApi, type AdAnalytics } from '../../api/admin';
import { usePolling } from '../../hooks/usePolling';

const { Title } = Typography;

const COLORS = ['#1677ff', '#52c41a', '#722ed1', '#faad14', '#eb2f96', '#13c2c2'];

export default function AdAnalyticsPage() {
  const [analytics, setAnalytics] = useState<AdAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const unwrap = (res: any) => res.data?.data ?? res.data;

  const fetchData = useCallback(() => {
    adminApi.getAdAnalytics()
      .then((res) => setAnalytics(unwrap(res)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 30000);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!analytics) return null;

  const a = analytics as any;
  const totalFree = a.total_free_users ?? 0;
  const totalPaid = a.total_paid_users ?? 0;
  const freePercent = a.free_user_percentage ?? 0;
  const impressions = a.estimated_impressions ?? 0;
  const dailyRevenue = a.revenue_estimate ?? 0;

  const cards = [
    { title: 'Free Users', value: totalFree, icon: <UserOutlined />, color: '#1677ff' },
    { title: 'Paid Users', value: totalPaid, icon: <TeamOutlined />, color: '#52c41a' },
    { title: 'Free User %', value: `${freePercent.toFixed(1)}%`, icon: <PercentageOutlined />, color: '#faad14' },
    { title: 'Est. Daily Impressions', value: impressions.toLocaleString(), icon: <EyeOutlined />, color: '#722ed1' },
    { title: 'Est. Daily Revenue', value: `$${dailyRevenue.toFixed(2)}`, icon: <DollarOutlined />, color: '#eb2f96' },
  ];

  const planData = (a.plan_distribution ?? []).map((p: any) => ({
    name: (p.plan || 'unknown').charAt(0).toUpperCase() + (p.plan || 'unknown').slice(1),
    value: p.count,
  }));

  const revenueProjections = [
    { period: 'Daily', impressions, revenue: dailyRevenue },
    { period: 'Weekly', impressions: impressions * 7, revenue: dailyRevenue * 7 },
    { period: 'Monthly', impressions: impressions * 30, revenue: dailyRevenue * 30 },
    { period: 'Yearly', impressions: impressions * 365, revenue: dailyRevenue * 365 },
  ];

  const projectionColumns = [
    { title: 'Period', dataIndex: 'period', key: 'period' },
    {
      title: 'Est. Impressions',
      dataIndex: 'impressions',
      key: 'impressions',
      render: (v: number) => v.toLocaleString(),
    },
    {
      title: 'Est. Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      render: (v: number) => `$${v.toFixed(2)}`,
    },
  ];

  const conversionOpportunity = totalFree > 0 ? totalFree : 0;
  const potentialRevenuePerUser = 4.99; // avg monthly subscription price
  const conversionRate5 = Math.round(conversionOpportunity * 0.05);
  const conversionRate10 = Math.round(conversionOpportunity * 0.10);

  return (
    <div>
      <Title level={4}>Ad Analytics</Title>
      <Row gutter={[16, 16]}>
        {cards.map((c) => (
          <Col xs={24} sm={12} lg={6} xl={4} key={c.title}>
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
        <Col xs={24} lg={12}>
          <Card title="Plan Distribution">
            {planData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={planData}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {planData.map((_: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>No plan data available</div>
            )}
          </Card>
        </Col>

        <Col xs={24} lg={12}>
          <Card title="Revenue Projections">
            <Table
              dataSource={revenueProjections}
              columns={projectionColumns}
              pagination={false}
              rowKey="period"
              size="middle"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card title="Conversion Opportunity">
            <Row gutter={[24, 16]}>
              <Col xs={24} sm={12}>
                <Statistic
                  title="Free Users Available for Conversion"
                  value={conversionOpportunity}
                  prefix={<RiseOutlined style={{ color: '#1677ff' }} />}
                />
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ marginBottom: 8 }}>
                    <strong>At 5% conversion:</strong> {conversionRate5} users = ${(conversionRate5 * potentialRevenuePerUser).toFixed(2)}/mo
                  </div>
                  <Progress percent={5} strokeColor="#52c41a" />
                </div>
                <div>
                  <div style={{ marginBottom: 8 }}>
                    <strong>At 10% conversion:</strong> {conversionRate10} users = ${(conversionRate10 * potentialRevenuePerUser).toFixed(2)}/mo
                  </div>
                  <Progress percent={10} strokeColor="#1677ff" />
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
