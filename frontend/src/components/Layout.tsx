import { Link, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Layout() {
  const location = useLocation();
  const { logout, user } = useAuth();

  const navItems = [
    { path: '/', label: 'テーマ生成' },
    { path: '/history', label: '履歴' },
    { path: '/settings', label: '設定' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-bold text-indigo-400">
                Vibe Theme Generator
              </h1>
              <div className="flex space-x-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      location.pathname === item.path
                        ? 'bg-gray-900 text-white'
                        : 'text-gray-300 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
                <Link
                  to="/judge"
                  className="px-3 py-2 rounded-md text-sm font-medium text-gray-300 hover:bg-gray-700 hover:text-white"
                >
                  審査システム
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user && (
                <span className="text-gray-300 text-sm">{user.username}</span>
              )}
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
