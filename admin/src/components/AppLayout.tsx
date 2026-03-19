import { Layout, Menu, Typography, Button, Space } from 'antd';
import {
  DashboardOutlined, TeamOutlined, CloudOutlined, LogoutOutlined,
  CloudServerOutlined, AuditOutlined, CheckCircleOutlined,
  SettingOutlined, FolderOutlined, CommentOutlined, DollarOutlined,
  BarChartOutlined, PlayCircleOutlined, BellOutlined, HeartOutlined,
  DownloadOutlined, EyeOutlined, DatabaseOutlined, PieChartOutlined,
} from '@ant-design/icons';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Dashboard' },
  { key: '/users', icon: <TeamOutlined />, label: 'Users' },
  { key: '/files', icon: <FolderOutlined />, label: 'Files' },
  { key: '/storage', icon: <CloudOutlined />, label: 'Storage' },
  { key: '/pending-approvals', icon: <CheckCircleOutlined />, label: 'Approvals' },
  { key: '/comments', icon: <CommentOutlined />, label: 'Comments' },
  { key: '/audit-logs', icon: <AuditOutlined />, label: 'Audit Logs' },
  { key: '/posts', icon: <PlayCircleOutlined />, label: 'Posts' },
  { key: '/explore-posts', icon: <EyeOutlined />, label: 'Explore Moderation' },
  { key: '/notifications', icon: <BellOutlined />, label: 'Notifications' },

  { type: 'group' as const, label: 'Analytics', children: [
    { key: '/ad-analytics', icon: <BarChartOutlined />, label: 'Ad Analytics' },
    { key: '/ad-settings', icon: <DollarOutlined />, label: 'Ad Settings' },
    { key: '/user-storage', icon: <DatabaseOutlined />, label: 'User Storage' },
    { key: '/revenue', icon: <DollarOutlined />, label: 'Revenue' },
    { key: '/billing', icon: <PieChartOutlined />, label: 'Billing' },
    { key: '/reports', icon: <DownloadOutlined />, label: 'Reports' },
  ]},

  { type: 'group' as const, label: 'System', children: [
    { key: '/system-health', icon: <HeartOutlined />, label: 'System Health' },
    { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
  ]},
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="dark" breakpoint="lg" collapsedWidth={0}>
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <CloudServerOutlined style={{ fontSize: 28, color: '#fff' }} />
          <Text strong style={{ color: '#fff', display: 'block', marginTop: 4 }}>ByteBox</Text>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Space>
            <Text type="secondary">{user?.email}</Text>
            <Button icon={<LogoutOutlined />} type="text" onClick={handleLogout}>Logout</Button>
          </Space>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8, minHeight: 360 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
