import { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Input, Select, Space, Button, Tag, message, Modal, Tooltip } from 'antd';
import { SearchOutlined, DeleteOutlined, FileOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminFile } from '../../api/admin';
import { formatBytes, formatDate } from '../../utils/format';
import { exportToCSV } from '../../utils/export';
import { usePolling } from '../../hooks/usePolling';
import { DownloadOutlined } from '@ant-design/icons';

const { Title } = Typography;

const MIME_FILTERS = [
  { value: '', label: 'All Types' },
  { value: 'image/', label: 'Images' },
  { value: 'video/', label: 'Videos' },
  { value: 'audio/', label: 'Audio' },
  { value: 'application/pdf', label: 'PDFs' },
  { value: 'text/', label: 'Text' },
];

const mimeColor = (mime: string): string => {
  if (mime.startsWith('image/')) return 'blue';
  if (mime.startsWith('video/')) return 'purple';
  if (mime.startsWith('audio/')) return 'cyan';
  if (mime.includes('pdf')) return 'red';
  if (mime.startsWith('text/')) return 'green';
  return 'default';
};

export default function FilesPage() {
  const [files, setFiles] = useState<AdminFile[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [mimeFilter, setMimeFilter] = useState('');
  const pageSize = 20;

  const fetchFiles = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listFiles({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
        user_id: userFilter || undefined,
        mime: mimeFilter || undefined,
      });
      const d = data as any;
      setFiles(d.files ?? []);
      setTotal(d.total ?? 0);
    } catch {
      message.error('Failed to load files');
    } finally {
      setLoading(false);
    }
  }, [page, search, userFilter, mimeFilter]);

  useEffect(() => { fetchFiles(); }, [fetchFiles]);
  usePolling(fetchFiles, 30000);

  const handleDelete = (file: AdminFile) => {
    Modal.confirm({
      title: `Delete "${file.name}"?`,
      content: `This file belongs to ${file.user_email}. This action is permanent.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await adminApi.deleteFile(file.id);
          message.success('File deleted');
          fetchFiles();
        } catch {
          message.error('Failed to delete file');
        }
      },
    });
  };

  const handleExportCSV = () => {
    const data = files.map((f) => ({
      name: f.name,
      owner: f.user_email,
      type: f.mime_type,
      size: formatBytes(f.size),
      trashed: f.trashed_at ? 'Yes' : 'No',
      created: f.created_at,
    }));
    exportToCSV(data, 'bytebox-files');
    message.success('Files exported');
  };

  const columns: ColumnsType<AdminFile> = [
    {
      title: 'Name',
      dataIndex: 'name',
      ellipsis: true,
      render: (name: string) => (
        <Space>
          <FileOutlined />
          {name}
        </Space>
      ),
    },
    {
      title: 'Owner',
      dataIndex: 'user_email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Type',
      dataIndex: 'mime_type',
      width: 140,
      render: (v: string) => <Tag color={mimeColor(v)}>{v.split('/').pop()}</Tag>,
    },
    {
      title: 'Size',
      dataIndex: 'size',
      width: 100,
      render: (v: number) => formatBytes(v),
    },
    {
      title: 'Status',
      key: 'status',
      width: 90,
      render: (_, r) => r.trashed_at
        ? <Tag color="red">Trashed</Tag>
        : <Tag color="green">Active</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 180,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 80,
      render: (_, r) => (
        <Tooltip title="Delete">
          <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleDelete(r)} />
        </Tooltip>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>File Management</Title>
        <Space wrap>
          <Input
            placeholder="Search by filename"
            prefix={<SearchOutlined />}
            style={{ width: 220 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            allowClear
          />
          <Input.Search
            placeholder="Filter by user ID"
            style={{ width: 200 }}
            allowClear
            onSearch={(v) => { setUserFilter(v.trim()); setPage(1); }}
          />
          <Select
            style={{ width: 130 }}
            value={mimeFilter}
            onChange={(v) => { setMimeFilter(v); setPage(1); }}
            options={MIME_FILTERS}
          />
          <Button icon={<DownloadOutlined />} onClick={handleExportCSV}>Export CSV</Button>
        </Space>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={files}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `${t} files`,
        }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}
