import { useEffect, useState, useCallback } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Spin, Tag } from 'antd';
import { DollarOutlined, TeamOutlined, RiseOutlined } from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import { adminApi, type RevenueStats } from '../../api/admin';
import { formatDate, planLabel } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title } = Typography;

export default function RevenuePage() {
  const [stats, setStats] = useState<RevenueStats | null>(null);
  const [loading, setLoading] = useState(true);

  const unwrap = (res: any) => res.data?.data ?? res.data;

  const fetchData = useCallback(() => {
    adminApi.getRevenueStats()
      .then((res) => setStats(unwrap(res)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 30000);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!stats) return null;

  const s = stats as any;

  const planColumns = [
    { title: 'Plan', dataIndex: 'plan', render: (v: string) => <Tag color={v === 'free' ? 'default' : v === 'pro' ? 'blue' : 'gold'}>{planLabel(v)}</Tag> },
    { title: 'User Count', dataIndex: 'user_count' },
    { title: 'Price/Month', dataIndex: 'price_per_month', render: (v: number) => `$${(v ?? 0).toFixed(2)}` },
    { title: 'Monthly Revenue', dataIndex: 'monthly_revenue', render: (v: number) => `$${(v ?? 0).toFixed(2)}` },
  ];

  const changeColumns = [
    { title: 'User', dataIndex: 'user_email', ellipsis: true },
    {
      title: 'Plan Change',
      key: 'change',
      render: (_: unknown, r: any) => (
        <span>
          <Tag color="default">{planLabel(r.old_plan)}</Tag>
          {' → '}
          <Tag color="blue">{planLabel(r.new_plan)}</Tag>
        </span>
      ),
    },
    { title: 'Date', dataIndex: 'changed_at', render: (v: string) => formatDate(v) },
  ];

  const projectionData = (s.revenue_projection || []).map((d: any) => ({
    month: d.month,
    revenue: d.projected_revenue,
  }));

  return (
    <div>
      <Title level={4}><DollarOutlined /> Revenue Dashboard</Title>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Paid Users"
              value={s.total_paid_users ?? 0}
              prefix={<TeamOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Monthly Revenue"
              value={s.monthly_revenue ?? 0}
              prefix={<span style={{ color: '#52c41a' }}>$</span>}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Avg Revenue Per User"
              value={s.avg_revenue_per_user ?? 0}
              prefix={<span style={{ color: '#faad14' }}>$</span>}
              precision={2}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={12}>
          <Card title="Plan Distribution">
            <Table
              dataSource={s.plan_distribution ?? []}
              columns={planColumns}
              rowKey="plan"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Recent Plan Changes">
            <Table
              dataSource={s.recent_plan_changes ?? []}
              columns={changeColumns}
              rowKey={(r: any) => `${r.user_email}-${r.changed_at}`}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      {projectionData.length > 0 && (
        <Card title="Revenue Projection (Next 6 Months)" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={projectionData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `$${v}`} />
              <Tooltip formatter={(v: number) => [`$${v.toFixed(2)}`, 'Projected Revenue']} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#52c41a" name="Projected Revenue" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
