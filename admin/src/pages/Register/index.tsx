import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message, Space, Alert } from 'antd';
import { LockOutlined, MailOutlined, CloudOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth';

const { Title, Text } = Typography;

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const onFinish = async (values: { display_name: string; email: string; password: string; confirm_password: string }) => {
    if (values.password !== values.confirm_password) {
      message.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const { data: res } = await authApi.register({
        email: values.email,
        password: values.password,
        display_name: values.display_name,
      });
      localStorage.setItem('access_token', res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      setUser(res.data.user);

      message.success('Account created successfully!');
      navigate('/');
    } catch (err: any) {
      message.error(err.response?.data?.error?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f2f5' }}>
      <Card style={{ width: 420, boxShadow: '0 2px 8px rgba(0,0,0,0.09)' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <CloudOutlined style={{ fontSize: 48, color: '#1677ff' }} />
            <Title level={3} style={{ marginTop: 8, marginBottom: 0 }}>Create Account</Title>
            <Text type="secondary">Sign up for ByteBox</Text>
          </div>

          <Form layout="vertical" onFinish={onFinish} autoComplete="off">
            <Form.Item name="display_name" rules={[{ max: 100, message: 'Max 100 characters' }]}>
              <Input prefix={<UserOutlined />} placeholder="Display Name (optional)" size="large" />
            </Form.Item>
            <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Enter a valid email' }]}>
              <Input prefix={<MailOutlined />} placeholder="Email" size="large" />
            </Form.Item>
            <Form.Item name="password" rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="Password" size="large" />
            </Form.Item>
            <Form.Item
              name="confirm_password"
              dependencies={['password']}
              rules={[
                { required: true, message: 'Confirm your password' },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue('password') === value) return Promise.resolve();
                    return Promise.reject(new Error('Passwords do not match'));
                  },
                }),
              ]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Confirm Password" size="large" />
            </Form.Item>

            <Alert
              type="info"
              showIcon
              style={{ textAlign: 'left', marginBottom: 16 }}
              message="Password must contain at least 1 uppercase, 1 lowercase, 1 digit, and 1 special character."
            />

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} block size="large">
                Sign Up
              </Button>
            </Form.Item>
          </Form>

          <Text>
            Already have an account? <Link to="/login">Sign In</Link>
          </Text>
        </Space>
      </Card>
    </div>
  );
}
