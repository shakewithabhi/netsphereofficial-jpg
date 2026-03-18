import { useEffect, useState, useCallback } from 'react';
import { Card, Col, Row, Statistic, Table, Typography, Spin, Tag, Progress, Badge, Space } from 'antd';
import { HeartOutlined, ClockCircleOutlined, CodeOutlined, DatabaseOutlined } from '@ant-design/icons';
import { adminApi, type SystemHealth } from '../../api/admin';
import { formatBytes } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;

const statusBadge = (status: string) => {
  if (status === 'healthy') return <Badge status="success" text={<Text strong style={{ color: '#52c41a' }}>Healthy</Text>} />;
  if (status === 'degraded') return <Badge status="warning" text={<Text strong style={{ color: '#faad14' }}>Degraded</Text>} />;
  return <Badge status="error" text={<Text strong style={{ color: '#f5222d' }}>Down</Text>} />;
};

const componentStatus = (status: string) => (
  <span style={{
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    backgroundColor: status === 'up' ? '#52c41a' : '#f5222d',
    marginRight: 8,
  }} />
);

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);

  const unwrap = (res: any) => res.data?.data ?? res.data;

  const fetchData = useCallback(() => {
    adminApi.getSystemHealth()
      .then((res) => setHealth(unwrap(res)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 30000);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!health) return null;

  const h = health as any;
  const memoryPercent = h.memory_total > 0 ? Math.round((h.memory_used / h.memory_total) * 100) : 0;

  const componentColumns = [
    {
      title: 'Component',
      dataIndex: 'name',
      render: (name: string, r: any) => (
        <span>{componentStatus(r.status)}{name}</span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={status === 'up' ? 'green' : 'red'}>{status === 'up' ? 'Up' : 'Down'}</Tag>
      ),
    },
    {
      title: 'Latency',
      dataIndex: 'latency_ms',
      width: 120,
      render: (v: number) => `${v} ms`,
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}><HeartOutlined /> System Health</Title>
        <div>{statusBadge(h.status)}</div>
      </Space>

      <Row gutter={[16, 16]}>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Uptime"
              value={h.uptime ?? '-'}
              prefix={<ClockCircleOutlined style={{ color: '#52c41a' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Goroutines"
              value={h.goroutines ?? 0}
              prefix={<CodeOutlined style={{ color: '#1677ff' }} />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="Memory Used"
              value={formatBytes(h.memory_used ?? 0)}
              prefix={<DatabaseOutlined style={{ color: '#722ed1' }} />}
            />
            <Progress
              percent={memoryPercent}
              size="small"
              status={memoryPercent >= 90 ? 'exception' : 'active'}
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={6}>
          <Card>
            <Statistic
              title="DB Connections"
              value={h.db_connections ?? 0}
              prefix={<DatabaseOutlined style={{ color: '#faad14' }} />}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={16}>
          <Card title="Components">
            <Table
              dataSource={h.components ?? []}
              columns={componentColumns}
              rowKey="name"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col xs={24} lg={8}>
          <Card title="Runtime Info">
            <p><strong>Go Version:</strong> {h.go_version ?? '-'}</p>
            <p><strong>Memory Total:</strong> {formatBytes(h.memory_total ?? 0)}</p>
            <p><strong>Memory Usage:</strong> {memoryPercent}%</p>
            <p><Text type="secondary">Auto-refreshes every 30 seconds</Text></p>
          </Card>
        </Col>
      </Row>
    </div>
  );
}
