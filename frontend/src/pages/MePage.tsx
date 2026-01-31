import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../hooks/useSocket';

export function MePage() {
  const { passOk, loggedIn, isAdmin, user, checkAuth } = useAuth();
  const { connected, authState } = useSocket();

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">ログイン状態</h1>

      {/* REST API からの状態 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">REST API 状態</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">合言葉通過</span>
            <span className={passOk ? 'text-green-400' : 'text-red-400'}>
              {passOk ? 'OK' : 'NG'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">ログイン</span>
            <span className={loggedIn ? 'text-green-400' : 'text-red-400'}>
              {loggedIn ? 'OK' : 'NG'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">管理者</span>
            <span className={isAdmin ? 'text-green-400' : 'text-gray-400'}>
              {isAdmin ? 'Yes' : 'No'}
            </span>
          </div>
        </div>
        <button
          onClick={checkAuth}
          className="mt-4 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg"
        >
          再確認
        </button>
      </div>

      {/* Socket.IO からの状態 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">Socket.IO 状態</h2>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-gray-400">接続状態</span>
            <span className={connected ? 'text-green-400' : 'text-red-400'}>
              {connected ? '接続中' : '切断'}
            </span>
          </div>
          {authState && (
            <>
              <div className="flex justify-between">
                <span className="text-gray-400">合言葉通過 (Socket)</span>
                <span className={authState.passOk ? 'text-green-400' : 'text-red-400'}>
                  {authState.passOk ? 'OK' : 'NG'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">ログイン (Socket)</span>
                <span className={authState.loggedIn ? 'text-green-400' : 'text-red-400'}>
                  {authState.loggedIn ? 'OK' : 'NG'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">管理者 (Socket)</span>
                <span className={authState.isAdmin ? 'text-green-400' : 'text-gray-400'}>
                  {authState.isAdmin ? 'Yes' : 'No'}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ユーザー情報 */}
      {user && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">ユーザー情報</h2>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-400">ユーザー名</span>
              <span className="text-white">{user.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Discord ID</span>
              <span className="text-white font-mono text-sm">{user.discordId}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
