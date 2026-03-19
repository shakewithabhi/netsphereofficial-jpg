import { useEffect, useState, useCallback } from 'react';
import {
  Card, Col, Row, Statistic, Table, Typography, Spin, Tag, Progress,
  Badge, Space, Switch,
} from 'antd';
import {
  HeartOutlined, ClockCircleOutlined, CodeOutlined, DatabaseOutlined,
  CloudOutlined, ApiOutlined, ThunderboltOutlined, HddOutlined,
  WifiOutlined,
} from '@ant-design/icons';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type SystemHealth } from '../../api/admin';
import { formatBytes } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;

const statusBadge = (status: string) => {
  if (status === 'healthy') return <Badge status="success" text={<Text strong style={{ color: '#52c41a' }}>Healthy</Text>} />;
  if (status === 'degraded') return <Badge status="warning" text={<Text strong style={{ color: '#faad14' }}>Degraded</Text>} />;
  return <Badge status="error" text={<Text strong style={{ color: '#f5222d' }}>Down</Text>} />;
};

const SERVICE_ICONS: Record<string, React.ReactNode> = {
  api: <ApiOutlined />,
  database: <DatabaseOutlined />,
  storage: <CloudOutlined />,
  redis: <ThunderboltOutlined />,
  db: <DatabaseOutlined />,
};

export default function SystemHealthPage() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const unwrap = (res: any) => res.data?.data ?? res.data;

  const fetchData = useCallback(() => {
    adminApi.getSystemHealth()
      .then((res) => setHealth(unwrap(res)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  usePolling(fetchData, 30000, autoRefresh);

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (!health) return null;

  const h = health as any;
  const memoryPercent = h.memory_total > 0 ? Math.round((h.memory_used / h.memory_total) * 100) : 0;
  const cpuUsage = h.cpu_usage ?? 0;
  const diskPercent = h.disk_total > 0 ? Math.round((h.disk_used / h.disk_total) * 100) : 0;
  const activeConnections = h.active_connections ?? h.db_connections ?? 0;

  // Service status indicators
  const services = (h.components ?? []).map((c: any) => ({
    name: c.name,
    status: c.status,
    latency: c.latency_ms,
  }));

  // Default services if components is empty
  const defaultServices = [
    { name: 'API', status: h.status === 'down' ? 'down' : 'up', latency: 0 },
    { name: 'Database', status: h.status === 'down' ? 'down' : 'up', latency: 0 },
    { name: 'Storage', status: h.status === 'down' ? 'down' : 'up', latency: 0 },
    { name: 'Redis', status: h.status === 'down' ? 'down' : 'up', latency: 0 },
  ];

  const displayServices = services.length > 0 ? services : defaultServices;

  // Response times chart data
  const responseTimeData = (h.response_times ?? []).map((d: any) => ({
    time: d.timestamp ? new Date(d.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '',
    p50: d.p50 ?? 0,
    p95: d.p95 ?? 0,
    p99: d.p99 ?? 0,
  }));

  // Recent errors
  const errorColumns: ColumnsType<any> = [
    {
      title: 'Timestamp',
      dataIndex: 'timestamp',
      width: 180,
      render: (v: string) => v ? new Date(v).toLocaleString() : '-',
    },
    {
      title: 'Endpoint',
      dataIndex: 'endpoint',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status_code',
      width: 80,
      render: (v: number) => (
        <Tag color={v >= 500 ? 'red' : v >= 400 ? 'orange' : 'default'}>{v}</Tag>
      ),
    },
    {
      title: 'Message',
      dataIndex: 'message',
      ellipsis: true,
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Space>
          <Title level={4} style={{ margin: 0 }}><HeartOutlined /> System Health</Title>
          <div style={{ marginLeft: 8 }}>{statusBadge(h.status)}</div>
        </Space>
        <Space>
          <Text type="secondary">Auto-refresh</Text>
          <Switch checked={autoRefresh} onChange={setAutoRefresh} size="small" />
          {autoRefresh && <Text type="secondary" style={{ fontSize: 12 }}>(every 30s)</Text>}
        </Space>
      </Space>

      {/* Stats cards */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="Uptime"
              value={h.uptime ?? '-'}
              prefix={<ClockCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="CPU Usage"
              value={cpuUsage}
              prefix={<CodeOutlined style={{ color: '#1677ff' }} />}
              suffix="%"
              valueStyle={{ fontSize: 16 }}
            />
            <Progress percent={cpuUsage} size="small" status={cpuUsage >= 90 ? 'exception' : 'active'} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="Memory"
              value={formatBytes(h.memory_used ?? 0)}
              prefix={<DatabaseOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ fontSize: 16 }}
            />
            <Progress percent={memoryPercent} size="small" status={memoryPercent >= 90 ? 'exception' : 'active'} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="Disk Usage"
              value={diskPercent || 0}
              prefix={<HddOutlined style={{ color: '#eb2f96' }} />}
              suffix="%"
              valueStyle={{ fontSize: 16 }}
            />
            <Progress percent={diskPercent} size="small" status={diskPercent >= 90 ? 'exception' : 'active'} showInfo={false} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="Connections"
              value={activeConnections}
              prefix={<WifiOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={4}>
          <Card size="small">
            <Statistic
              title="Goroutines"
              value={h.goroutines ?? 0}
              prefix={<CodeOutlined style={{ color: '#13c2c2' }} />}
              valueStyle={{ fontSize: 16 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Service status indicators */}
      <Card title="Service Status" style={{ marginTop: 16 }} size="small">
        <Row gutter={[16, 8]}>
          {displayServices.map((svc: any) => (
            <Col xs={12} sm={6} key={svc.name}>
              <Space>
                <span style={{
                  display: 'inline-block',
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  backgroundColor: svc.status === 'up' ? '#52c41a' : '#f5222d',
                  boxShadow: svc.status === 'up' ? '0 0 6px #52c41a' : '0 0 6px #f5222d',
                }} />
                {SERVICE_ICONS[svc.name.toLowerCase()] || <ApiOutlined />}
                <Text strong>{svc.name}</Text>
                <Tag color={svc.status === 'up' ? 'green' : 'red'} style={{ margin: 0 }}>
                  {svc.status === 'up' ? 'UP' : 'DOWN'}
                </Tag>
                {svc.latency > 0 && <Text type="secondary">{svc.latency}ms</Text>}
              </Space>
            </Col>
          ))}
        </Row>
      </Card>

      {/* API Response Times chart */}
      {responseTimeData.length > 0 && (
        <Card title="API Response Times (Last 24h)" style={{ marginTop: 16 }}>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={responseTimeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis tickFormatter={(v) => `${v}ms`} />
              <Tooltip formatter={(v: number) => [`${v}ms`]} />
              <Legend />
              <Line type="monotone" dataKey="p50" stroke="#52c41a" name="p50" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p95" stroke="#faad14" name="p95" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="p99" stroke="#f5222d" name="p99" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* Recent errors */}
        <Col xs={24} lg={16}>
          <Card title="Recent Errors">
            <Table
              dataSource={h.recent_errors ?? []}
              columns={errorColumns}
              rowKey={(r, i) => `${r.timestamp}-${r.endpoint}-${i}`}
              pagination={{ pageSize: 10, showSizeChanger: false }}
              size="small"
              locale={{ emptyText: 'No recent errors' }}
            />
          </Card>
        </Col>

        {/* Runtime Info */}
        <Col xs={24} lg={8}>
          <Card title="Runtime Info">
            <p><strong>Go Version:</strong> {h.go_version ?? '-'}</p>
            <p><strong>Memory Total:</strong> {formatBytes(h.memory_total ?? 0)}</p>
            <p><strong>Memory Usage:</strong> {memoryPercent}%</p>
            <p><strong>DB Connections:</strong> {h.db_connections ?? 0}</p>
            <p><strong>Goroutines:</strong> {h.goroutines ?? 0}</p>
            {autoRefresh && (
              <p><Text type="secondary">Auto-refreshes every 30 seconds</Text></p>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
