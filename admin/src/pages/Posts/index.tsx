import { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Input, Select, Space, Button, Tag, message, Modal, Tooltip, Popconfirm } from 'antd';
import { SearchOutlined, DeleteOutlined, EyeOutlined, PlayCircleOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminPost } from '../../api/admin';
import { formatDate } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'hidden', label: 'Hidden' },
  { value: 'removed', label: 'Removed' },
];

const statusColor = (status: string): string => {
  if (status === 'active') return 'green';
  if (status === 'hidden') return 'orange';
  if (status === 'removed') return 'red';
  return 'default';
};

export default function PostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [captionModal, setCaptionModal] = useState<AdminPost | null>(null);
  const pageSize = 20;

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listPosts({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
        status: statusFilter || undefined,
      });
      const d = data as any;
      setPosts(d.posts ?? []);
      setTotal(d.total ?? 0);
    } catch {
      message.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  usePolling(fetchPosts, 30000);

  const handleStatusChange = async (post: AdminPost, newStatus: string) => {
    try {
      await adminApi.updatePostStatus(post.id, newStatus);
      message.success(`Post set to ${newStatus}`);
      fetchPosts();
    } catch {
      message.error('Failed to update post status');
    }
  };

  const handleDelete = async (post: AdminPost) => {
    try {
      await adminApi.deletePost(post.id);
      message.success('Post deleted');
      fetchPosts();
    } catch {
      message.error('Failed to delete post');
    }
  };

  const columns: ColumnsType<AdminPost> = [
    {
      title: 'User',
      dataIndex: 'user_email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Caption',
      dataIndex: 'caption',
      ellipsis: true,
      render: (caption: string) => (
        <Space>
          <PlayCircleOutlined />
          {caption.length > 80 ? `${caption.slice(0, 80)}...` : caption}
        </Space>
      ),
    },
    {
      title: 'Tags',
      dataIndex: 'tags',
      width: 200,
      render: (tags: string[]) => (
        <Space size={[0, 4]} wrap>
          {(tags || []).slice(0, 3).map((tag) => (
            <Tag key={tag} color="blue">{tag}</Tag>
          ))}
          {(tags || []).length > 3 && <Tag>+{tags.length - 3}</Tag>}
        </Space>
      ),
    },
    {
      title: 'Views',
      dataIndex: 'views',
      width: 80,
    },
    {
      title: 'Likes',
      dataIndex: 'likes',
      width: 80,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColor(status)}>{status}</Tag>,
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
      width: 200,
      render: (_, r) => (
        <Space>
          <Tooltip title="View Caption">
            <Button icon={<EyeOutlined />} size="small" onClick={() => setCaptionModal(r)} />
          </Tooltip>
          {r.status !== 'active' && (
            <Tooltip title="Set Active">
              <Button size="small" onClick={() => handleStatusChange(r, 'active')}>Active</Button>
            </Tooltip>
          )}
          {r.status !== 'hidden' && (
            <Tooltip title="Hide">
              <Button size="small" onClick={() => handleStatusChange(r, 'hidden')}>Hide</Button>
            </Tooltip>
          )}
          {r.status !== 'removed' && (
            <Tooltip title="Remove">
              <Button size="small" danger onClick={() => handleStatusChange(r, 'removed')}>Remove</Button>
            </Tooltip>
          )}
          <Popconfirm
            title="Delete this post permanently?"
            onConfirm={() => handleDelete(r)}
            okText="Delete"
            okType="danger"
          >
            <Tooltip title="Delete">
              <Button icon={<DeleteOutlined />} size="small" danger />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>Post Moderation</Title>
        <Space wrap>
          <Input
            placeholder="Search by caption or email"
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            allowClear
          />
          <Select
            style={{ width: 130 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={STATUS_OPTIONS}
          />
        </Space>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={posts}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `${t} posts`,
        }}
        scroll={{ x: 1200 }}
      />

      <Modal
        title="Post Caption"
        open={!!captionModal}
        onCancel={() => setCaptionModal(null)}
        footer={null}
      >
        {captionModal && (
          <div>
            <p><strong>User:</strong> {captionModal.user_email}</p>
            <p><strong>Caption:</strong></p>
            <p style={{ whiteSpace: 'pre-wrap' }}>{captionModal.caption}</p>
            <p><strong>Tags:</strong> {(captionModal.tags || []).join(', ') || 'None'}</p>
            <p><strong>Status:</strong> <Tag color={statusColor(captionModal.status)}>{captionModal.status}</Tag></p>
          </div>
        )}
      </Modal>
    </div>
  );
}
