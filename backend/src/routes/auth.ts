import express, { Request, Response, NextFunction } from 'express';
import { passport } from '../auth/passport.js';
import { isAdmin } from '../auth/admins.js';
import { DiscordUser } from '../auth/passport.js';

const router: express.Router = express.Router();

// 最近ログインしたユーザー（メモリ保持）
const recentUsers = new Map<string, { discordId: string; username: string; lastSeenAt: string }>();

// 最近のユーザーを取得（管理画面用）
export function getRecentUsers() {
  return Array.from(recentUsers.values())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .slice(0, 50);
}

// ユーザーを記録
function recordUser(user: DiscordUser) {
  recentUsers.set(user.discordId, {
    discordId: user.discordId,
    username: user.username,
    lastSeenAt: new Date().toISOString(),
  });
}

// 合言葉検証
router.post('/passphrase', (req: Request, res: Response) => {
  const { passphrase } = req.body;
  const correctPassphrase = process.env.EVENT_PASSPHRASE;

  if (!correctPassphrase) {
    res.status(500).json({ ok: false, error: '合言葉が設定されていません' });
    return;
  }

  if (passphrase === correctPassphrase) {
    req.session.passOk = true;
    // セッションを明示的に保存
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        res.status(500).json({ ok: false, error: 'セッション保存エラー' });
        return;
      }
      res.json({ ok: true });
    });
  } else {
    res.status(401).json({ ok: false, error: '合言葉が違います' });
  }
});

// Discord OAuth開始
router.get('/discord', (req: Request, res: Response, next: NextFunction) => {
  console.log('Starting Discord OAuth, Session ID:', req.sessionID);
  // セッションを明示的に保存してからOAuthを開始
  req.session.save((err) => {
    if (err) {
      console.error('Session save error before OAuth:', err);
    }
    console.log('Session saved, proceeding to Discord OAuth');
    next();
  });
}, passport.authenticate('discord'));

// Discord OAuthコールバック
router.get('/discord/callback',
  passport.authenticate('discord', { failureRedirect: '/gate?error=auth_failed' }),
  (req: Request, res: Response) => {
    console.log('Discord callback received, Session ID:', req.sessionID);
    // Passportからユーザー情報を取得してセッションに保存
    const user = req.user as DiscordUser;
    console.log('User from passport:', user);
    if (user) {
      req.session.user = {
        discordId: user.discordId,
        username: user.username,
        discriminator: user.discriminator,
        avatar: user.avatar,
      };
      recordUser(user);
    }

    console.log('Session before save:', req.session);
    // セッションを明示的に保存してからリダイレクト
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
      }
      // 相対パスでリダイレクト（ホスト揺れを避ける）
      console.log('Redirecting to: /gate, Session ID:', req.sessionID);
      res.redirect('/gate');
    });
  }
);

// ログアウト
router.post('/logout', (req: Request, res: Response) => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ ok: false, error: 'ログアウトに失敗しました' });
      return;
    }
    res.json({ ok: true });
  });
});

// 現在の認証状態を取得
router.get('/me', (req: Request, res: Response) => {
  console.log('GET /auth/me - Session ID:', req.sessionID);
  console.log('GET /auth/me - Session:', req.session);
  const user = req.session.user;
  const passOk = req.session.passOk || false;
  const loggedIn = !!user;
  const adminStatus = user ? isAdmin(user.discordId) : false;

  res.json({
    passOk,
    loggedIn,
    isAdmin: adminStatus,
    user: user || null,
  });
});

export default router;
