import { useState, useEffect, useMemo } from 'react';
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

export function ResultsPage() {
  const { connected, ratingAxes, liveHistory, getLiveHistory, getRatings } = useSocket();
  const [selectedLiveId, setSelectedLiveId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Rating[]>([]);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getLiveHistory();
  }, [getLiveHistory]);

  // 公開済みのLIVEのみフィルター
  const publishedLives = useMemo(() => {
    return liveHistory.filter(live => live.resultsPublished === 1);
  }, [liveHistory]);

  const handleViewRatings = async (liveId: string) => {
    setSelectedLiveId(liveId);
    setLoadingRatings(true);
    setError('');
    const results = await getRatings(liveId);
    if (results.length === 0) {
      setError('結果を取得できませんでした');
    }
    setRatings(results);
    setLoadingRatings(false);
  };

  // 平均スコアを計算
  const calculateAverages = () => {
    if (ratings.length === 0) return {};
    
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    
    ratings.forEach(rating => {
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

  // 選択中のLIVEを取得
  const selectedLive = useMemo(() => {
    return liveHistory.find(live => live.id === selectedLiveId);
  }, [liveHistory, selectedLiveId]);

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
      <h1 className="text-2xl font-bold text-white">審査結果</h1>

      {/* 公開済みLIVE一覧 */}
      <div className="bg-gray-800 rounded-lg p-6">
        <h2 className="text-lg font-medium text-white mb-4">公開済み結果</h2>
        
        {publishedLives.length === 0 ? (
          <div className="text-gray-400">公開済みの結果はありません</div>
        ) : (
          <div className="space-y-2">
            {publishedLives.map(live => (
              <div
                key={live.id}
                className={`p-3 rounded-lg cursor-pointer transition-colors ${
                  selectedLiveId === live.id
                    ? 'bg-indigo-900/50 border border-indigo-700'
                    : 'bg-gray-700 hover:bg-gray-600'
                }`}
                onClick={() => handleViewRatings(live.id)}
              >
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
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 審査結果 */}
      {selectedLiveId && (
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex items-center gap-4 mb-4">
            {selectedLive?.presenterDiscordId && (
              <img
                src={getAvatarUrl(selectedLive.presenterDiscordId, selectedLive.presenterAvatar)}
                alt=""
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <h2 className="text-lg font-medium text-white">
                {selectedLive?.title} の審査結果
              </h2>
              <div className="text-sm text-gray-400">{selectedLive?.presenter}</div>
            </div>
          </div>
          
          {loadingRatings ? (
            <div className="text-gray-400">読み込み中...</div>
          ) : error ? (
            <div className="text-red-400">{error}</div>
          ) : ratings.length === 0 ? (
            <div className="text-gray-400">審査結果はありません</div>
          ) : (
            <div className="space-y-4">
              {/* 平均スコア */}
              <div className="bg-gray-700 rounded-lg p-4">
                <div className="text-sm text-gray-400 mb-2">平均スコア ({ratings.length}件)</div>
                <div className="grid grid-cols-5 gap-2">
                  {ratingAxes.map(axis => {
                    const averages = calculateAverages();
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
