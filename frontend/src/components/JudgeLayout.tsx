import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function JudgeLayout() {
  const { user, isAdmin, loggedIn, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link to="/gate" className="text-xl font-bold text-white">
              審査システム
            </Link>
            
            {loggedIn && (
              <nav className="flex gap-4">
                <Link
                  to="/judge"
                  className={`px-3 py-1 rounded ${
                    isActive('/judge')
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  審査
                </Link>
                <Link
                  to="/results"
                  className={`px-3 py-1 rounded ${
                    isActive('/results')
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  結果
                </Link>
                
                {isAdmin && (
                  <>
                    <Link
                      to="/control"
                      className={`px-3 py-1 rounded ${
                        isActive('/control')
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      司会
                    </Link>
                    <Link
                      to="/admin"
                      className={`px-3 py-1 rounded ${
                        isActive('/admin')
                          ? 'bg-indigo-600 text-white'
                          : 'text-gray-300 hover:text-white'
                      }`}
                    >
                      管理
                    </Link>
                    <Link
                      to="/"
                      className="text-gray-300 hover:text-white px-3 py-1"
                    >
                      テーマ生成
                    </Link>
                  </>
                )}
                
                <Link
                  to="/me"
                  className={`px-3 py-1 rounded ${
                    isActive('/me')
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  状態
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <span className="text-gray-300">
                {user.username}
              </span>
            )}
            {loggedIn && (
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white text-sm"
              >
                ログアウト
              </button>
            )}
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>
    </div>
  );
}
