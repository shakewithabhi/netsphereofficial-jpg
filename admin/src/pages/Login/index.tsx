import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message, Space } from 'antd';
import { LockOutlined, MailOutlined, CloudOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const { data: res } = await authApi.login(values);
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      setUser(res.data.user);

      if (!res.data.user.is_admin) {
        message.error('Access denied. Admin privileges required.');
        localStorage.clear();
        return;
      }

      message.success('Welcome back!');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 400, boxShadow: '0 2px 8px rgba(0,0,0,0.09)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <CloudOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            <Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>ByteBox Admin</Title>
            <Text type="secondary">Sign in to manage your platform</Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, message: 'Enter your password' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign In
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  );
}
