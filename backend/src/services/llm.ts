import { generateText } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export type LLMProvider = 'openai' | 'anthropic' | 'gemini';

export interface LLMConfig {
  provider: LLMProvider;
  model: string;
  apiKey?: string;
}

// プロバイダーごとのモデルリスト（2026年1月現在）
export const MODEL_OPTIONS: Record<LLMProvider, string[]> = {
  openai: ['gpt-5.2', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-4.1-mini', 'gpt-4o', 'gpt-4o-mini'],
  anthropic: ['claude-sonnet-4-5-20250929', 'claude-haiku-4-5-20251001', 'claude-opus-4-5-20251101'],
  gemini: ['gemini-3-pro-preview', 'gemini-3-flash-preview', 'gemini-1.5-pro', 'gemini-1.5-flash'],
};

export async function generateThemes(
  prompt: string,
  config: LLMConfig
): Promise<string> {
  const { provider, model, apiKey } = config;

  let llmModel;

  switch (provider) {
    case 'openai': {
      const openai = createOpenAI({
        apiKey: apiKey || process.env.OPENAI_API_KEY,
      });
      llmModel = openai(model);
      break;
    }
    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
      });
      llmModel = anthropic(model);
      break;
    }
    case 'gemini': {
      const google = createGoogleGenerativeAI({
        apiKey: apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY,
      });
      llmModel = google(model);
      break;
    }
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }

  const result = await generateText({
    model: llmModel,
    prompt: prompt,
  });

  return result.text;
}
