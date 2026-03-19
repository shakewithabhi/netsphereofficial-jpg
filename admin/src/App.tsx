import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/Login';
import RegisterPage from './pages/Register';
import DashboardPage from './pages/Dashboard';
import UsersPage from './pages/Users';
import StoragePage from './pages/Storage';
import AuditLogsPage from './pages/AuditLogs';
import PendingApprovalsPage from './pages/PendingApprovals';
import SettingsPage from './pages/Settings';
import FilesPage from './pages/Files';
import CommentsPage from './pages/Comments';
import AdAnalyticsPage from './pages/AdAnalytics';
import AdSettingsPage from './pages/AdSettings';
import PostsPage from './pages/Posts';
import ExplorePostsPage from './pages/ExplorePosts';
import NotificationsPage from './pages/Notifications';
import RevenuePage from './pages/Revenue';
import BillingPage from './pages/Billing';
import UserStoragePage from './pages/UserStorage';
import SystemHealthPage from './pages/SystemHealth';
import ReportsPage from './pages/Reports';

export default function App() {
  return (
    <ConfigProvider theme={{ token: { colorPrimary: '#1677ff', borderRadius: 6 } }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route path="/" element={<DashboardPage />} />
            <Route path="/users" element={<UsersPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/pending-approvals" element={<PendingApprovalsPage />} />
            <Route path="/comments" element={<CommentsPage />} />
            <Route path="/ad-analytics" element={<AdAnalyticsPage />} />
            <Route path="/ad-settings" element={<AdSettingsPage />} />
            <Route path="/posts" element={<PostsPage />} />
            <Route path="/explore-posts" element={<ExplorePostsPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/revenue" element={<RevenuePage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/user-storage" element={<UserStoragePage />} />
            <Route path="/system-health" element={<SystemHealthPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
