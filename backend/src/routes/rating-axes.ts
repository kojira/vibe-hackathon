import express, { Request, Response } from 'express';
import { db } from '../db/index.js';
import { ratingAxes } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { requireAdmin } from '../auth/middleware.js';

const router: express.Router = express.Router();

// 評価軸一覧を取得（認証不要）
router.get('/', async (_req: Request, res: Response) => {
  try {
    const axes = await db.select()
      .from(ratingAxes)
      .orderBy(ratingAxes.order)
      .all();
    res.json({ axes });
  } catch (error) {
    console.error('Error fetching rating axes:', error);
    res.status(500).json({ error: '評価軸の取得に失敗しました' });
  }
});

// 評価軸を追加（管理者のみ）
router.post('/', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { key, label, order } = req.body;

    if (!key || !label || order === undefined) {
      res.status(400).json({ error: 'key, label, orderが必要です' });
      return;
    }

    await db.insert(ratingAxes).values({ key, label, order });
    res.json({ ok: true });
  } catch (error) {
    console.error('Error adding rating axis:', error);
    res.status(500).json({ error: '評価軸の追加に失敗しました' });
  }
});

// 評価軸を更新（管理者のみ）
router.put('/:id', requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const { key, label, order } = req.body;

    const updates: Partial<{ key: string; label: string; order: number }> = {};
    if (key !== undefined) updates.key = key;
    if (label !== undefined) updates.label = label;
    if (order !== undefined) updates.order = order;

    await db.update(ratingAxes)
      .set(updates)
      .where(eq(ratingAxes.id, id));

    res.json({ ok: true });
  } catch (error) {
    console.error('Error updating rating axis:', error);
    res.status(500).json({ error: '評価軸の更新に失敗しました' });
  }
});

// 評価軸を削除（管理者のみ）
router.delete('/:id', requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  try {
    const id = parseInt(req.params.id);

    await db.delete(ratingAxes)
      .where(eq(ratingAxes.id, id));

    res.json({ ok: true });
  } catch (error) {
    console.error('Error deleting rating axis:', error);
    res.status(500).json({ error: '評価軸の削除に失敗しました' });
  }
});

// デフォルトにリセット（管理者のみ）
router.post('/reset', requireAdmin, async (_req: Request, res: Response) => {
  try {
    // 全て削除
    await db.delete(ratingAxes);

    // デフォルトを再挿入
    const defaultAxes = [
      { key: 'technical', label: '技術力', order: 1 },
      { key: 'creativity', label: '創造性', order: 2 },
      { key: 'completeness', label: '完成度', order: 3 },
      { key: 'presentation', label: 'プレゼン', order: 4 },
      { key: 'impact', label: 'インパクト', order: 5 },
    ];

    for (const axis of defaultAxes) {
      await db.insert(ratingAxes).values(axis);
    }

    res.json({ ok: true });
  } catch (error) {
    console.error('Error resetting rating axes:', error);
    res.status(500).json({ error: '評価軸のリセットに失敗しました' });
  }
});

export default router;
