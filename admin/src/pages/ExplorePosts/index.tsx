import { useEffect, useState, useCallback } from 'react';
import {
  Table, Typography, Input, Select, Space, Button, Tag, message,
  Modal, Tooltip, Popconfirm, Image, Checkbox,
} from 'antd';
import {
  SearchOutlined, DeleteOutlined, EyeOutlined, FlagOutlined,
  CheckCircleOutlined, PlayCircleOutlined, PictureOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminPost } from '../../api/admin';
import { formatDate } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title, Text } = Typography;

const STATUS_OPTIONS = [
  { value: '', label: 'All Status' },
  { value: 'active', label: 'Active' },
  { value: 'hidden', label: 'Flagged / Hidden' },
  { value: 'removed', label: 'Removed' },
];

const MEDIA_TYPE_OPTIONS = [
  { value: '', label: 'All Media' },
  { value: 'video', label: 'Video' },
  { value: 'image', label: 'Image' },
];

const statusColor = (status: string): string => {
  if (status === 'active') return 'green';
  if (status === 'hidden') return 'orange';
  if (status === 'removed') return 'red';
  return 'default';
};

const statusLabel = (status: string): string => {
  if (status === 'hidden') return 'Flagged';
  return status.charAt(0).toUpperCase() + status.slice(1);
};

export default function ExplorePostsPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [mediaFilter, setMediaFilter] = useState('');
  const [previewPost, setPreviewPost] = useState<AdminPost | null>(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
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
      let results: AdminPost[] = d.posts ?? [];
      // Client-side media type filter (since backend may not support it)
      if (mediaFilter) {
        results = results.filter((p: any) => {
          const tags = (p.tags || []).map((t: string) => t.toLowerCase());
          const caption = (p.caption || '').toLowerCase();
          if (mediaFilter === 'video') return tags.includes('video') || caption.includes('video');
          if (mediaFilter === 'image') return tags.includes('image') || tags.includes('photo') || caption.includes('image');
          return true;
        });
      }
      setPosts(results);
      setTotal(d.total ?? 0);
    } catch {
      setPosts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, mediaFilter]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);
  usePolling(fetchPosts, 30000);

  const handleStatusChange = async (post: AdminPost, newStatus: string) => {
    try {
      await adminApi.updatePostStatus(post.id, newStatus);
      message.success(`Post ${newStatus === 'active' ? 'approved' : newStatus === 'hidden' ? 'flagged' : 'removed'}`);
      fetchPosts();
    } catch {
      message.error('Failed to update post status');
    }
  };

  const handleDelete = async (post: AdminPost) => {
    try {
      await adminApi.deletePost(post.id);
      message.success('Post deleted permanently');
      fetchPosts();
    } catch {
      message.error('Failed to delete post');
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('No posts selected');
      return;
    }
    setBulkLoading(true);
    try {
      await adminApi.bulkPostAction(selectedRowKeys as string[], action);
      message.success(`${selectedRowKeys.length} post(s) ${action === 'approve' ? 'approved' : 'removed'}`);
      setSelectedRowKeys([]);
      fetchPosts();
    } catch {
      // Fallback: do individual updates
      let successCount = 0;
      const newStatus = action === 'approve' ? 'active' : 'removed';
      for (const id of selectedRowKeys) {
        try {
          await adminApi.updatePostStatus(id as string, newStatus);
          successCount++;
        } catch { /* skip */ }
      }
      if (successCount > 0) {
        message.success(`${successCount} post(s) ${action === 'approve' ? 'approved' : 'removed'}`);
        setSelectedRowKeys([]);
        fetchPosts();
      } else {
        message.error('Bulk action failed');
      }
    } finally {
      setBulkLoading(false);
    }
  };

  const guessMediaType = (post: AdminPost): 'video' | 'image' | 'unknown' => {
    const tags = ((post as any).tags || []).map((t: string) => t.toLowerCase());
    const caption = ((post as any).caption || '').toLowerCase();
    if (tags.includes('video') || caption.includes('video') || caption.includes('reel')) return 'video';
    if (tags.includes('image') || tags.includes('photo') || caption.includes('image') || caption.includes('photo')) return 'image';
    return 'unknown';
  };

  const columns: ColumnsType<AdminPost> = [
    {
      title: 'ID',
      dataIndex: 'id',
      width: 90,
      ellipsis: true,
      render: (id: string) => <Text copyable={{ text: id }} style={{ fontSize: 12 }}>{id.slice(0, 8)}...</Text>,
    },
    {
      title: 'Creator',
      dataIndex: 'user_email',
      width: 180,
      ellipsis: true,
    },
    {
      title: 'Caption',
      dataIndex: 'caption',
      ellipsis: true,
      render: (caption: string) => caption.length > 60 ? `${caption.slice(0, 60)}...` : caption,
    },
    {
      title: 'Media',
      key: 'media_type',
      width: 90,
      render: (_, r) => {
        const type = guessMediaType(r);
        if (type === 'video') return <Tag icon={<PlayCircleOutlined />} color="purple">Video</Tag>;
        if (type === 'image') return <Tag icon={<PictureOutlined />} color="cyan">Image</Tag>;
        return <Tag>Unknown</Tag>;
      },
    },
    {
      title: 'Views',
      dataIndex: 'views',
      width: 80,
      sorter: (a, b) => (a.views ?? 0) - (b.views ?? 0),
    },
    {
      title: 'Likes',
      dataIndex: 'likes',
      width: 80,
      sorter: (a, b) => (a.likes ?? 0) - (b.likes ?? 0),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      width: 100,
      render: (status: string) => <Tag color={statusColor(status)}>{statusLabel(status)}</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      width: 160,
      render: (v: string) => formatDate(v),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      render: (_, r) => (
        <Space size={4}>
          <Tooltip title="Preview">
            <Button icon={<EyeOutlined />} size="small" onClick={() => setPreviewPost(r)} />
          </Tooltip>
          {r.status !== 'hidden' && (
            <Tooltip title="Flag">
              <Button icon={<FlagOutlined />} size="small" style={{ color: '#faad14' }} onClick={() => handleStatusChange(r, 'hidden')} />
            </Tooltip>
          )}
          {r.status !== 'removed' && (
            <Tooltip title="Remove">
              <Button icon={<DeleteOutlined />} size="small" danger onClick={() => handleStatusChange(r, 'removed')} />
            </Tooltip>
          )}
          {r.status !== 'active' && (
            <Tooltip title="Approve">
              <Button icon={<CheckCircleOutlined />} size="small" style={{ color: '#52c41a' }} onClick={() => handleStatusChange(r, 'active')} />
            </Tooltip>
          )}
          <Popconfirm title="Delete permanently?" onConfirm={() => handleDelete(r)} okText="Delete" okType="danger">
            <Tooltip title="Delete Permanently">
              <Button icon={<ExclamationCircleOutlined />} size="small" danger type="text" />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      <Space style={{ width: '100%', justifyContent: 'space-between', marginBottom: 16 }} wrap>
        <Title level={4} style={{ margin: 0 }}>Post / Explore Moderation</Title>
        <Space wrap>
          <Input
            placeholder="Search by caption or creator"
            prefix={<SearchOutlined />}
            style={{ width: 260 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            allowClear
          />
          <Select
            style={{ width: 160 }}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            options={STATUS_OPTIONS}
          />
          <Select
            style={{ width: 130 }}
            value={mediaFilter}
            onChange={(v) => { setMediaFilter(v); setPage(1); }}
            options={MEDIA_TYPE_OPTIONS}
          />
        </Space>
      </Space>

      {selectedRowKeys.length > 0 && (
        <Space style={{ marginBottom: 12 }}>
          <Text strong>{selectedRowKeys.length} selected</Text>
          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            loading={bulkLoading}
            onClick={() => handleBulkAction('approve')}
          >
            Approve Selected
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            loading={bulkLoading}
            onClick={() => handleBulkAction('remove')}
          >
            Remove Selected
          </Button>
          <Button type="link" onClick={() => setSelectedRowKeys([])}>Clear</Button>
        </Space>
      )}

      <Table
        rowKey="id"
        rowSelection={rowSelection}
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
        scroll={{ x: 1300 }}
      />

      <Modal
        title="Post Preview"
        open={!!previewPost}
        onCancel={() => setPreviewPost(null)}
        footer={
          previewPost ? (
            <Space>
              {previewPost.status !== 'active' && (
                <Button type="primary" icon={<CheckCircleOutlined />} onClick={() => { handleStatusChange(previewPost, 'active'); setPreviewPost(null); }}>
                  Approve
                </Button>
              )}
              {previewPost.status !== 'hidden' && (
                <Button icon={<FlagOutlined />} onClick={() => { handleStatusChange(previewPost, 'hidden'); setPreviewPost(null); }}>
                  Flag
                </Button>
              )}
              {previewPost.status !== 'removed' && (
                <Button danger icon={<DeleteOutlined />} onClick={() => { handleStatusChange(previewPost, 'removed'); setPreviewPost(null); }}>
                  Remove
                </Button>
              )}
              <Button onClick={() => setPreviewPost(null)}>Close</Button>
            </Space>
          ) : null
        }
        width={600}
      >
        {previewPost && (
          <div>
            <p><strong>Post ID:</strong> <Text copyable>{previewPost.id}</Text></p>
            <p><strong>Creator:</strong> {previewPost.user_email}</p>
            <p><strong>Media Type:</strong> {guessMediaType(previewPost) === 'video' ? 'Video' : guessMediaType(previewPost) === 'image' ? 'Image' : 'Unknown'}</p>
            <p><strong>Caption:</strong></p>
            <p style={{ whiteSpace: 'pre-wrap', background: '#fafafa', padding: 12, borderRadius: 6 }}>{previewPost.caption}</p>
            <p><strong>Tags:</strong> {(previewPost.tags || []).map((t) => <Tag key={t} color="blue" style={{ marginBottom: 4 }}>{t}</Tag>)}</p>
            <Space size={24}>
              <span><strong>Views:</strong> {previewPost.views}</span>
              <span><strong>Likes:</strong> {previewPost.likes}</span>
            </Space>
            <p style={{ marginTop: 8 }}><strong>Status:</strong> <Tag color={statusColor(previewPost.status)}>{statusLabel(previewPost.status)}</Tag></p>
            <p><strong>Created:</strong> {formatDate(previewPost.created_at)}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
