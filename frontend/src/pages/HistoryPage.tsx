import { useState, useEffect } from 'react';
import { getGenerations } from '../lib/api';
import type { Generation } from '../lib/api';

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
        const colonMatch = trimmedLine.match(/[：:]([^：:]+)$/);
        if (colonMatch) {
          currentTheme.example = colonMatch[1].trim();
        } else {
          currentTheme.example = trimmedLine.replace(/^- 発想例.*?[：:]?/, '').trim();
        }
      }
    }
  }
  
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

function formatDateFull(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function HistoryPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    loadGenerations();
  }, []);

  useEffect(() => {
    // 最初の履歴を自動選択
    if (generations.length > 0 && selectedId === null) {
      setSelectedId(generations[0].id);
    }
  }, [generations, selectedId]);

  const loadGenerations = async () => {
    try {
      const data = await getGenerations();
      setGenerations(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '履歴の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
        {error}
      </div>
    );
  }

  const selectedGeneration = generations.find((g) => g.id === selectedId);
  const selectedThemes = selectedGeneration ? parseThemes(selectedGeneration.themes) : [];

  return (
    <div className="flex gap-6 h-[calc(100vh-120px)]">
      {/* 左サイドメニュー - 履歴一覧 */}
      <div className="w-64 flex-shrink-0 overflow-y-auto">
        <h2 className="text-lg font-semibold mb-4 text-gray-300">生成履歴</h2>
        
        {generations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>履歴がありません</p>
          </div>
        ) : (
          <div className="space-y-2">
            {generations.map((generation) => {
              const themes = parseThemes(generation.themes);
              const isSelected = selectedId === generation.id;
              return (
                <button
                  key={generation.id}
                  onClick={() => setSelectedId(generation.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    isSelected
                      ? 'bg-indigo-900/40 border-indigo-500 shadow-lg'
                      : 'bg-gray-800/50 border-gray-700 hover:border-gray-600 hover:bg-gray-800'
                  }`}
                >
                  <div className="text-xs text-gray-400 mb-1">
                    {formatDate(generation.createdAt)}
                  </div>
                  <div className="text-xs text-indigo-400 mb-2">
                    {generation.llmProvider} / {generation.llmModel}
                  </div>
                  <div className="text-sm text-gray-300 truncate">
                    {themes[0]?.title || '(テーマなし)'}
                  </div>
                  {themes.length > 1 && (
                    <div className="text-xs text-gray-500 mt-1">
                      他 {themes.length - 1} 件
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 右側 - カードグリッド表示 */}
      <div className="flex-1 overflow-y-auto">
        {selectedGeneration ? (
          <div>
            {/* ヘッダー情報 */}
            <div className="mb-4">
              <div className="flex items-center justify-between">
                <div className="text-gray-400 text-sm">
                  {formatDateFull(selectedGeneration.createdAt)} | {selectedGeneration.llmProvider} / {selectedGeneration.llmModel} ({selectedThemes.length}件)
                </div>
                <button
                  onClick={() => setShowPrompt(!showPrompt)}
                  className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  {showPrompt ? 'プロンプトを隠す' : 'プロンプトを表示'}
                </button>
              </div>
              
              {/* プロンプト表示 */}
              {showPrompt && (
                <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
                  <h3 className="text-sm font-semibold text-indigo-400 mb-2">使用したプロンプト</h3>
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap max-h-64 overflow-y-auto">
                    {selectedGeneration.prompt}
                  </pre>
                </div>
              )}
            </div>

            {/* カードグリッド */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {selectedThemes.map((theme, index) => (
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
        ) : (
          <div className="flex items-center justify-center h-full text-gray-500">
            <p>左のリストから履歴を選択してください</p>
          </div>
        )}
      </div>
    </div>
  );
}
