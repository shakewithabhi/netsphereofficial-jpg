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
            <Route path="/storage" element={<StoragePage />} />
            <Route path="/audit-logs" element={<AuditLogsPage />} />
            <Route path="/pending-approvals" element={<PendingApprovalsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ConfigProvider>
  );
}
