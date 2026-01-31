import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';

import { initDatabase } from './db/index.js';
import { sessionMiddleware } from './auth/session.js';
import { setupPassport, passport } from './auth/passport.js';
import { loadAdmins } from './auth/admins.js';
import { initSocketIO, restoreCurrentLive } from './socket/index.js';

import generateRoute from './routes/generate.js';
import generationsRoute from './routes/generations.js';
import settingsRoute from './routes/settings.js';
import authRoute from './routes/auth.js';
import adminRoute from './routes/admin.js';
import ratingAxesRoute from './routes/rating-axes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// データベース初期化
initDatabase();

// 管理者一覧をロード（SUPER_ADMIN_DISCORD_ID含む）
const admins = loadAdmins();
console.log(`Loaded ${admins.length} admin(s)`);

// Passport設定
setupPassport();

const app = express();
const httpServer = createServer(app);

// プロキシを信頼（Cloudflare Tunnel経由のアクセス用）
// trueにすることで複数hopでも対応
app.set('trust proxy', true);

// Socket.IO初期化
const io = initSocketIO(httpServer);

// 現在のLIVEを復元
restoreCurrentLive();

// ミドルウェア
app.use(express.json());

// デバッグ：プロキシ情報とSet-Cookieをログ
app.use((req, res, next) => {
  if (req.path.includes('/auth')) {
    console.log('=== Request Debug ===');
    console.log('path:', req.path);
    console.log('x-forwarded-proto:', req.headers['x-forwarded-proto']);
    console.log('x-forwarded-host:', req.headers['x-forwarded-host']);
    console.log('req.secure:', req.secure);
    console.log('req.hostname:', req.hostname);
    console.log('Cookie header:', req.headers.cookie);
    console.log('====================');
    
    // Set-Cookieをログに出す
    res.on('finish', () => {
      const setCookie = res.getHeader('set-cookie');
      if (setCookie) {
        console.log('=== Set-Cookie sent ===');
        console.log('path:', req.path);
        console.log('Set-Cookie:', setCookie);
        console.log('=======================');
      }
    });
  }
  next();
});

app.use(cors({
  origin: process.env.WEB_ORIGIN || ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(sessionMiddleware);
app.use(passport.initialize());
app.use(passport.session());

// ルート
app.use('/api/generate', generateRoute);
app.use('/api/generations', generationsRoute);
app.use('/api/settings', settingsRoute);
app.use('/api/rating-axes', ratingAxesRoute);
app.use('/auth', authRoute);
app.use('/admin', adminRoute);

// ヘルスチェック
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// フロントエンドの静的ファイルを配信（production用）
const frontendDistPath = join(__dirname, '../../frontend/dist');
app.use(express.static(frontendDistPath));

// SPAフォールバック: API以外のルートはindex.htmlを返す
app.use((req, res, next) => {
  // APIルートは除外
  if (req.path.startsWith('/api/') || req.path.startsWith('/auth/') || req.path.startsWith('/admin/') || req.path.startsWith('/socket.io/')) {
    return next();
  }
  res.sendFile(join(frontendDistPath, 'index.html'));
});

const port = parseInt(process.env.SERVER_PORT || process.env.PORT || '3001');

httpServer.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
