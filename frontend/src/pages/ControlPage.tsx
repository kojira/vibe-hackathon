import { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../hooks/useSocket';

// Discordアバター画像URLを生成
function getAvatarUrl(discordId: string, avatar: string | null, size = 64): string {
  if (avatar) {
    return `https://cdn.discordapp.com/avatars/${discordId}/${avatar}.png?size=${size}`;
  }
  // デフォルトアバター
  const defaultIndex = Number(BigInt(discordId) >> BigInt(22)) % 6;
  return `https://cdn.discordapp.com/embed/avatars/${defaultIndex}.png`;
}

interface Rating {
  id: string;
  liveId: string | null;
  presentationId: string | null;
  judgeId: string;
  judgeName: string;
  scores: Record<string, number>;
  comment?: string | null;
  submittedAt: string;
}

export function ControlPage() {
  const { connected, currentLive, ratingAxes, liveHistory, presentations, setLive, endLive, getLiveHistory, getRatings, publishResults, deleteLive, deletePresentation } = useSocket();
  const [title, setTitle] = useState('');
  const [presenter, setPresenter] = useState('');
  const [selectedLiveId, setSelectedLiveId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  
  // 途中集計用
  const [currentLiveRatings, setCurrentLiveRatings] = useState<Rating[]>([]);
  const [showCurrentLiveRatings, setShowCurrentLiveRatings] = useState(false);
  const [loadingCurrentRatings, setLoadingCurrentRatings] = useState(false);

  useEffect(() => {
    getLiveHistory();
  }, [getLiveHistory, currentLive]);

  // 現在のLIVEが変わったら途中集計をリセット
  useEffect(() => {
    setCurrentLiveRatings([]);
    setShowCurrentLiveRatings(false);
  }, [currentLive?.id]);

  const handleSetLive = () => {
    if (!title.trim() || !presenter.trim()) return;
    setLive(title.trim(), presenter.trim());
    setTitle('');
    setPresenter('');
  };

  const handleStartFromPresentation = (presentationId: string) => {
    if (!confirm('この発表でLIVEを開始しますか？')) return;
    setLive('', '', presentationId);
  };

  const handleEndLive = () => {
    if (confirm('現在のLIVEを終了しますか？')) {
      endLive();
    }
  };

  const handleViewRatings = async (liveId: string) => {
    setSelectedLiveId(liveId);
    setLoadingRatings(true);
    const results = await getRatings(liveId);
    setRatings(results);
    setLoadingRatings(false);
  };

  // 途中集計を取得
  const handleViewCurrentLiveRatings = useCallback(async () => {
    if (!currentLive) return;
    setLoadingCurrentRatings(true);
    const results = await getRatings(currentLive.id);
    setCurrentLiveRatings(results);
    setShowCurrentLiveRatings(true);
    setLoadingCurrentRatings(false);
  }, [currentLive, getRatings]);

  // 途中集計を更新
  const handleRefreshCurrentLiveRatings = useCallback(async () => {
    if (!currentLive) return;
    setLoadingCurrentRatings(true);
    const results = await getRatings(currentLive.id);
    setCurrentLiveRatings(results);
    setLoadingCurrentRatings(false);
  }, [currentLive, getRatings]);

  const handlePublishResults = async (liveId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('結果を公開しますか？公開後は参加者も閲覧できるようになります。')) {
      return;
    }
    setPublishingId(liveId);
    const result = await publishResults(liveId);
    setPublishingId(null);
    if (!result.ok) {
      alert(result.reason || '公開に失敗しました');
    }
  };

  const handleDeleteLive = async (liveId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('この発表を削除しますか？関連する審査結果もすべて削除されます。')) {
      return;
    }
    setDeletingId(liveId);
    const result = await deleteLive(liveId);
    setDeletingId(null);
    if (!result.ok) {
      alert(result.reason || '削除に失敗しました');
    } else {
      // 選択中のLIVEが削除された場合は選択解除
      if (selectedLiveId === liveId) {
        setSelectedLiveId(null);
        setRatings([]);
      }
    }
  };

  const handleDeletePresentation = async (presentationId: string) => {
    if (!confirm('この発表登録を削除しますか？')) return;
    await deletePresentation(presentationId);
  };

  // 平均スコアを計算
  const calculateAverages = (targetRatings: Rating[]) => {
    if (targetRatings.length === 0) return {};
    
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    
    targetRatings.forEach(rating => {
      Object.entries(rating.scores).forEach(([key, value]) => {
        totals[key] = (totals[key] || 0) + value;
        counts[key] = (counts[key] || 0) + 1;
      });
    });
    
    const averages: Record<string, number> = {};
    Object.keys(totals).forEach(key => {
      averages[key] = totals[key] / counts[key];
    });
    
    return averages;
  };

  if (!connected) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-900/50 border border-yellow-700 rounded-lg p-4 text-yellow-200">
          サーバーに接続中...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold text-white">司会コントロール</h1>

      {/* 現在のLIVE */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">現在のLIVE</h2>
        
        {currentLive ? (
          <div className="space-y-4">
            <div className="bg-indigo-900/50 border border-indigo-700 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {currentLive.presenterDiscordId && (
                  <img
                    src={getAvatarUrl(currentLive.presenterDiscordId, currentLive.presenterAvatar)}
                    alt=""
                    className="w-12 h-12 rounded-full"
                  />
                )}
                <div className="flex-1">
                  <div className="text-xl font-bold text-white">{currentLive.title}</div>
                  <div className="text-gray-300">発表者: {currentLive.presenter}</div>
                  {currentLive.description && (
                    <div className="text-gray-400 text-sm mt-1 whitespace-pre-wrap">{currentLive.description}</div>
                  )}
                  <div className="text-gray-500 text-sm mt-1">
                    開始: {new Date(currentLive.startedAt).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleEndLive}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
              >
                LIVEを終了
              </button>
              <button
                onClick={showCurrentLiveRatings ? handleRefreshCurrentLiveRatings : handleViewCurrentLiveRatings}
                disabled={loadingCurrentRatings}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-600 text-white rounded-lg"
              >
                {loadingCurrentRatings ? '読み込み中...' : showCurrentLiveRatings ? '途中集計を更新' : '途中集計を見る'}
              </button>
            </div>
            
            {/* 途中集計 */}
            {showCurrentLiveRatings && (
              <div className="mt-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-md font-medium text-yellow-400">途中集計</h3>
                  <button
                    onClick={() => setShowCurrentLiveRatings(false)}
                    className="text-gray-400 hover:text-white text-sm"
                  >
                    閉じる
                  </button>
                </div>
                
                {currentLiveRatings.length === 0 ? (
                  <div className="text-gray-400">まだ審査結果はありません</div>
                ) : (
                  <div className="space-y-4">
                    {/* 平均スコア */}
                    <div className="bg-gray-700 rounded-lg p-4">
                      <div className="text-sm text-gray-400 mb-2">平均スコア ({currentLiveRatings.length}件)</div>
                      <div className="grid grid-cols-5 gap-2">
                        {ratingAxes.map(axis => {
                          const averages = calculateAverages(currentLiveRatings);
                          return (
                            <div key={axis.key} className="text-center">
                              <div className="text-gray-400 text-xs">{axis.label}</div>
                              <div className="text-xl font-bold text-white">
                                {averages[axis.key]?.toFixed(1) || '-'}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* 個別審査 */}
                    <div className="space-y-3">
                      {currentLiveRatings.map(rating => (
                        <div key={rating.id} className="bg-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-medium text-gray-300">{rating.judgeName}</div>
                            <div className="text-xs text-gray-500">
                              {new Date(rating.submittedAt).toLocaleTimeString()}
                            </div>
                          </div>
                          <div className="flex gap-4 mb-2">
                            {ratingAxes.map(axis => (
                              <div key={axis.key} className="text-center">
                                <div className="text-xs text-gray-500">{axis.label}</div>
                                <div className="text-white font-medium">{rating.scores[axis.key] || '-'}</div>
                              </div>
                            ))}
                          </div>
                          {rating.comment && (
                            <div className="mt-3 pt-3 border-t border-gray-600">
                              <div className="text-xs text-gray-500 mb-1">コメント</div>
                              <div className="text-gray-300 text-sm whitespace-pre-wrap">{rating.comment}</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-gray-400">現在LIVEはありません</div>
        )}
      </div>

      {/* 登録済み発表一覧 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">登録済み発表一覧</h2>
        
        {presentations.length === 0 ? (
          <div className="text-gray-400">登録済みの発表はありません</div>
        ) : (
          <div className="space-y-3">
            {presentations.map(p => (
              <div key={p.id} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-start gap-4">
                  <img
                    src={getAvatarUrl(p.discordId, p.avatar)}
                    alt=""
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="font-medium text-white">{p.title}</div>
                    <div className="text-gray-400 text-sm">{p.username}</div>
                    {p.description && (
                      <div className="text-gray-500 text-sm mt-1 whitespace-pre-wrap">{p.description}</div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleStartFromPresentation(p.id)}
                      disabled={!!currentLive}
                      className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
                    >
                      開始
                    </button>
                    <button
                      onClick={() => handleDeletePresentation(p.id)}
                      className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 text-white rounded"
                    >
                      削除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 手動LIVE設定 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">手動でLIVE設定</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              タイトル
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="発表タイトル"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              発表者
            </label>
            <input
              type="text"
              value={presenter}
              onChange={(e) => setPresenter(e.target.value)}
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="発表者名"
            />
          </div>
          <button
            onClick={handleSetLive}
            disabled={!title.trim() || !presenter.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg"
          >
            反映
          </button>
        </div>
      </div>

      {/* LIVE履歴 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">LIVE履歴</h2>
        
        {liveHistory.length === 0 ? (
          <div className="text-gray-400">履歴はありません</div>
        ) : (
          <div className="space-y-2">
            {liveHistory.map(live => (
              <div
                key={live.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedLiveId === live.id
                    ? 'bg-indigo-900/50 border border-indigo-700'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => handleViewRatings(live.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {live.presenterDiscordId && (
                      <img
                        src={getAvatarUrl(live.presenterDiscordId, live.presenterAvatar, 32)}
                        alt=""
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <div>
                      <div className="font-medium text-white">{live.title}</div>
                      <div className="text-sm text-gray-400">
                        {live.presenter} - {new Date(live.startedAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {live.resultsPublished === 1 ? (
                      <span className="px-2 py-1 text-xs bg-green-900/50 text-green-400 rounded">
                        公開済み
                      </span>
                    ) : (
                      <button
                        onClick={(e) => handlePublishResults(live.id, e)}
                        disabled={publishingId === live.id}
                        className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded"
                      >
                        {publishingId === live.id ? '公開中...' : '結果公開'}
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDeleteLive(live.id, e)}
                      disabled={deletingId === live.id || (currentLive?.id === live.id)}
                      className="px-3 py-1 text-xs bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded"
                      title={currentLive?.id === live.id ? '現在進行中のLIVEは削除できません' : ''}
                    >
                      {deletingId === live.id ? '削除中...' : '削除'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 審査結果 */}
      {selectedLiveId && (
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-lg font-medium text-white mb-4">審査結果</h2>
          
          {loadingRatings ? (
            <div className="text-gray-400">読み込み中...</div>
          ) : ratings.length === 0 ? (
            <div className="text-gray-400">審査結果はありません</div>
          ) : (
            <div className="space-y-4">
              {/* 平均スコア */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">平均スコア ({ratings.length}件)</div>
                <div className="grid grid-cols-5 gap-2">
                  {ratingAxes.map(axis => {
                    const averages = calculateAverages(ratings);
                    return (
                      <div key={axis.key} className="text-center">
                        <div className="text-gray-400 text-xs">{axis.label}</div>
                        <div className="text-xl font-bold text-white">
                          {averages[axis.key]?.toFixed(1) || '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 個別審査 */}
              <div className="space-y-3">
                {ratings.map(rating => (
                  <div key={rating.id} className="bg-gray-700 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-300">{rating.judgeName}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(rating.submittedAt).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-4 mb-2">
                      {ratingAxes.map(axis => (
                        <div key={axis.key} className="text-center">
                          <div className="text-xs text-gray-500">{axis.label}</div>
                          <div className="text-white font-medium">{rating.scores[axis.key] || '-'}</div>
                        </div>
                      ))}
                    </div>
                    {rating.comment && (
                      <div className="mt-3 pt-3 border-t border-gray-600">
                        <div className="text-xs text-gray-500 mb-1">コメント</div>
                        <div className="text-gray-300 text-sm whitespace-pre-wrap">{rating.comment}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
