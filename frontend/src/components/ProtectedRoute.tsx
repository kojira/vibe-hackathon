import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireLogin?: boolean;
  requireAdmin?: boolean;
}

export function ProtectedRoute({ children, requireLogin, requireAdmin }: ProtectedRouteProps) {
  const { passOk, loggedIn, isAdmin, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white">読み込み中...</div>
      </div>
    );
  }

  // ログインチェック（Discordログインが先）
  if (requireLogin && !loggedIn) {
    return <Navigate to="/gate" replace />;
  }

  // 合言葉チェック
  if ((requireLogin || requireAdmin) && !passOk) {
    return <Navigate to="/gate" replace />;
  }

  // 管理者チェック
  if (requireAdmin && !isAdmin) {
    return <Navigate to="/judge" replace />;
  }

  return <>{children}</>;
}
