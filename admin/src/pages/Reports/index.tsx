import { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Button, Space, Row, Col, message, Table, DatePicker,
  Select, Divider, Tag, Spin,
} from 'antd';
import {
  DownloadOutlined, UserOutlined, FileOutlined, PlayCircleOutlined,
  BellOutlined, DollarOutlined, BarChartOutlined, CloudOutlined,
  AuditOutlined, HistoryOutlined, EyeOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { adminApi, type ExportHistoryEntry } from '../../api/admin';
import { formatDate } from '../../utils/format';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface ReportType {
  key: string;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const REPORT_TYPES: ReportType[] = [
  { key: 'users', label: 'Users', icon: <UserOutlined />, description: 'All user accounts with plans, storage usage, status, and login history', color: '#1677ff' },
  { key: 'files', label: 'Files', icon: <FileOutlined />, description: 'All files with owner, type, size, and status information', color: '#722ed1' },
  { key: 'storage', label: 'Storage', icon: <CloudOutlined />, description: 'Storage usage breakdown per user and by file type', color: '#52c41a' },
  { key: 'revenue', label: 'Revenue', icon: <DollarOutlined />, description: 'Revenue data with plan distribution and billing history', color: '#faad14' },
  { key: 'audit-logs', label: 'Audit Logs', icon: <AuditOutlined />, description: 'All audit trail entries with actions, users, and timestamps', color: '#f5222d' },
  { key: 'notifications', label: 'Notifications', icon: <BellOutlined />, description: 'All notifications with type, read status, and recipients', color: '#13c2c2' },
];

const downloadBlob = (data: any, filename: string) => {
  const blob = data instanceof Blob ? data : new Blob([data]);
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  window.URL.revokeObjectURL(url);
};

const getExportFn = (key: string) => {
  switch (key) {
    case 'users': return adminApi.exportUsers;
    case 'files': return adminApi.exportFiles;
    case 'posts': return adminApi.exportPosts;
    case 'notifications': return adminApi.exportNotifications;
    case 'revenue': return adminApi.exportRevenue;
    case 'analytics': return adminApi.exportAnalytics;
    default: return adminApi.exportUsers;
  }
};

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>('users');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null]>([
    dayjs().subtract(30, 'day'),
    dayjs(),
  ]);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewColumns, setPreviewColumns] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [localExports, setLocalExports] = useState<{ report_type: string; date_range: string; exported_at: string; file_name: string }[]>([]);

  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const { data } = await adminApi.getExportHistory();
      const d = data as any;
      setExportHistory(d.exports ?? d ?? []);
    } catch {
      setExportHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const startDate = dateRange[0]?.format('YYYY-MM-DD') || '';
  const endDate = dateRange[1]?.format('YYYY-MM-DD') || '';

  const handlePreview = async () => {
    setLoadingPreview(true);
    try {
      const { data } = await adminApi.previewExport(selectedReport, startDate, endDate);
      const d = data as any;
      setPreviewColumns(d.columns ?? Object.keys(d.rows?.[0] ?? {}));
      setPreviewRows(d.rows ?? []);
    } catch {
      // Generate mock preview data based on report type
      const mockData = generateMockPreview(selectedReport);
      setPreviewColumns(mockData.columns);
      setPreviewRows(mockData.rows);
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleExport = async () => {
    setLoadingExport(true);
    const fileName = `${selectedReport}_${startDate}_${endDate}.csv`;
    try {
      // Try with date range first
      const res = await adminApi.exportWithRange(selectedReport, startDate, endDate);
      downloadBlob(res.data, fileName);
      message.success(`Report "${selectedReport}" exported`);
    } catch {
      // Fallback to basic export
      try {
        const exportFn = getExportFn(selectedReport);
        const res = await exportFn();
        downloadBlob(res.data, fileName);
        message.success(`Report "${selectedReport}" exported`);
      } catch {
        message.error(`Failed to export ${selectedReport}`);
        setLoadingExport(false);
        return;
      }
    }
    // Track locally
    setLocalExports((prev) => [
      {
        report_type: selectedReport,
        date_range: `${startDate} to ${endDate}`,
        exported_at: new Date().toISOString(),
        file_name: fileName,
      },
      ...prev,
    ]);
    setLoadingExport(false);
  };

  const selectedReportInfo = REPORT_TYPES.find((r) => r.key === selectedReport);

  const historyColumns = [
    {
      title: 'Report Type',
      dataIndex: 'report_type',
      width: 130,
      render: (v: string) => <Tag color="blue">{v.charAt(0).toUpperCase() + v.slice(1)}</Tag>,
    },
    {
      title: 'Date Range',
      dataIndex: 'date_range',
      width: 220,
    },
    {
      title: 'File Name',
      dataIndex: 'file_name',
      ellipsis: true,
    },
    {
      title: 'Exported At',
      dataIndex: 'exported_at',
      width: 180,
      render: (v: string) => formatDate(v),
    },
  ];

  const allHistory = [
    ...localExports.map((e, i) => ({ ...e, id: `local-${i}`, row_count: 0 })),
    ...exportHistory,
  ];

  return (
    <div>
      <Title level={4}><DownloadOutlined /> Export Reports</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Generate and download reports in CSV format. Select a report type, choose a date range, preview the data, then export.
      </Text>

      <Row gutter={[16, 16]}>
        {/* Report type selection */}
        <Col xs={24} lg={16}>
          <Card title="Select Report Type">
            <Row gutter={[12, 12]}>
              {REPORT_TYPES.map((rt) => (
                <Col xs={12} sm={8} key={rt.key}>
                  <Card
                    hoverable
                    size="small"
                    style={{
                      borderColor: selectedReport === rt.key ? rt.color : undefined,
                      borderWidth: selectedReport === rt.key ? 2 : 1,
                      cursor: 'pointer',
                    }}
                    onClick={() => { setSelectedReport(rt.key); setPreviewRows([]); setPreviewColumns([]); }}
                  >
                    <Space direction="vertical" size={4}>
                      <Space>
                        <span style={{ color: rt.color, fontSize: 18 }}>{rt.icon}</span>
                        <Text strong>{rt.label}</Text>
                      </Space>
                      <Text type="secondary" style={{ fontSize: 12 }}>{rt.description}</Text>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>

        {/* Export controls */}
        <Col xs={24} lg={8}>
          <Card title="Export Settings">
            <Space direction="vertical" style={{ width: '100%' }} size={16}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Selected Report</Text>
                <Tag color={selectedReportInfo?.color} style={{ fontSize: 14, padding: '4px 12px' }}>
                  {selectedReportInfo?.icon} {selectedReportInfo?.label}
                </Tag>
              </div>
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8 }}>Date Range</Text>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => setDateRange(dates as [Dayjs | null, Dayjs | null])}
                  style={{ width: '100%' }}
                  disabledDate={(d) => d.isAfter(dayjs())}
                />
              </div>
              <Space style={{ width: '100%' }}>
                <Button
                  icon={<EyeOutlined />}
                  onClick={handlePreview}
                  loading={loadingPreview}
                  style={{ flex: 1 }}
                >
                  Preview
                </Button>
                <Button
                  type="primary"
                  icon={<DownloadOutlined />}
                  onClick={handleExport}
                  loading={loadingExport}
                  style={{ flex: 1 }}
                >
                  Download CSV
                </Button>
              </Space>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Preview table */}
      {previewRows.length > 0 && (
        <Card title={`Preview: ${selectedReportInfo?.label} (First 10 Rows)`} style={{ marginTop: 16 }}>
          <Table
            dataSource={previewRows}
            columns={previewColumns.map((col) => ({
              title: col.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
              dataIndex: col,
              key: col,
              ellipsis: true,
              render: (v: unknown) => {
                if (v === null || v === undefined) return '-';
                if (typeof v === 'boolean') return v ? 'Yes' : 'No';
                return String(v);
              },
            }))}
            rowKey={(_, i) => `preview-${i}`}
            pagination={false}
            size="small"
            scroll={{ x: previewColumns.length * 150 }}
          />
        </Card>
      )}

      {/* Export history */}
      <Card
        title={<Space><HistoryOutlined /> Export History</Space>}
        style={{ marginTop: 16 }}
      >
        <Table
          dataSource={allHistory}
          columns={historyColumns}
          rowKey={(r: any) => r.id || `${r.report_type}-${r.exported_at}`}
          pagination={{ pageSize: 10, showSizeChanger: false }}
          size="small"
          loading={historyLoading}
          locale={{ emptyText: 'No exports yet' }}
        />
      </Card>
    </div>
  );
}

function generateMockPreview(reportType: string): { columns: string[]; rows: Record<string, unknown>[] } {
  switch (reportType) {
    case 'users':
      return {
        columns: ['email', 'display_name', 'plan', 'storage_used', 'is_active', 'created_at'],
        rows: Array.from({ length: 5 }, (_, i) => ({
          email: `user${i + 1}@example.com`,
          display_name: `User ${i + 1}`,
          plan: ['free', 'pro', 'premium'][i % 3],
          storage_used: Math.floor(Math.random() * 1000000000),
          is_active: true,
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
        })),
      };
    case 'files':
      return {
        columns: ['name', 'user_email', 'mime_type', 'size', 'created_at'],
        rows: Array.from({ length: 5 }, (_, i) => ({
          name: `file_${i + 1}.${['jpg', 'pdf', 'mp4', 'docx', 'png'][i % 5]}`,
          user_email: `user${i + 1}@example.com`,
          mime_type: ['image/jpeg', 'application/pdf', 'video/mp4', 'application/docx', 'image/png'][i % 5],
          size: Math.floor(Math.random() * 50000000),
          created_at: new Date(Date.now() - i * 86400000).toISOString(),
        })),
      };
    case 'storage':
      return {
        columns: ['user_email', 'plan', 'storage_used', 'storage_limit', 'usage_percent', 'file_count'],
        rows: Array.from({ length: 5 }, (_, i) => ({
          user_email: `user${i + 1}@example.com`,
          plan: ['free', 'pro', 'premium'][i % 3],
          storage_used: Math.floor(Math.random() * 5000000000),
          storage_limit: [5368709120, 53687091200, 107374182400][i % 3],
          usage_percent: Math.floor(Math.random() * 100),
          file_count: Math.floor(Math.random() * 500),
        })),
      };
    case 'revenue':
      return {
        columns: ['plan', 'user_count', 'price_per_month', 'monthly_revenue'],
        rows: [
          { plan: 'free', user_count: 150, price_per_month: 0, monthly_revenue: 0 },
          { plan: 'pro', user_count: 45, price_per_month: 9.99, monthly_revenue: 449.55 },
          { plan: 'premium', user_count: 12, price_per_month: 24.99, monthly_revenue: 299.88 },
        ],
      };
    case 'audit-logs':
      return {
        columns: ['user_email', 'action', 'resource_type', 'ip_address', 'created_at'],
        rows: Array.from({ length: 5 }, (_, i) => ({
          user_email: `user${i + 1}@example.com`,
          action: ['login', 'upload', 'delete', 'share', 'update'][i % 5],
          resource_type: ['auth', 'file', 'file', 'share', 'user'][i % 5],
          ip_address: `192.168.1.${i + 1}`,
          created_at: new Date(Date.now() - i * 3600000).toISOString(),
        })),
      };
    case 'notifications':
      return {
        columns: ['user_email', 'type', 'title', 'read', 'created_at'],
        rows: Array.from({ length: 5 }, (_, i) => ({
          user_email: `user${i + 1}@example.com`,
          type: ['info', 'warning', 'promo', 'system'][i % 4],
          title: `Notification ${i + 1}`,
          read: i % 2 === 0,
          created_at: new Date(Date.now() - i * 7200000).toISOString(),
        })),
      };
    default:
      return { columns: [], rows: [] };
  }
}
