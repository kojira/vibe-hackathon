import { useState, useEffect } from 'react';
import { getSettings, updateSettings, MODEL_OPTIONS } from '../lib/api';
import type { Settings, LLMProvider } from '../lib/api';

export function SettingsPage() {
  const [_settings, setSettings] = useState<Settings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // フォーム状態
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<LLMProvider>('openai');
  const [model, setModel] = useState('');
  const [openaiKey, setOpenaiKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const data = await getSettings();
      setSettings(data);
      setPrompt(data.prompt || '');
      setProvider((data.llm_provider as LLMProvider) || 'openai');
      setModel(data.llm_model || '');
      setOpenaiKey(data.openai_api_key || '');
      setAnthropicKey(data.anthropic_api_key || '');
      setGeminiKey(data.gemini_api_key || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の読み込みに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleProviderChange = (newProvider: LLMProvider) => {
    setProvider(newProvider);
    // プロバイダーが変更されたら、そのプロバイダーの最初のモデルを選択
    setModel(MODEL_OPTIONS[newProvider][0]);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await updateSettings({
        prompt,
        llm_provider: provider,
        llm_model: model,
        openai_api_key: openaiKey,
        anthropic_api_key: anthropicKey,
        gemini_api_key: geminiKey,
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : '設定の保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 border-t-transparent rounded-full"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">設定</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 bg-green-900/50 border border-green-700 rounded-lg text-green-200">
          設定を保存しました
        </div>
      )}

      <div className="space-y-8">
        {/* LLMプロバイダー選択 */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">LLMプロバイダー</h2>
          
          <div className="grid grid-cols-3 gap-4 mb-6">
            {(['openai', 'anthropic', 'gemini'] as LLMProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => handleProviderChange(p)}
                className={`p-4 rounded-lg border-2 transition-colors ${
                  provider === p
                    ? 'border-indigo-500 bg-indigo-900/30'
                    : 'border-gray-600 hover:border-gray-500'
                }`}
              >
                <div className="font-semibold capitalize">{p}</div>
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              モデル
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              {MODEL_OPTIONS[provider].map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* APIキー設定 */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">APIキー</h2>
          <p className="text-gray-400 text-sm mb-4">
            使用するプロバイダーのAPIキーを設定してください。環境変数でも設定可能です。
          </p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                OpenAI API Key
              </label>
              <input
                type="password"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Anthropic API Key
              </label>
              <input
                type="password"
                value={anthropicKey}
                onChange={(e) => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Google AI API Key
              </label>
              <input
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIza..."
                className="w-full p-3 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* プロンプト設定 */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-xl font-semibold mb-4">プロンプト</h2>
          <p className="text-gray-400 text-sm mb-4">
            テーマ生成に使用するプロンプトを編集できます。
          </p>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={20}
            className="w-full p-4 bg-gray-700 border border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
          />
        </section>

        {/* 保存ボタン */}
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {isSaving ? '保存中...' : '設定を保存'}
          </button>
        </div>
      </div>
    </div>
  );
}
