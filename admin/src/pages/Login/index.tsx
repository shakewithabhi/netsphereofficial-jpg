import { useState } from 'react';
import { Button, Card, Form, Input, Typography, message, Space } from 'antd';
import { LockOutlined, MailOutlined, CloudOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate, Link } from 'react-router-dom';
import { authApi } from '../../api/auth';
import { useAuthStore } from '../../store/auth';

const { Title, Text } = Typography;

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [needs2FA, setNeeds2FA] = useState(false);
  const [loginCredentials, setLoginCredentials] = useState<{ email: string; password: string } | null>(null);
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const processLogin = (res: any) => {
    const data = res.data?.data ?? res.data;
    localStorage.setItem('access_token', data.access_token);
    localStorage.setItem('refresh_token', data.refresh_token);
    setUser(data.user);

    if (!data.user.is_admin) {
      message.error('Access denied. Admin privileges required.');
      localStorage.clear();
      return;
    }

    message.success('Welcome back!');
    navigate('/');
  };

  const onFinish = async (values: { email: string; password: string }) => {
    setLoading(true);
    try {
      const res = await authApi.login(values);
      const data = res.data as any;

      // Check if 2FA is required
      if (data.requires_2fa || data.data?.requires_2fa) {
        setNeeds2FA(true);
        setLoginCredentials(values);
        return;
      }

      processLogin(res);
    } catch (err: any) {
      const errData = err.response?.data;
      if (errData?.requires_2fa) {
        setNeeds2FA(true);
        setLoginCredentials(values);
        return;
      }
      message.error(errData?.error?.message || errData?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const onVerify2FA = async (values: { code: string }) => {
    if (!loginCredentials) return;
    setLoading(true);
    try {
      const res = await authApi.verify2FA({
        email: loginCredentials.email,
        password: loginCredentials.password,
        code: values.code,
      });
      processLogin(res);
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Invalid 2FA code');
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
            <Text type="secondary">
              {needs2FA ? 'Enter your verification code' : 'Sign in to manage your platform'}
            </Text>
          </div>

          {!needs2FA ? (
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
          ) : (
            <Form layout="vertical" onFinish={onVerify2FA} autoComplete="off">
              <Form.Item name="code" rules={[{ required: true, message: 'Enter the 6-digit code' }]}>
                <Input
                  prefix={<SafetyOutlined />}
                  placeholder="6-digit code"
                  size="large"
                  maxLength={6}
                  style={{ textAlign: 'center', letterSpacing: 8, fontSize: 20 }}
                />
              </Form.Item>
              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading} block size="large">
                  Verify
                </Button>
              </Form.Item>
              <Button
                type="link"
                block
                onClick={() => { setNeeds2FA(false); setLoginCredentials(null); }}
              >
                Back to login
              </Button>
            </Form>
          )}

          {!needs2FA && (
            <Text>
              Don't have an account? <Link to="/register">Sign Up</Link>
            </Text>
          )}
        </Space>
      </Card>
    </div>
  );
}
