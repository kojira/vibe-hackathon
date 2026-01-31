import session from 'express-session';
import { RequestHandler } from 'express';
import Database from 'better-sqlite3';
// @ts-ignore
import SqliteStoreFactory from 'better-sqlite3-session-store';

const SqliteStore = SqliteStoreFactory(session);

// セッション用のDBを作成
const sessionDb = new Database('sessions.db');

// 環境に応じてCookie設定を切り替え
const webOrigin = process.env.WEB_ORIGIN || '';
const isHttps = webOrigin.startsWith('https://');

console.log('Session config:', { WEB_ORIGIN: webOrigin, isHttps });

export const sessionMiddleware: RequestHandler = session({
  name: 'sid', // Cookie名を明示
  store: new SqliteStore({
    client: sessionDb,
    expired: {
      clear: true,
      intervalMs: 900000, // 15分ごとに期限切れセッションを削除
    },
  }),
  secret: process.env.SESSION_SECRET || 'change_me_in_production',
  resave: false,
  saveUninitialized: false,
  proxy: true, // リバースプロキシ配下でsecure cookieを正しく扱う
  cookie: {
    secure: isHttps,
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24, // 24時間
    sameSite: 'lax',
    path: '/', // 明示
  },
});
