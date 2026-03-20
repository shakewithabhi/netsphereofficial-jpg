import { useEffect, useState, useCallback } from 'react';
import { Alert, Card, Col, Row, Statistic, Table, Typography, Spin, Tag, Space } from 'antd';
import {
  MoneyCollectOutlined, TeamOutlined, RiseOutlined, FallOutlined,
  CrownOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { adminApi, type RevenueStats, type BillingStats } from '../../api/admin';
import { formatDate, planLabel } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;

const PLAN_COLORS: Record<string, string> = {
  free: '#8c8c8c',
  pro: '#1677ff',
  premium: '#faad14',
};

const PIE_COLORS = ['#8c8c8c', '#1677ff', '#faad14', '#52c41a', '#722ed1'];

// Mock data generators for when API returns empty
const generateMockBillingData = (revenueStats: RevenueStats | null): BillingStats => {
  const planDist = revenueStats?.plan_distribution ?? [];
  const totalPaid = revenueStats?.total_paid_users ?? 0;
  const monthlyRev = revenueStats?.monthly_revenue ?? 0;

  return {
    mrr: monthlyRev,
    total_revenue: monthlyRev * 12,
    active_subscriptions: totalPaid,
    churn_rate: totalPaid > 0 ? 2.5 : 0,
    revenue_over_time: (revenueStats?.revenue_projection ?? []).map((d) => ({
      month: d.month,
      revenue: d.projected_revenue,
    })),
    subscriptions_by_plan: planDist.map((p) => ({
      plan: p.plan,
      count: p.user_count,
    })),
    recent_transactions: (revenueStats?.recent_plan_changes ?? []).map((c) => ({
      user_email: c.user_email,
      plan: c.new_plan,
      amount: planDist.find((p) => p.plan === c.new_plan)?.price_per_month ?? 0,
      date: c.changed_at,
      status: 'completed',
    })),
    revenue_by_plan: planDist.filter((p) => p.plan !== 'free').map((p) => ({
      plan: p.plan,
      revenue: p.monthly_revenue,
    })),
  };
};

export default function BillingPage() {
  const [billing, setBilling] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataStale, setDataStale] = useState(false);

  const unwrap = (res: any) => res.data?.data ?? res.data;

  const fetchData = useCallback(async () => {
    try {
      // Try billing endpoint first
      const { data } = await adminApi.getBillingStats();
      setBilling(unwrap({ data }) as BillingStats);
      setDataStale(false);
    } catch {
      // Fallback: build from revenue stats
      setDataStale(true);
      try {
        const { data } = await adminApi.getRevenueStats();
        const revStats = unwrap({ data }) as RevenueStats;
        setBilling(generateMockBillingData(revStats));
      } catch {
        setBilling(generateMockBillingData(null));
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 30000);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" tip="Loading..." /></div>;
  if (!billing) return <div style={{ display: 'flex', justifyContent: 'center', padding: 100 }}><Spin size="large" tip="Loading..." /></div>;

  const b = billing;

  const transactionColumns = [
    {
      title: 'User',
      dataIndex: 'user_email',
      ellipsis: true,
    },
    {
      title: 'Plan',
      dataIndex: 'plan',
      width: 100,
      render: (v: string) => <Tag color={PLAN_COLORS[v] || 'default'}>{planLabel(v)}</Tag>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      width: 100,
      render: (v: number) => `₹${(v ?? 0).toFixed(2)}`,
    },
    {
      title: 'Date',
      dataIndex: 'date',
      width: 180,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 110,
      render: (v: string) => (
        <Tag color={v === 'completed' ? 'green' : v === 'pending' ? 'orange' : v === 'failed' ? 'red' : 'default'}>
          {(v || 'unknown').charAt(0).toUpperCase() + (v || 'unknown').slice(1)}
        </Tag>
      ),
    },
  ];

  return (
    <div>
      {dataStale && <Alert type="warning" message="Unable to load live billing data. Showing cached/sample data." showIcon closable style={{ marginBottom: 16 }} />}
      <Title level={4}><MoneyCollectOutlined /> Billing / Revenue Dashboard</Title>

      {/* Stats cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Monthly Recurring Revenue"
              value={b.mrr ?? 0}
              prefix={<span style={{ color: '#52c41a' }}>₹</span>}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Total Revenue"
              value={b.total_revenue ?? 0}
              prefix={<span style={{ color: '#52c41a' }}>₹</span>}
              precision={2}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Active Subscriptions"
              value={b.active_subscriptions ?? 0}
              prefix={<CrownOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Churn Rate"
              value={b.churn_rate ?? 0}
              prefix={<FallOutlined style={{ color: '#f5222d' }} />}
              suffix="%"
              precision={1}
            />
          </Card>
        </Col>
      </Row>

      {/* Revenue over time line chart */}
      {(b.revenue_over_time ?? []).length > 0 && (
        <Card title="Revenue Over Time (Monthly)" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={b.revenue_over_time}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" />
              <YAxis tickFormatter={(v) => `₹${v}`} />
              <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, 'Revenue']} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="#52c41a" name="Revenue" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Subscriptions by plan bar chart */}
        <Col xs={24} lg={12}>
          <Card title="Subscriptions by Plan">
            {(b.subscriptions_by_plan ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={b.subscriptions_by_plan}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="plan" tickFormatter={(v) => planLabel(v)} />
                  <YAxis />
                  <Tooltip
                    formatter={(v: number, name: string) => [v, 'Subscribers']}
                    labelFormatter={(label) => planLabel(label as string)}
                  />
                  <Bar dataKey="count" name="Subscribers" radius={[4, 4, 0, 0]}>
                    {(b.subscriptions_by_plan ?? []).map((entry, index) => (
                      <Cell key={index} fill={PLAN_COLORS[entry.plan] || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Text type="secondary">No subscription data available</Text>
            )}
          </Card>
        </Col>

        {/* Revenue by plan pie chart */}
        <Col xs={24} lg={12}>
          <Card title="Revenue by Plan">
            {(b.revenue_by_plan ?? []).length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={b.revenue_by_plan}
                    dataKey="revenue"
                    nameKey="plan"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ plan, revenue }) => `${planLabel(plan)}: ₹${revenue.toFixed(0)}`}
                  >
                    {(b.revenue_by_plan ?? []).map((entry, index) => (
                      <Cell key={index} fill={PLAN_COLORS[entry.plan] || PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [`₹${v.toFixed(2)}`, 'Revenue']} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <Text type="secondary">No revenue data available</Text>
            )}
          </Card>
        </Col>
      </Row>

      {/* Recent transactions */}
      <Card title="Recent Transactions" style={{ marginTop: 16 }}>
        <Table
          dataSource={b.recent_transactions ?? []}
          columns={transactionColumns}
          rowKey={(r, i) => `${r.user_email}-${r.date}-${i}`}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
          scroll={{ x: 700 }}
        />
      </Card>
    </div>
  );
}
