import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { v4 as uuidv4 } from 'uuid';
import { sessionMiddleware } from '../auth/session.js';
import { isAdmin } from '../auth/admins.js';
import { db } from '../db/index.js';
import { lives, ratings, ratingAxes, presentations, Live, Rating, Presentation } from '../db/schema.js';
import { eq, desc } from 'drizzle-orm';

// 現在のLIVE（メモリキャッシュ）
let currentLive: Live | null = null;

// セッションデータの型
interface SessionUser {
  discordId: string;
  username: string;
  discriminator?: string;
  avatar?: string;
}

// 拡張されたSocket型
interface AuthenticatedSocket extends Socket {
  request: Socket['request'] & {
    session?: {
      passOk?: boolean;
      user?: SessionUser;
    };
  };
}

// Socket.IOサーバーを初期化
export function initSocketIO(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.WEB_ORIGIN || ['http://localhost:5173', 'http://localhost:3000'],
      credentials: true,
    },
  });

  // セッションミドルウェアをSocket.IOに統合
  io.use((socket, next) => {
    sessionMiddleware(socket.request as never, {} as never, next as never);
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    const session = socket.request.session;
    const user = session?.user;
    const passOk = session?.passOk || false;
    const loggedIn = !!user;
    const adminStatus = user ? isAdmin(user.discordId) : false;

    console.log(`Socket connected: ${socket.id}, user: ${user?.username || 'anonymous'}`);

    // 接続時に認証状態を送信
    socket.emit('auth_state', {
      passOk,
      loggedIn,
      isAdmin: adminStatus,
      user: user || null,
    });

    // 現在のLIVEを取得
    socket.on('get_current_live', async () => {
      socket.emit('current_live', { live: currentLive });
    });

    // LIVE設定（管理者のみ）- 手動入力または発表登録から
    socket.on('set_live', async (data: { title: string; presenter: string; presentationId?: string }) => {
      // 権限チェック
      if (!passOk || !loggedIn || !adminStatus) {
        socket.emit('set_live_denied', { reason: '管理者権限が必要です' });
        return;
      }

      let { title, presenter } = data;
      let presenterDiscordId: string | null = null;
      let presenterAvatar: string | null = null;
      let description: string | null = null;
      let presentationId: string | null = null;

      // 発表登録からLIVEを作成する場合
      if (data.presentationId) {
        const presentation = await db.select()
          .from(presentations)
          .where(eq(presentations.id, data.presentationId))
          .get();

        if (presentation) {
          presentationId = presentation.id;
          title = presentation.title;
          presenter = presentation.username;
          presenterDiscordId = presentation.discordId;
          presenterAvatar = presentation.avatar;
          description = presentation.description;
        }
      }

      // 現在のLIVEがあれば終了
      if (currentLive) {
        await db.update(lives)
          .set({ endedAt: new Date().toISOString() })
          .where(eq(lives.id, currentLive.id));
      }

      // 新しいLIVEを作成
      const newLive: Live = {
        id: uuidv4(),
        presentationId,
        title,
        presenter,
        presenterDiscordId,
        presenterAvatar,
        description,
        startedAt: new Date().toISOString(),
        endedAt: null,
        resultsPublished: 0,
      };

      await db.insert(lives).values(newLive);
      currentLive = newLive;

      // 全クライアントに通知
      io.emit('live_updated', { live: currentLive });
    });

    // 発表登録（ログインユーザーのみ）
    socket.on('register_presentation', async (data: { title: string; description?: string }) => {
      if (!passOk || !loggedIn || !user) {
        socket.emit('register_presentation_ack', { ok: false, reason: 'ログインが必要です' });
        return;
      }

      const newPresentation: Presentation = {
        id: uuidv4(),
        discordId: user.discordId,
        username: user.username,
        avatar: user.avatar || null,
        title: data.title,
        description: data.description || null,
        createdAt: new Date().toISOString(),
      };

      await db.insert(presentations).values(newPresentation);

      // 全クライアントに通知
      io.emit('presentation_registered', { presentation: newPresentation });

      socket.emit('register_presentation_ack', { ok: true, presentation: newPresentation });
    });

    // 発表登録一覧を取得
    socket.on('get_presentations', async () => {
      const list = await db.select()
        .from(presentations)
        .orderBy(desc(presentations.createdAt))
        .all();
      socket.emit('presentations', { presentations: list });
    });

    // 発表登録を削除（本人または管理者のみ）
    socket.on('delete_presentation', async (data: { presentationId: string }) => {
      if (!passOk || !loggedIn || !user) {
        socket.emit('delete_presentation_ack', { ok: false, reason: 'ログインが必要です' });
        return;
      }

      const presentation = await db.select()
        .from(presentations)
        .where(eq(presentations.id, data.presentationId))
        .get();

      if (!presentation) {
        socket.emit('delete_presentation_ack', { ok: false, reason: '発表が見つかりません' });
        return;
      }

      // 本人または管理者のみ削除可能
      if (presentation.discordId !== user.discordId && !adminStatus) {
        socket.emit('delete_presentation_ack', { ok: false, reason: '削除権限がありません' });
        return;
      }

      await db.delete(presentations).where(eq(presentations.id, data.presentationId));

      // 全クライアントに通知
      io.emit('presentation_deleted', { presentationId: data.presentationId });

      socket.emit('delete_presentation_ack', { ok: true });
    });

    // LIVE終了（管理者のみ）
    socket.on('end_live', async () => {
      if (!passOk || !loggedIn || !adminStatus) {
        socket.emit('set_live_denied', { reason: '管理者権限が必要です' });
        return;
      }

      if (currentLive) {
        await db.update(lives)
          .set({ endedAt: new Date().toISOString() })
          .where(eq(lives.id, currentLive.id));
        currentLive = null;
        io.emit('live_updated', { live: null });
      }
    });

    // 審査送信（LIVE用）
    socket.on('submit_rating', async (data: { liveId: string; scores: Record<string, number>; comment?: string }) => {
      // 権限チェック
      if (!passOk || !loggedIn) {
        socket.emit('rating_ack', { ok: false, reason: 'ログインが必要です' });
        return;
      }

      if (!currentLive || currentLive.id !== data.liveId) {
        socket.emit('rating_ack', { ok: false, reason: '無効なLIVE IDです' });
        return;
      }

      // 重複チェック
      const existing = await db.select()
        .from(ratings)
        .where(eq(ratings.liveId, data.liveId))
        .all();

      const alreadySubmitted = existing.some(r => r.judgeId === user!.discordId);
      if (alreadySubmitted) {
        socket.emit('rating_ack', { ok: false, reason: '既に送信済みです' });
        return;
      }

      // 審査結果を保存
      const newRating: Rating = {
        id: uuidv4(),
        liveId: data.liveId,
        presentationId: null,
        judgeId: user!.discordId,
        judgeName: user!.username,
        scores: JSON.stringify(data.scores),
        comment: data.comment || null,
        submittedAt: new Date().toISOString(),
      };

      await db.insert(ratings).values(newRating);

      socket.emit('rating_ack', { ok: true });
    });

    // プレゼンテーション審査送信
    socket.on('submit_presentation_rating', async (data: { presentationId: string; scores: Record<string, number>; comment?: string }) => {
      // 権限チェック
      if (!passOk || !loggedIn) {
        socket.emit('presentation_rating_ack', { ok: false, reason: 'ログインが必要です' });
        return;
      }

      // プレゼンテーションの存在確認
      const presentation = await db.select()
        .from(presentations)
        .where(eq(presentations.id, data.presentationId))
        .get();

      if (!presentation) {
        socket.emit('presentation_rating_ack', { ok: false, reason: '発表が見つかりません' });
        return;
      }

      // 重複チェック
      const existing = await db.select()
        .from(ratings)
        .where(eq(ratings.presentationId, data.presentationId))
        .all();

      const alreadySubmitted = existing.some(r => r.judgeId === user!.discordId);
      if (alreadySubmitted) {
        socket.emit('presentation_rating_ack', { ok: false, reason: '既に送信済みです' });
        return;
      }

      // 審査結果を保存
      const newRating: Rating = {
        id: uuidv4(),
        liveId: null,
        presentationId: data.presentationId,
        judgeId: user!.discordId,
        judgeName: user!.username,
        scores: JSON.stringify(data.scores),
        comment: data.comment || null,
        submittedAt: new Date().toISOString(),
      };

      await db.insert(ratings).values(newRating);

      // 全クライアントに通知（審査数更新用）
      io.emit('presentation_rating_submitted', { presentationId: data.presentationId });

      socket.emit('presentation_rating_ack', { ok: true });
    });

    // プレゼンテーション審査済みチェック
    socket.on('check_presentation_submitted', async (data: { presentationId: string }) => {
      if (!user) {
        socket.emit('presentation_submitted_status', { presentationId: data.presentationId, submitted: false });
        return;
      }

      const existing = await db.select()
        .from(ratings)
        .where(eq(ratings.presentationId, data.presentationId))
        .all();

      const submitted = existing.some(r => r.judgeId === user.discordId);
      socket.emit('presentation_submitted_status', { presentationId: data.presentationId, submitted });
    });

    // プレゼンテーション審査結果を取得（管理者のみ）
    socket.on('get_presentation_ratings', async (data: { presentationId: string }) => {
      if (!passOk || !loggedIn || !adminStatus) {
        socket.emit('presentation_ratings', { presentationId: data.presentationId, ratings: [], error: '管理者権限が必要です' });
        return;
      }

      const results = await db.select()
        .from(ratings)
        .where(eq(ratings.presentationId, data.presentationId))
        .all();

      const parsedResults = results.map(r => ({
        ...r,
        scores: JSON.parse(r.scores),
      }));

      socket.emit('presentation_ratings', { presentationId: data.presentationId, ratings: parsedResults });
    });

    // 評価軸を取得
    socket.on('get_rating_axes', async () => {
      const axes = await db.select()
        .from(ratingAxes)
        .orderBy(ratingAxes.order)
        .all();
      socket.emit('rating_axes', { axes });
    });

    // LIVE履歴を取得
    socket.on('get_live_history', async () => {
      const history = await db.select()
        .from(lives)
        .orderBy(desc(lives.startedAt))
        .limit(10)
        .all();
      socket.emit('live_history', { history });
    });

    // LIVE削除（管理者のみ）
    socket.on('delete_live', async (data: { liveId: string }) => {
      if (!passOk || !loggedIn || !adminStatus) {
        socket.emit('delete_live_ack', { ok: false, reason: '管理者権限が必要です' });
        return;
      }

      // 現在進行中のLIVEは削除不可
      if (currentLive && currentLive.id === data.liveId) {
        socket.emit('delete_live_ack', { ok: false, reason: '現在進行中のLIVEは削除できません。先に終了してください。' });
        return;
      }

      try {
        // 関連する審査結果を削除
        await db.delete(ratings).where(eq(ratings.liveId, data.liveId));
        
        // LIVEを削除
        await db.delete(lives).where(eq(lives.id, data.liveId));

        // 全クライアントに通知
        io.emit('live_deleted', { liveId: data.liveId });

        socket.emit('delete_live_ack', { ok: true });
      } catch (error) {
        console.error('Error deleting live:', error);
        socket.emit('delete_live_ack', { ok: false, reason: '削除に失敗しました' });
      }
    });

    // 結果公開（管理者のみ）
    socket.on('publish_results', async (data: { liveId: string }) => {
      if (!passOk || !loggedIn || !adminStatus) {
        socket.emit('publish_results_ack', { ok: false, reason: '管理者権限が必要です' });
        return;
      }

      // 対象のLIVEを取得
      const targetLive = await db.select()
        .from(lives)
        .where(eq(lives.id, data.liveId))
        .get();

      if (!targetLive) {
        socket.emit('publish_results_ack', { ok: false, reason: 'LIVEが見つかりません' });
        return;
      }

      // 結果を公開状態に更新
      await db.update(lives)
        .set({ resultsPublished: 1 })
        .where(eq(lives.id, data.liveId));

      // 全クライアントに通知
      io.emit('results_published', { liveId: data.liveId });

      socket.emit('publish_results_ack', { ok: true });
    });

    // 特定LIVEの審査結果を取得（管理者、または結果公開済みならアクセス可能）
    socket.on('get_ratings', async (data: { liveId: string }) => {
      // 対象のLIVEを取得
      const targetLive = await db.select()
        .from(lives)
        .where(eq(lives.id, data.liveId))
        .get();

      // 管理者でない場合は公開済みかどうかをチェック
      if (!adminStatus) {
        if (!targetLive || targetLive.resultsPublished !== 1) {
          socket.emit('ratings', { ratings: [], error: '結果はまだ公開されていません' });
          return;
        }
      }

      const results = await db.select()
        .from(ratings)
        .where(eq(ratings.liveId, data.liveId))
        .all();

      // scoresをパース
      const parsedResults = results.map(r => ({
        ...r,
        scores: JSON.parse(r.scores),
      }));

      socket.emit('ratings', { ratings: parsedResults });
    });

    // 自分が送信済みかチェック
    socket.on('check_submitted', async (data: { liveId: string }) => {
      if (!user) {
        socket.emit('submitted_status', { submitted: false });
        return;
      }

      const existing = await db.select()
        .from(ratings)
        .where(eq(ratings.liveId, data.liveId))
        .all();

      const submitted = existing.some(r => r.judgeId === user.discordId);
      socket.emit('submitted_status', { submitted });
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

// 起動時にcurrentLiveを復元
export async function restoreCurrentLive() {
  const activeLive = await db.select()
    .from(lives)
    .where(eq(lives.endedAt, ''))
    .orderBy(desc(lives.startedAt))
    .limit(1)
    .get();

  // endedAtがnullのLIVEを検索
  const allLives = await db.select()
    .from(lives)
    .orderBy(desc(lives.startedAt))
    .all();

  const lastActiveLive = allLives.find(l => !l.endedAt);
  if (lastActiveLive) {
    currentLive = lastActiveLive;
    console.log(`Restored current live: ${currentLive.title}`);
  }
}
