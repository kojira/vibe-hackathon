import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { generateThemes, getSettings, getGenerations } from '../lib/api';
import type { GenerateResponse, Settings, Generation } from '../lib/api';

interface Theme {
  title: string;
  example: string;
}

function parseThemes(themesText: string): Theme[] {
  const themes: Theme[] = [];
  const lines = themesText.split('\n');
  
  let currentTheme: Partial<Theme> = {};
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // テーマ行を検出 (例: "- テーマ：ニュース x キュレーション")
    if (trimmedLine.startsWith('- テーマ：') || trimmedLine.startsWith('- テーマ:')) {
      if (currentTheme.title) {
        themes.push(currentTheme as Theme);
      }
      currentTheme = {
        title: trimmedLine.replace(/^- テーマ[：:]/, '').trim(),
        example: '',
      };
    }
    // 発想例行を検出 (例: "- 発想例（制限：順序を変換）：内容..." または "- 発想例：内容...")
    else if (trimmedLine.startsWith('- 発想例')) {
      if (currentTheme.title) {
        // "- 発想例（...）：内容" または "- 発想例：内容" から内容部分を抽出
        // 最後のコロン（：または:）以降を取得
        const colonMatch = trimmedLine.match(/[：:]([^：:]+)$/);
        if (colonMatch) {
          currentTheme.example = colonMatch[1].trim();
        } else {
          // フォールバック: "- 発想例" 以降全部
          currentTheme.example = trimmedLine.replace(/^- 発想例.*?[：:]?/, '').trim();
        }
      }
    }
  }
  
  // 最後のテーマを追加
  if (currentTheme.title) {
    themes.push(currentTheme as Theme);
  }
  
  return themes;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function MainPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [settingsData, generationsData] = await Promise.all([
          getSettings(),
          getGenerations(20), // 最新20件
        ]);
        setSettings(settingsData);
        setGenerations(generationsData);
      } catch (err) {
        console.error('データの読み込みに失敗:', err);
      }
    };
    loadData();
  }, []);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await generateThemes();
      setResult(response);
      const parsedThemes = parseThemes(response.themes);
      setThemes(parsedThemes);
      // 履歴を再読み込み
      const generationsData = await getGenerations(20);
      setGenerations(generationsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'エラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistory = (generation: Generation) => {
    const parsedThemes = parseThemes(generation.themes);
    setThemes(parsedThemes);
    setResult({
      id: generation.id,
      themes: generation.themes,
      provider: generation.llmProvider,
      model: generation.llmModel,
      createdAt: generation.createdAt,
    });
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      {/* サイドバー */}
      {sidebarOpen && (
        <div className="w-56 flex-shrink-0 overflow-y-auto pr-2">
          <h2 className="text-sm font-semibold mb-3 text-gray-400">過去の生成</h2>
          {generations.length === 0 ? (
            <p className="text-xs text-gray-500">履歴がありません</p>
          ) : (
            <div className="space-y-2">
              {generations.map((generation) => {
                const genThemes = parseThemes(generation.themes);
                const isSelected = result?.id === generation.id;
                return (
                  <button
                    key={generation.id}
                    onClick={() => handleSelectHistory(generation)}
                    className={`w-full text-left p-2 rounded-lg border transition-all text-xs ${
                      isSelected
                        ? 'bg-indigo-900/40 border-indigo-500'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                    }`}
                  >
                    <div className="text-gray-400 mb-1">
                      {formatDate(generation.createdAt)}
                    </div>
                    <div className="text-indigo-400 mb-1 truncate">
                      {generation.llmProvider} / {generation.llmModel}
                    </div>
                    <div className="text-gray-300 truncate">
                      {genThemes[0]?.title || '(テーマなし)'}
                    </div>
                    {genThemes.length > 1 && (
                      <div className="text-gray-500 mt-0.5">
                        他 {genThemes.length - 1} 件
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* サイドバー開閉ボタン */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="flex-shrink-0 w-6 h-24 self-center bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors"
        aria-label={sidebarOpen ? 'サイドバーを閉じる' : 'サイドバーを開く'}
      >
        <svg
          className={`w-4 h-4 text-gray-400 transition-transform ${sidebarOpen ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col items-center">
          {/* 現在のLLM設定 */}
          {settings && (
            <div className="mb-4 flex items-center gap-3 text-gray-400">
              <span className="text-lg">使用LLM:</span>
              <span className="px-3 py-1 bg-gray-800 rounded-lg text-indigo-400 font-medium">
                {settings.llm_provider} / {settings.llm_model}
              </span>
              <Link
                to="/settings"
                className="text-sm text-gray-500 hover:text-indigo-400 underline transition-colors"
              >
                変更
              </Link>
            </div>
          )}

          {/* 生成ボタン */}
          <div className="mb-8">
            <button
              onClick={handleGenerate}
              disabled={isLoading}
              className="px-8 py-4 text-2xl font-bold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-xl transition-colors shadow-lg"
            >
              {isLoading ? (
                <span className="flex items-center gap-3">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  生成中...
                </span>
              ) : (
                'テーマを生成'
              )}
            </button>
          </div>

          {/* エラー表示 */}
          {error && (
            <div className="mb-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
              {error}
            </div>
          )}

          {/* テーマグリッド表示 */}
          {themes.length > 0 && (
            <div className="w-full">
              {/* 使用したLLM情報 */}
              {result && (
                <div className="mb-6 text-center text-gray-500">
                  生成: {result.provider} / {result.model} ({themes.length}件)
                </div>
              )}

              {/* グリッドカード */}
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {themes.map((theme, index) => (
                  <div
                    key={index}
                    className="bg-gray-800 rounded-2xl p-6 shadow-xl border border-gray-700 hover:border-indigo-500 transition-colors"
                  >
                    <div className="text-center">
                      <p className="text-sm text-indigo-400 mb-2">テーマ {index + 1}</p>
                      <h2 className="text-xl md:text-2xl font-bold mb-4 leading-tight">
                        {theme.title}
                      </h2>
                      
                      <p className="text-xs text-indigo-400 mb-2">発想例</p>
                      <p className="text-sm text-gray-200 leading-relaxed">
                        {theme.example || '(発想例なし)'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 未生成時のプレースホルダー */}
          {themes.length === 0 && !isLoading && !error && (
            <div className="text-center text-gray-500 mt-12">
              <p className="text-2xl mb-4">テーマを生成してください</p>
              <p className="text-lg">上のボタンをクリックすると、AIがハッカソンのテーマを生成します</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
