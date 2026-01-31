import express, { Request, Response } from 'express';
import { db } from '../db/index.js';
import { generations } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

const router: express.Router = express.Router();

// 生成履歴一覧取得
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string || '50');
    const offset = parseInt(req.query.offset as string || '0');

    const results = await db
      .select()
      .from(generations)
      .orderBy(desc(generations.createdAt))
      .limit(limit)
      .offset(offset);

    res.json(results);
  } catch (error) {
    console.error('Error fetching generations:', error);
    res.status(500).json({ error: '履歴の取得に失敗しました' });
  }
});

// 特定の生成結果を取得
router.get('/:id', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    const result = await db
      .select()
      .from(generations)
      .where(eq(generations.id, id))
      .get();

    if (!result) {
      res.status(404).json({ error: '指定された生成結果が見つかりません' });
      return;
    }

    res.json(result);
  } catch (error) {
    console.error('Error fetching generation:', error);
    res.status(500).json({ error: '生成結果の取得に失敗しました' });
  }
});

export default router;
