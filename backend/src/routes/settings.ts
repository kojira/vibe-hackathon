import express, { Request, Response } from 'express';
import { db } from '../db/index.js';
import { settings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { MODEL_OPTIONS, LLMProvider } from '../services/llm.js';

const router: express.Router = express.Router();

// 設定取得
router.get('/', async (_req: Request, res: Response) => {
  try {
    const allSettings = await db.select().from(settings);
    
    // 設定をオブジェクトに変換
    const settingsObj: Record<string, string> = {};
    for (const setting of allSettings) {
      // APIキーは隠す（存在確認のみ）
      if (setting.key.endsWith('_api_key')) {
        settingsObj[setting.key] = setting.value ? '***' : '';
      } else {
        settingsObj[setting.key] = setting.value;
      }
    }

    res.json(settingsObj);
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({ error: '設定の取得に失敗しました' });
  }
});

// 設定更新
router.put('/', async (req: Request, res: Response) => {
  try {
    const body = req.body;

    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') continue;
      
      // 空のAPIキーは更新しない（既存のキーを保持）
      if (key.endsWith('_api_key') && value === '***') continue;

      // 既存の設定を確認
      const existing = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .get();

      if (existing) {
        await db
          .update(settings)
          .set({ value })
          .where(eq(settings.key, key));
      } else {
        await db.insert(settings).values({ key, value });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({ error: '設定の更新に失敗しました' });
  }
});

// 利用可能なモデル一覧を取得
router.get('/models', (_req: Request, res: Response) => {
  res.json(MODEL_OPTIONS);
});

// 特定のプロバイダーのモデル一覧
router.get('/models/:provider', (req: Request<{ provider: string }>, res: Response) => {
  const provider = req.params.provider as LLMProvider;
  
  if (!MODEL_OPTIONS[provider]) {
    res.status(400).json({ error: '不明なプロバイダーです' });
    return;
  }

  res.json(MODEL_OPTIONS[provider]);
});

export default router;
