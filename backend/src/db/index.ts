import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema.js';

const sqlite = new Database('./data.db');
export const db = drizzle(sqlite, { schema });

// データベースの初期化（テーブル作成）
export function initDatabase() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS generations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      themes TEXT NOT NULL,
      prompt TEXT NOT NULL,
      llm_provider TEXT NOT NULL,
      llm_model TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS presentations (
      id TEXT PRIMARY KEY,
      discord_id TEXT NOT NULL,
      username TEXT NOT NULL,
      avatar TEXT,
      title TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS lives (
      id TEXT PRIMARY KEY,
      presentation_id TEXT,
      title TEXT NOT NULL,
      presenter TEXT NOT NULL,
      presenter_discord_id TEXT,
      presenter_avatar TEXT,
      description TEXT,
      started_at TEXT NOT NULL,
      ended_at TEXT,
      results_published INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ratings (
      id TEXT PRIMARY KEY,
      live_id TEXT NOT NULL,
      judge_id TEXT NOT NULL,
      judge_name TEXT NOT NULL,
      scores TEXT NOT NULL,
      comment TEXT,
      submitted_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rating_axes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      label TEXT NOT NULL,
      "order" INTEGER NOT NULL
    );
  `);

  // デフォルトのプロンプトを設定
  const defaultPrompt = `あなたはハッカソンで作成するもののテーマ生成AIです。

前提：

以下から必ず1つずつ選び、
テーマを1つ生成してください。

既存のプロダクトに選択された制限をかけて自由に開発してもらう


【A. プロダクトジャンル】
- SNS
- ショッピング
- マーケットプレイス
- マッチング
- キュレーション
- アンケート
- チャットボット
- ツール
  - テキストエディタ
  - リマインダー
  - タスク管理
  - ホワイトボード
  - 自動化
  - エージェント
  - カレンダー
  - イベント受付
- コミュニティ
- ファシリテータ

【B. 扱う対象】
- モノ
- ニュース
- 感情
- 時間
- 画像
- スキル
- アイデア
- 意見
- 価値
- 絵文字
- 位置
- お腹の減り具合
- 楽しい
- 嬉しい
- わくわく
- さみしい
- その他あなたが自分で考えたもの(数値化や文章化しにくかったり扱いにくいものを選ばないこと)

【C. 意外性のある組み合わせ】

上記A、Bの2つに加えてあなたが選ぶ意外性のある要素を発想例として追加する。

以下のうち必ず1つを破壊あるいは変換する制限として定義すること。ただし仕様としてベースのコンセプトと矛盾して利便性を損なわないこと。
- 入力（何を入力できるか）
- 表示（何が見えるか）
- 時間（いつ見えるか）
- 順序（通常の前後関係）
- 自由度（選択肢の多さ）

何らかの課題を解決できて利便性のある内容にすること

例)
- お腹の減りぐあいを音で表現する

出力内容：

曖昧な点がなく、すぐにイメージが実現できる内容にしてください。
仕様が理解しにくいものは避けてください。
必ず短時間で扱いやすいデータがすべて揃っていることが必須です。

組み合わせから考えられるテーマ1つ
発想例はイメージしやすいように具体的に書くこと
プロダクト名は書かないで。
参加者が理解できるように情緒的なものや抽象的過ぎる内容は避けること
参加者が画面に映されたテーマを見て直ぐに内容を理解できるように簡潔に書くこと
仕様に破綻がないようにしてください

以下の例のようにシンプルに結果だけ出力してください

この出力を5個してください
10個のなかで3個以上はBをあなたが独自で考えてください。

例)
- テーマ：時間 x SNS
  - 発想例：投稿された文字が時間とともに砂のように落ちていく

- テーマ：お腹の減り具合 x SNS
  - 発想例：お腹の減りぐあいを音で表現すること

- テーマ：わくわく x ツール
  - 発想例：わくわくの価値を絵で表現すること`;

  // デフォルト設定が存在しない場合のみ挿入
  const existingPrompt = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('prompt');
  if (!existingPrompt) {
    sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('prompt', defaultPrompt);
  }

  const existingProvider = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('llm_provider');
  if (!existingProvider) {
    sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('llm_provider', 'openai');
  }

  const existingModel = sqlite.prepare('SELECT value FROM settings WHERE key = ?').get('llm_model');
  if (!existingModel) {
    sqlite.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('llm_model', 'gpt-5.2');
  }

  // デフォルトの評価軸を初期化
  const existingAxes = sqlite.prepare('SELECT COUNT(*) as count FROM rating_axes').get() as { count: number };
  if (existingAxes.count === 0) {
    const defaultAxes = [
      { key: 'technical', label: '技術力', order: 1 },
      { key: 'creativity', label: '創造性', order: 2 },
      { key: 'completeness', label: '完成度', order: 3 },
      { key: 'presentation', label: 'プレゼン', order: 4 },
      { key: 'impact', label: 'インパクト', order: 5 },
    ];
    const insertAxis = sqlite.prepare('INSERT INTO rating_axes (key, label, "order") VALUES (?, ?, ?)');
    for (const axis of defaultAxes) {
      insertAxis.run(axis.key, axis.label, axis.order);
    }
  }

  // マイグレーション: ratingsテーブルにcommentカラムを追加
  try {
    sqlite.exec('ALTER TABLE ratings ADD COLUMN comment TEXT');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }

  // マイグレーション: livesテーブルにresults_publishedカラムを追加
  try {
    sqlite.exec('ALTER TABLE lives ADD COLUMN results_published INTEGER DEFAULT 0');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }

  // マイグレーション: livesテーブルに新しいカラムを追加
  try {
    sqlite.exec('ALTER TABLE lives ADD COLUMN presentation_id TEXT');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }
  try {
    sqlite.exec('ALTER TABLE lives ADD COLUMN presenter_discord_id TEXT');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }
  try {
    sqlite.exec('ALTER TABLE lives ADD COLUMN presenter_avatar TEXT');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }
  try {
    sqlite.exec('ALTER TABLE lives ADD COLUMN description TEXT');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }

  // マイグレーション: ratingsテーブルにpresentation_idカラムを追加
  try {
    sqlite.exec('ALTER TABLE ratings ADD COLUMN presentation_id TEXT');
  } catch {
    // カラムが既に存在する場合はエラーになるが無視
  }

  // マイグレーション: ratingsテーブルのlive_idをNULL許可に変更
  // SQLiteではカラム制約を変更できないため、テーブルを再作成する
  try {
    // live_idがNOT NULLかチェック
    const tableInfo = sqlite.prepare("PRAGMA table_info(ratings)").all() as Array<{name: string; notnull: number}>;
    const liveIdColumn = tableInfo.find(col => col.name === 'live_id');
    
    if (liveIdColumn && liveIdColumn.notnull === 1) {
      console.log('Migrating ratings table to allow NULL live_id...');
      
      // 新しいテーブルを作成（live_idをNULL許可）
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS ratings_new (
          id TEXT PRIMARY KEY,
          live_id TEXT,
          presentation_id TEXT,
          judge_id TEXT NOT NULL,
          judge_name TEXT NOT NULL,
          scores TEXT NOT NULL,
          comment TEXT,
          submitted_at TEXT NOT NULL
        )
      `);
      
      // データをコピー
      sqlite.exec(`
        INSERT INTO ratings_new (id, live_id, presentation_id, judge_id, judge_name, scores, comment, submitted_at)
        SELECT id, live_id, presentation_id, judge_id, judge_name, scores, comment, submitted_at
        FROM ratings
      `);
      
      // 古いテーブルを削除
      sqlite.exec('DROP TABLE ratings');
      
      // 新しいテーブルをリネーム
      sqlite.exec('ALTER TABLE ratings_new RENAME TO ratings');
      
      console.log('Migration completed: ratings.live_id is now nullable');
    }
  } catch (error) {
    console.error('Migration error:', error);
  }
}
