import { useState, useEffect, useMemo } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useAuth } from '../contexts/AuthContext';

// Discordアバター画像URLを生成
function getAvatarUrl(discordId: string, avatar: string | null, size = 64): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=${size}`;
  }
  // デフォルトアバター
  const defaultIndex = Number(BigInt(discordId) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

export function JudgePage() {
  const { user } = useAuth();
  const { 
    connected, 
    ratingAxes, 
    presentations, 
    registerPresentation, 
    deletePresentation,
    presentationSubmitted,
    submitPresentationRating,
    checkPresentationSubmitted,
  } = useSocket();
  const [scores, setScores] = useState<Record<string, number>>({});
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // 発表登録フォーム
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registerError, setRegisterError] = useState('');
  
  // 審査対象のプレゼンテーション
  const [selectedPresentation, setSelectedPresentation] = useState<string | null>(null);

  // 自分の発表登録を取得
  const myPresentations = useMemo(() => {
    if (!user) return [];
    return presentations.filter(p => p.discordId === user.discordId);
  }, [presentations, user]);

  // 他の人のプレゼンテーション（自分以外）
  const otherPresentations = useMemo(() => {
    if (!user) return presentations;
    return presentations.filter(p => p.discordId !== user.discordId);
  }, [presentations, user]);

  // 選択されたプレゼンテーションのデータを取得
  const selectedPresentationData = useMemo(() => {
    return presentations.find(p => p.id === selectedPresentation);
  }, [presentations, selectedPresentation]);

  // 評価軸が変わったらスコアをリセット
  useEffect(() => {
    const initialScores: Record<string, number> = {};
    ratingAxes.forEach(axis => {
      initialScores[axis.key] = 0;
    });
    setScores(initialScores);
  }, [ratingAxes]);

  // プレゼンテーションが選択されたら審査済みかチェック
  useEffect(() => {
    if (selectedPresentation) {
      checkPresentationSubmitted(selectedPresentation);
    }
  }, [selectedPresentation, checkPresentationSubmitted]);

  // プレゼンテーション選択が変わったらスコアとコメントをリセット
  useEffect(() => {
    const initialScores: Record<string, number> = {};
    ratingAxes.forEach(axis => {
      initialScores[axis.key] = 0;
    });
    setScores(initialScores);
    setComment('');
    setError('');
  }, [selectedPresentation, ratingAxes]);

  const handleScoreChange = (key: string, value: number) => {
    setScores(prev => ({ ...prev, [key]: value }));
  };

  const allScoresSet = ratingAxes.length > 0 && ratingAxes.every(axis => scores[axis.key] > 0);

  const handlePresentationSubmit = async () => {
    if (!selectedPresentation || !allScoresSet) return;

    setSubmitting(true);
    setError('');

    const result = await submitPresentationRating(selectedPresentation, scores, comment.trim() || undefined);

    setSubmitting(false);

    if (!result.ok) {
      setError(result.reason || '送信に失敗しました');
    }
  };

  const handleRegisterPresentation = async () => {
    if (!newTitle.trim()) return;

    setRegistering(true);
    setRegisterError('');

    const result = await registerPresentation(newTitle.trim(), newDescription.trim() || undefined);

    setRegistering(false);

    if (result.ok) {
      setNewTitle('');
      setNewDescription('');
    } else {
      setRegisterError(result.reason || '登録に失敗しました');
    }
  };

  const handleDeletePresentation = async (id: string) => {
    if (!confirm('この発表登録を削除しますか？')) return;
    await deletePresentation(id);
  };

  if (!connected) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 text-yellow-200">
          サーバーに接続中...
        </div>
      </div>
    );
  }

  // プレゼンテーション審査フォーム
  if (selectedPresentation && selectedPresentationData) {
    const isSubmitted = presentationSubmitted[selectedPresentation];
    
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        {/* 戻るボタン */}
        <button
          onClick={() => setSelectedPresentation(null)}
          className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2"
        >
          ← 一覧に戻る
        </button>

        {/* 審査対象のプレゼンテーション */}
        <div className="bg-indigo-900/50 border border-indigo-700 rounded-lg p-6">
          <div className="text-indigo-300 text-sm mb-2">審査対象</div>
          <div className="flex items-start gap-4">
            <img
              src={getAvatarUrl(selectedPresentationData.discordId, selectedPresentationData.avatar)}
              alt=""
              className="w-16 h-16 rounded-full"
            />
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-white mb-1">{selectedPresentationData.title}</h2>
              <div className="text-gray-300">発表者: {selectedPresentationData.username}</div>
              {selectedPresentationData.description && (
                <div className="text-gray-400 text-sm mt-2 whitespace-pre-wrap">{selectedPresentationData.description}</div>
              )}
            </div>
          </div>
        </div>

        {/* 審査フォーム */}
        <div className="bg-gray-800 rounded-lg p-6">
          {isSubmitted ? (
            <div className="text-center py-8">
              <div className="text-green-400 text-xl mb-2">送信完了</div>
              <div className="text-gray-400">この発表への審査は完了しました</div>
            </div>
          ) : (
            <div className="space-y-6">
              <h3 className="text-lg font-medium text-white">評価</h3>

              {ratingAxes.map(axis => (
                <div key={axis.key} className="space-y-2">
                  <div className="text-gray-300">{axis.label}</div>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map(value => (
                      <label
                        key={value}
                        className={`flex-1 py-3 text-center rounded-lg cursor-pointer transition-colors ${
                          scores[axis.key] === value
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                      >
                        <input
                          type="radio"
                          name={axis.key}
                          value={value}
                          checked={scores[axis.key] === value}
                          onChange={() => handleScoreChange(axis.key, value)}
                          className="sr-only"
                        />
                        {value}
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {/* コメント入力欄 */}
              <div className="space-y-2">
                <div className="text-gray-300">コメント（任意）</div>
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="審査コメントを入力（任意）"
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>

              {error && (
                <div className="text-red-400 text-sm">{error}</div>
              )}

              <button
                onClick={handlePresentationSubmit}
                disabled={!allScoresSet || submitting}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
              >
                {submitting ? '送信中...' : '送信する'}
              </button>

              {!allScoresSet && (
                <div className="text-gray-500 text-sm text-center">
                  すべての項目を評価してください
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 発表一覧と登録フォーム
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* 審査可能な発表一覧 */}
      {otherPresentations.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">審査可能な発表</h2>
          <div className="space-y-3">
            {otherPresentations.map(p => (
              <div key={p.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <img
                      src={getAvatarUrl(p.discordId, p.avatar)}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-white">{p.title}</div>
                      <div className="text-gray-400 text-sm">{p.username}</div>
                      {p.description && (
                        <div className="text-gray-500 text-sm mt-1 whitespace-pre-wrap line-clamp-2">{p.description}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedPresentation(p.id)}
                    disabled={presentationSubmitted[p.id]}
                    className={`px-4 py-2 text-sm font-medium rounded ${
                      presentationSubmitted[p.id]
                        ? 'bg-green-600 text-white cursor-default'
                        : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                  >
                    {presentationSubmitted[p.id] ? '審査済み' : '審査する'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {otherPresentations.length === 0 && (
        <div className="bg-gray-800 rounded-lg p-8 text-center">
          <div className="text-gray-400 text-lg">
            審査可能な発表はありません
          </div>
          <div className="text-gray-500 text-sm mt-2">
            他の参加者が発表を登録するまでお待ちください
          </div>
        </div>
      )}

      {/* 発表登録フォーム */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">発表を登録する</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="発表タイトル"
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              概要（任意）
            </label>
            <textarea
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="発表の概要を入力"
              rows={3}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>
          {registerError && (
            <div className="text-red-400 text-sm">{registerError}</div>
          )}
          <button
            onClick={handleRegisterPresentation}
            disabled={!newTitle.trim() || registering}
            className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            {registering ? '登録中...' : '登録する'}
          </button>
        </div>
      </div>

      {/* 自分の発表登録一覧 */}
      {myPresentations.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">あなたの登録済み発表</h2>
          <div className="space-y-3">
            {myPresentations.map(p => (
              <div key={p.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <img
                      src={getAvatarUrl(p.discordId, p.avatar)}
                      alt=""
                      className="w-10 h-10 rounded-full"
                    />
                    <div>
                      <div className="font-medium text-white">{p.title}</div>
                      {p.description && (
                        <div className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{p.description}</div>
                      )}
                      <div className="text-gray-500 text-xs mt-1">
                        {new Date(p.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeletePresentation(p.id)}
                    className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 text-white rounded"
                  >
                    削除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
