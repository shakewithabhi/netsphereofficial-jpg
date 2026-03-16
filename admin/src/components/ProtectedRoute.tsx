import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../store/auth';
import { authApi } from '../api/auth';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, setUser, logout } = useAuthStore();
  const [checking, setChecking] = useState(!user && isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && !user) {
      authApi.me()
        .then((res) => {
          if (!res.data.data.is_admin) {
            logout();
          } else {
            setUser(res.data.data);
          }
        })
        .catch(() => logout())
        .finally(() => setChecking(false));
    }
  }, [isAuthenticated, user, setUser, logout]);

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (checking) return <Spin size="large" style={{ display: 'block', margin: '200px auto' }} />;

  return <>{children}</>;
}
