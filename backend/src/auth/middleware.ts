import { Request, Response, NextFunction } from 'express';
import { isAdmin } from './admins.js';

// 合言葉が通過済みかチェック
export function requirePassphrase(req: Request, res: Response, next: NextFunction) {
  if (!req.session.passOk) {
    res.status(401).json({ error: '合言葉が必要です', code: 'PASSPHRASE_REQUIRED' });
    return;
  }
  next();
}

// Discordログイン済みかチェック
export function requireLogin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.passOk) {
    res.status(401).json({ error: '合言葉が必要です', code: 'PASSPHRASE_REQUIRED' });
    return;
  }
  if (!req.session.user) {
    res.status(401).json({ error: 'ログインが必要です', code: 'LOGIN_REQUIRED' });
    return;
  }
  next();
}

// 管理者かチェック
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.passOk) {
    res.status(401).json({ error: '合言葉が必要です', code: 'PASSPHRASE_REQUIRED' });
    return;
  }
  if (!req.session.user) {
    res.status(401).json({ error: 'ログインが必要です', code: 'LOGIN_REQUIRED' });
    return;
  }
  if (!isAdmin(req.session.user.discordId)) {
    res.status(403).json({ error: '管理者権限が必要です', code: 'ADMIN_REQUIRED' });
    return;
  }
  next();
}
