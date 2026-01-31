// APIクライアント - Vibe Theme Generator

const API_BASE = '/api';

// 型定義
export interface Generation {
  id: number;
  themes: string;
  prompt: string;
  llmProvider: string;
  llmModel: string;
  createdAt: string;
}

export interface Settings {
  prompt: string;
  llm_provider: string;
  llm_model: string;
  openai_api_key?: string;
  anthropic_api_key?: string;
  gemini_api_key?: string;
}

export interface GenerateResponse {
  id: number;
  themes: string;
  provider: string;
  model: string;
  createdAt: string;
}

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  openai: ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-5-20251101'],
  gemini: ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

// テーマ生成
export async function generateThemes(): Promise<GenerateResponse> {
  const response = await fetch(`${API_BASE}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'テーマの生成に失敗しました');
  }

  return response.json();
}

// 生成履歴取得
export async function getGenerations(limit = 50, offset = 0): Promise<Generation[]> {
  const response = await fetch(`${API_BASE}/generations?limit=${limit}&offset=${offset}`);

  if (!response.ok) {
    throw new Error('履歴の取得に失敗しました');
  }

  return response.json();
}

// 特定の生成結果を取得
export async function getGeneration(id: number): Promise<Generation> {
  const response = await fetch(`${API_BASE}/generations/${id}`);

  if (!response.ok) {
    throw new Error('生成結果の取得に失敗しました');
  }

  return response.json();
}

// 設定取得
export async function getSettings(): Promise<Settings> {
  const response = await fetch(`${API_BASE}/settings`);

  if (!response.ok) {
    throw new Error('設定の取得に失敗しました');
  }

  return response.json();
}

// 設定更新
export async function updateSettings(settings: Partial<Settings>): Promise<void> {
  const response = await fetch(`${API_BASE}/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(settings),
  });

  if (!response.ok) {
    throw new Error('設定の更新に失敗しました');
  }
}
