import express, { Request, Response } from 'express';
import { requireAdmin } from '../auth/middleware.js';
import { loadAdmins, addAdmin, removeAdmin } from '../auth/admins.js';
import { getRecentUsers } from './auth.js';

const router: express.Router = express.Router();

// すべての管理者ルートは admin 権限が必要
router.use(requireAdmin);

// 管理者一覧を取得
router.get('/list', (_req: Request, res: Response) => {
  const admins = loadAdmins();
  res.json({ admins });
});

// 管理者を追加
router.post('/add', (req: Request, res: Response) => {
  const { discordId } = req.body;

  if (!discordId || typeof discordId !== 'string') {
    res.status(400).json({ ok: false, error: 'discordIdが必要です' });
    return;
  }

  const added = addAdmin(discordId);
  if (added) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false, error: '既に管理者です' });
  }
});

// 管理者を削除
router.post('/remove', (req: Request, res: Response) => {
  const { discordId } = req.body;

  if (!discordId || typeof discordId !== 'string') {
    res.status(400).json({ ok: false, error: 'discordIdが必要です' });
    return;
  }

  // SUPER_ADMINは削除不可
  if (discordId === process.env.SUPER_ADMIN_DISCORD_ID) {
    res.status(403).json({ ok: false, error: 'スーパー管理者は削除できません' });
    return;
  }

  const removed = removeAdmin(discordId);
  if (removed) {
    res.json({ ok: true });
  } else {
    res.status(400).json({ ok: false, error: '管理者ではありません' });
  }
});

// 最近ログインしたユーザー一覧
router.get('/recent-users', (_req: Request, res: Response) => {
  const users = getRecentUsers();
  res.json({ users });
});

export default router;
