import { useEffect, useState, useCallback } from 'react';
import { Table, Typography, Input, Space, Button, message, Modal, Tooltip } from 'antd';
import { SearchOutlined, DeleteOutlined, CommentOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { adminApi, type AdminComment } from '../../api/admin';
import { formatDate } from '../../utils/format';
import { usePolling } from '../../hooks/usePolling';

const { Title } = Typography;

export default function CommentsPage() {
  const [comments, setComments] = useState<AdminComment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const pageSize = 20;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await adminApi.listComments({
        limit: pageSize,
        offset: (page - 1) * pageSize,
        search: search || undefined,
      });
      const d = data as any;
      setComments(d.comments ?? []);
      setTotal(d.total ?? 0);
    } catch {
      message.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchComments(); }, [fetchComments]);
  usePolling(fetchComments, 30000);

  const handleDelete = (comment: AdminComment) => {
    Modal.confirm({
      title: 'Delete this comment?',
      content: `Comment by ${comment.user_email} on "${comment.file_name}". This action is permanent.`,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await adminApi.deleteComment(comment.id);
          message.success('Comment deleted');
          fetchComments();
        } catch {
          message.error('Failed to delete comment');
        }
      },
    });
  };

  const columns: ColumnsType<AdminComment> = [
    {
      title: 'Content',
      dataIndex: 'content',
      ellipsis: true,
      render: (content: string) => (
        <Space>
          <CommentOutlined />
          {content.length > 100 ? `${content.slice(0, 100)}...` : content}
        </Space>
      ),
    },
    {
      title: 'File Name',
      dataIndex: 'file_name',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'User Email',
      dataIndex: 'user_email',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'Created At',
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
        <Title level={4} style={{ margin: 0 }}>Comment Moderation</Title>
        <Space wrap>
          <Input
            placeholder="Search by content or email"
            prefix={<SearchOutlined />}
            style={{ width: 280 }}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            allowClear
          />
        </Space>
      </Space>

      <Table
        rowKey="id"
        columns={columns}
        dataSource={comments}
        loading={loading}
        size="small"
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: setPage,
          showSizeChanger: false,
          showTotal: (t) => `${t} comments`,
        }}
        scroll={{ x: 900 }}
      />
    </div>
  );
}
