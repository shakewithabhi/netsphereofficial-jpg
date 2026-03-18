import { useState } from 'react';
import { Card, Typography, Button, Space, Row, Col, message, Spin } from 'antd';
import {
  DownloadOutlined, UserOutlined, FileOutlined, PlayCircleOutlined,
  BellOutlined, DollarOutlined, BarChartOutlined,
} from '@ant-design/icons';
import { adminApi } from '../../api/admin';

const { Title, Text } = Typography;

interface ExportItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  format: string;
  exportFn: () => Promise<any>;
}

const downloadBlob = (data: any, filename: string) => {
  const url = window.URL.createObjectURL(new Blob([data]));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

const dateStr = () => new Date().toISOString().split('T')[0];

const EXPORTS: ExportItem[] = [
  {
    key: 'users',
    label: 'Export Users',
    icon: <UserOutlined />,
    description: 'All user accounts with plans, storage usage, and status',
    format: 'CSV',
    exportFn: () => adminApi.exportUsers(),
  },
  {
    key: 'files',
    label: 'Export Files',
    icon: <FileOutlined />,
    description: 'All files with owner, type, size, and status information',
    format: 'CSV',
    exportFn: () => adminApi.exportFiles(),
  },
  {
    key: 'posts',
    label: 'Export Posts',
    icon: <PlayCircleOutlined />,
    description: 'All posts with captions, tags, views, likes, and status',
    format: 'CSV',
    exportFn: () => adminApi.exportPosts(),
  },
  {
    key: 'notifications',
    label: 'Export Notifications',
    icon: <BellOutlined />,
    description: 'All notifications with type, read status, and recipients',
    format: 'CSV',
    exportFn: () => adminApi.exportNotifications(),
  },
  {
    key: 'revenue',
    label: 'Export Revenue',
    icon: <DollarOutlined />,
    description: 'Revenue data with plan distribution and plan changes',
    format: 'CSV',
    exportFn: () => adminApi.exportRevenue(),
  },
  {
    key: 'analytics',
    label: 'Export Full Analytics',
    icon: <BarChartOutlined />,
    description: 'Complete analytics snapshot including all platform metrics',
    format: 'JSON',
    exportFn: () => adminApi.exportAnalytics(),
  },
];

export default function ReportsPage() {
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [lastExports, setLastExports] = useState<Record<string, string>>({});

  const handleExport = async (item: ExportItem) => {
    setLoadingKey(item.key);
    try {
      const res = await item.exportFn();
      const ext = item.format === 'JSON' ? 'json' : 'csv';
      downloadBlob(res.data, `${item.key}_export_${dateStr()}.${ext}`);
      setLastExports((prev) => ({ ...prev, [item.key]: new Date().toLocaleString() }));
      message.success(`${item.label} completed`);
    } catch {
      message.error(`Failed to export ${item.key}`);
    } finally {
      setLoadingKey(null);
    }
  };

  return (
    <div>
      <Title level={4}><DownloadOutlined /> Export Reports</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Download platform data as CSV or JSON files for offline analysis and record keeping.
      </Text>

      <Row gutter={[16, 16]}>
        {EXPORTS.map((item) => (
          <Col xs={24} sm={12} lg={8} key={item.key}>
            <Card
              hoverable
              style={{ height: '100%' }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span style={{ fontSize: 24, color: '#1677ff' }}>{item.icon}</span>
                  <Title level={5} style={{ margin: 0 }}>{item.label}</Title>
                </Space>
                <Text type="secondary">{item.description}</Text>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>Format: {item.format}</Text>
                </div>
                {lastExports[item.key] && (
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Last exported: {lastExports[item.key]}
                  </Text>
                )}
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={() => handleExport(item)}
                  loading={loadingKey === item.key}
                  block
                >
                  {loadingKey === item.key ? 'Exporting...' : 'Download'}
                </Button>
              </Space>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
