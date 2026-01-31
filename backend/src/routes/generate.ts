import express, { Request, Response } from 'express';
import { db } from '../db/index.js';
import { generations, settings } from '../db/schema.js';
import { generateThemes, LLMProvider } from '../services/llm.js';
import { eq } from 'drizzle-orm';

const router: express.Router = express.Router();

// テーマ生成API
router.post('/', async (_req: Request, res: Response) => {
  try {
    // 設定を取得
    const promptSetting = await db.select().from(settings).where(eq(settings.key, 'prompt')).get();
    const providerSetting = await db.select().from(settings).where(eq(settings.key, 'llm_provider')).get();
    const modelSetting = await db.select().from(settings).where(eq(settings.key, 'llm_model')).get();

    if (!promptSetting || !providerSetting || !modelSetting) {
      res.status(400).json({ error: '設定が見つかりません' });
      return;
    }

    const prompt = promptSetting.value;
    const provider = providerSetting.value as LLMProvider;
    const model = modelSetting.value;

    // APIキーを取得（設定から）
    const apiKeySetting = await db.select().from(settings).where(eq(settings.key, `${provider}_api_key`)).get();
    const apiKey = apiKeySetting?.value;

    console.log('========================================');
    console.log('テーマ生成リクエスト');
    console.log('Provider:', provider);
    console.log('Model:', model);
    console.log('========================================');

    // テーマを生成
    const themesText = await generateThemes(prompt, {
      provider,
      model,
      apiKey,
    });

    console.log('========================================');
    console.log('LLMレスポンス (raw):');
    console.log('========================================');
    console.log(themesText);
    console.log('========================================');
    console.log('レスポンス長:', themesText.length, '文字');
    console.log('========================================');

    // データベースに保存
    const result = await db.insert(generations).values({
      themes: themesText,
      prompt,
      llmProvider: provider,
      llmModel: model,
      createdAt: new Date().toISOString(),
    }).returning();

    res.json({
      id: result[0].id,
      themes: themesText,
      provider,
      model,
      createdAt: result[0].createdAt,
    });
  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      error: error instanceof Error ? error.message : 'テーマの生成に失敗しました' 
    });
  }
});

export default router;
