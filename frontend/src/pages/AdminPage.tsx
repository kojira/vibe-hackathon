import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface RecentUser {
  discordId: string;
  username: string;
  lastSeenAt: string;
}

interface RatingAxis {
  id: number;
  key: string;
  label: string;
  order: number;
}

export function AdminPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'admins' | 'axes'>('admins');
  
  // 管理者タブの状態
  const [admins, setAdmins] = useState<string[]>([]);
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([]);
  const [newAdminId, setNewAdminId] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // 評価軸タブの状態
  const [axes, setAxes] = useState<RatingAxis[]>([]);
  const [newAxisKey, setNewAxisKey] = useState('');
  const [newAxisLabel, setNewAxisLabel] = useState('');
  const [axisLoading, setAxisLoading] = useState(false);
  const [axisError, setAxisError] = useState('');
  
  // 編集中の評価軸
  const [editingAxisId, setEditingAxisId] = useState<number | null>(null);
  const [editingLabel, setEditingLabel] = useState('');

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await fetch('/admin/list', { credentials: 'include' });
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (error) {
      console.error('Failed to fetch admins:', error);
    }
  }, []);

  const fetchRecentUsers = useCallback(async () => {
    try {
      const res = await fetch('/admin/recent-users', { credentials: 'include' });
      const data = await res.json();
      setRecentUsers(data.users || []);
    } catch (error) {
      console.error('Failed to fetch recent users:', error);
    }
  }, []);

  const fetchAxes = useCallback(async () => {
    try {
      const res = await fetch('/api/rating-axes', { credentials: 'include' });
      const data = await res.json();
      setAxes(data.axes || []);
    } catch (error) {
      console.error('Failed to fetch axes:', error);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchRecentUsers();
    fetchAxes();
  }, [fetchAdmins, fetchRecentUsers, fetchAxes]);

  const handleAddAdmin = async (discordId: string) => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch('/admin/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ discordId }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewAdminId('');
        fetchAdmins();
      } else {
        setAdminError(data.error || '追加に失敗しました');
      }
    } catch (error) {
      setAdminError('通信エラーが発生しました');
    }
    setAdminLoading(false);
  };

  const handleRemoveAdmin = async (discordId: string) => {
    const isSelf = discordId === user?.discordId;
    if (isSelf) {
      if (!confirm('自分自身を管理者から削除しますか？この操作は元に戻せません。')) {
        return;
      }
      if (!confirm('本当によろしいですか？')) {
        return;
      }
    }

    setAdminLoading(true);
    setAdminError('');
    try {
      const res = await fetch('/admin/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ discordId }),
      });
      const data = await res.json();
      if (data.ok) {
        fetchAdmins();
        if (isSelf) {
          window.location.href = '/judge';
        }
      } else {
        setAdminError(data.error || '削除に失敗しました');
      }
    } catch (error) {
      setAdminError('通信エラーが発生しました');
    }
    setAdminLoading(false);
  };

  const handleAddAxis = async () => {
    if (!newAxisKey.trim() || !newAxisLabel.trim()) return;

    setAxisLoading(true);
    setAxisError('');
    try {
      const maxOrder = Math.max(0, ...axes.map(a => a.order));
      const res = await fetch('/api/rating-axes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          key: newAxisKey.trim(),
          label: newAxisLabel.trim(),
          order: maxOrder + 1,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setNewAxisKey('');
        setNewAxisLabel('');
        fetchAxes();
      } else {
        setAxisError(data.error || '追加に失敗しました');
      }
    } catch (error) {
      setAxisError('通信エラーが発生しました');
    }
    setAxisLoading(false);
  };

  const handleEditAxis = (axis: RatingAxis) => {
    setEditingAxisId(axis.id);
    setEditingLabel(axis.label);
  };

  const handleCancelEdit = () => {
    setEditingAxisId(null);
    setEditingLabel('');
  };

  const handleSaveAxis = async (id: number) => {
    if (!editingLabel.trim()) return;

    setAxisLoading(true);
    setAxisError('');
    try {
      const res = await fetch(`/api/rating-axes/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ label: editingLabel.trim() }),
      });
      const data = await res.json();
      if (data.ok) {
        setEditingAxisId(null);
        setEditingLabel('');
        fetchAxes();
      } else {
        setAxisError(data.error || '更新に失敗しました');
      }
    } catch (error) {
      setAxisError('通信エラーが発生しました');
    }
    setAxisLoading(false);
  };

  const handleDeleteAxis = async (id: number) => {
    if (!confirm('この評価軸を削除しますか？')) return;

    setAxisLoading(true);
    setAxisError('');
    try {
      const res = await fetch(`/api/rating-axes/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        fetchAxes();
      } else {
        setAxisError(data.error || '削除に失敗しました');
      }
    } catch (error) {
      setAxisError('通信エラーが発生しました');
    }
    setAxisLoading(false);
  };

  const handleResetAxes = async () => {
    if (!confirm('評価軸をデフォルトにリセットしますか？')) return;

    setAxisLoading(true);
    setAxisError('');
    try {
      const res = await fetch('/api/rating-axes/reset', {
        method: 'POST',
        credentials: 'include',
      });
      const data = await res.json();
      if (data.ok) {
        fetchAxes();
      } else {
        setAxisError(data.error || 'リセットに失敗しました');
      }
    } catch (error) {
      setAxisError('通信エラーが発生しました');
    }
    setAxisLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">管理画面</h1>

      {/* タブ */}
      <div className="flex gap-2">
        <button
          onClick={() => setActiveTab('admins')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'admins'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          管理者
        </button>
        <button
          onClick={() => setActiveTab('axes')}
          className={`px-4 py-2 rounded-lg ${
            activeTab === 'axes'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          評価軸
        </button>
      </div>

      {/* 管理者タブ */}
      {activeTab === 'admins' && (
        <div className="space-y-6">
          {/* 管理者追加 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium text-white mb-4">管理者を追加</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAdminId}
                onChange={(e) => setNewAdminId(e.target.value)}
                placeholder="Discord ユーザーID"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={() => handleAddAdmin(newAdminId)}
                disabled={!newAdminId.trim() || adminLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg"
              >
                追加
              </button>
            </div>
            {adminError && <div className="text-red-400 text-sm mt-2">{adminError}</div>}
          </div>

          {/* 最近ログインしたユーザー */}
          {recentUsers.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6">
              <h2 className="text-lg font-medium text-white mb-4">最近ログインしたユーザー</h2>
              <div className="space-y-2">
                {recentUsers.filter(u => !admins.includes(u.discordId)).slice(0, 10).map(u => (
                  <div
                    key={u.discordId}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                  >
                    <div>
                      <div className="text-white">{u.username}</div>
                      <div className="text-gray-400 text-sm">{u.discordId}</div>
                    </div>
                    <button
                      onClick={() => handleAddAdmin(u.discordId)}
                      disabled={adminLoading}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white text-sm rounded"
                    >
                      追加
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 管理者一覧 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium text-white mb-4">管理者一覧</h2>
            {admins.length === 0 ? (
              <div className="text-gray-400">管理者はいません</div>
            ) : (
              <div className="space-y-2">
                {admins.map(adminId => {
                  const recentUser = recentUsers.find(u => u.discordId === adminId);
                  const isSelf = adminId === user?.discordId;
                  return (
                    <div
                      key={adminId}
                      className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                    >
                      <div>
                        <div className="text-white">
                          {recentUser?.username || '不明'}
                          {isSelf && <span className="text-indigo-400 ml-2">(あなた)</span>}
                        </div>
                        <div className="text-gray-400 text-sm">{adminId}</div>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(adminId)}
                        disabled={adminLoading}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded"
                      >
                        削除
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 評価軸タブ */}
      {activeTab === 'axes' && (
        <div className="space-y-6">
          {/* 評価軸追加 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <h2 className="text-lg font-medium text-white mb-4">評価軸を追加</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={newAxisKey}
                onChange={(e) => setNewAxisKey(e.target.value)}
                placeholder="キー (英数字)"
                className="w-32 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <input
                type="text"
                value={newAxisLabel}
                onChange={(e) => setNewAxisLabel(e.target.value)}
                placeholder="表示名"
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <button
                onClick={handleAddAxis}
                disabled={!newAxisKey.trim() || !newAxisLabel.trim() || axisLoading}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg"
              >
                追加
              </button>
            </div>
            {axisError && <div className="text-red-400 text-sm mt-2">{axisError}</div>}
          </div>

          {/* 評価軸一覧 */}
          <div className="bg-gray-800 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-white">評価軸一覧</h2>
              <button
                onClick={handleResetAxes}
                disabled={axisLoading}
                className="px-3 py-1 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 text-white text-sm rounded"
              >
                デフォルトに戻す
              </button>
            </div>
            {axes.length === 0 ? (
              <div className="text-gray-400">評価軸はありません</div>
            ) : (
              <div className="space-y-2">
                {axes.map(axis => (
                  <div
                    key={axis.id}
                    className="flex items-center justify-between p-3 bg-gray-700 rounded-lg"
                  >
                    {editingAxisId === axis.id ? (
                      // 編集モード
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editingLabel}
                          onChange={(e) => setEditingLabel(e.target.value)}
                          className="flex-1 px-3 py-1 bg-gray-600 border border-gray-500 rounded text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveAxis(axis.id);
                            if (e.key === 'Escape') handleCancelEdit();
                          }}
                        />
                        <button
                          onClick={() => handleSaveAxis(axis.id)}
                          disabled={!editingLabel.trim() || axisLoading}
                          className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded"
                        >
                          保存
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-sm rounded"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      // 表示モード
                      <>
                        <div>
                          <div className="text-white">{axis.label}</div>
                          <div className="text-gray-400 text-sm">key: {axis.key}</div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEditAxis(axis)}
                            disabled={axisLoading}
                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded"
                          >
                            編集
                          </button>
                          <button
                            onClick={() => handleDeleteAxis(axis.id)}
                            disabled={axisLoading}
                            className="px-3 py-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white text-sm rounded"
                          >
                            削除
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
