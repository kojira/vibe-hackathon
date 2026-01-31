/**
 * ログインページ（Nostr対応版）
 * 
 * 認証フロー:
 * 1. Discord OAuthでログイン
 * 2. パスワードを設定（Nostr秘密鍵生成用）
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function GatePage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(true); // 新規ユーザーかどうか
  const { passOk, loggedIn, submitPassword, loginWithDiscord, user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URLエラーパラメータをチェック
  useEffect(() => {
    const urlError = searchParams.get('error');
    if (urlError) {
      switch (urlError) {
        case 'invalid_state':
          setError('認証セッションが無効です。もう一度お試しください。');
          break;
        case 'token_failed':
          setError('Discord認証に失敗しました。');
          break;
        case 'oauth_failed':
          setError('OAuth認証中にエラーが発生しました。');
          break;
        default:
          setError(`認証エラー: ${urlError}`);
      }
    }
  }, [searchParams]);

  useEffect(() => {
    // 両方完了していたら /judge へ
    if (passOk && loggedIn) {
      navigate('/judge');
    }
  }, [passOk, loggedIn, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // 新規ユーザーの場合はパスワード確認
    if (isNewUser && password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);

    const result = await submitPassword(password);
    
    setLoading(false);
    
    if (!result.ok) {
      setError(result.error || '認証に失敗しました');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">審査システム</h1>
          <p className="text-gray-400">イベントに参加するにはログインしてください</p>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 space-y-6">
          {/* ステップ1: Discordログイン */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                loggedIn ? 'bg-green-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}>
                {loggedIn ? '✓' : '1'}
              </div>
              <div className="text-white font-medium">Discordでログイン</div>
            </div>

            {!loggedIn ? (
              <button
                onClick={loginWithDiscord}
                className="w-full py-2 px-4 bg-[#5865F2] hover:bg-[#4752C4] text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Discordでログイン
              </button>
            ) : (
              <div className="flex items-center gap-3 p-3 bg-gray-700 rounded-lg">
                {user?.avatar ? (
                  <img 
                    src={user.avatar} 
                    alt={user.username} 
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold">
                    {user?.username?.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <div className="text-white font-medium">{user?.username}</div>
                  <div className="text-gray-400 text-sm">ログイン済み</div>
                </div>
              </div>
            )}
          </div>

          {/* ステップ2: パスワード設定 */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                passOk ? 'bg-green-600 text-white' : loggedIn ? 'bg-indigo-600 text-white' : 'bg-gray-600 text-gray-300'
              }`}>
                {passOk ? '✓' : '2'}
              </div>
              <div className={`font-medium ${loggedIn ? 'text-white' : 'text-gray-500'}`}>
                パスワードを{isNewUser ? '設定' : '入力'}
              </div>
            </div>

            {loggedIn && !passOk && (
              <>
                <div className="text-sm text-gray-400 mb-4">
                  <p>このパスワードはあなたのデータを保護するために使用されます。</p>
                  <p className="text-yellow-400 mt-2">
                    ⚠️ パスワードを忘れるとデータにアクセスできなくなります
                  </p>
                </div>

                {/* 新規/既存ユーザー切り替え */}
                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => setIsNewUser(true)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      isNewUser 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    新規登録
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsNewUser(false)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                      !isNewUser 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    既存ユーザー
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="パスワード（8文字以上、英字と数字を含む）"
                      required
                      minLength={8}
                    />
                  </div>

                  {isNewUser && (
                    <div>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="パスワード（確認）"
                        required
                        minLength={8}
                      />
                    </div>
                  )}

                  {error && (
                    <div className="text-red-400 text-sm">{error}</div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-800 text-white font-medium rounded-lg transition-colors"
                  >
                    {loading ? '処理中...' : isNewUser ? '登録して入場' : '入場する'}
                  </button>
                </form>
              </>
            )}

            {passOk && (
              <div className="text-green-400 text-center p-3 bg-green-900/30 rounded-lg">
                認証完了！リダイレクト中...
              </div>
            )}

            {!loggedIn && (
              <div className="text-gray-500 text-sm text-center">
                まずDiscordでログインしてください
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 text-center text-gray-500 text-xs">
          <p>このアプリはNostrプロトコルを使用してデータを保存します</p>
        </div>
      </div>
    </div>
  );
}
