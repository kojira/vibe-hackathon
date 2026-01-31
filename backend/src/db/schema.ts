import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// 生成結果テーブル
export const generations = sqliteTable('generations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  themes: text('themes').notNull(), // JSON配列として保存
  prompt: text('prompt').notNull(),
  llmProvider: text('llm_provider').notNull(),
  llmModel: text('llm_model').notNull(),
  createdAt: text('created_at').notNull().default(new Date().toISOString()),
});

// 設定テーブル
export const settings = sqliteTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

// 発表登録テーブル
export const presentations = sqliteTable('presentations', {
  id: text('id').primaryKey(),
  discordId: text('discord_id').notNull(),
  username: text('username').notNull(),
  avatar: text('avatar'),  // Discord avatar hash
  title: text('title').notNull(),
  description: text('description'),  // 概要
  createdAt: text('created_at').notNull(),
});

// LIVE（発表）テーブル
export const lives = sqliteTable('lives', {
  id: text('id').primaryKey(),
  presentationId: text('presentation_id'),  // 発表登録への参照（任意）
  title: text('title').notNull(),
  presenter: text('presenter').notNull(),
  presenterDiscordId: text('presenter_discord_id'),  // 発表者のDiscord ID
  presenterAvatar: text('presenter_avatar'),  // 発表者のアバター
  description: text('description'),  // 概要
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),  // LIVE終了時に設定
  resultsPublished: integer('results_published').default(0),  // 0:非公開, 1:公開
});

// 審査結果テーブル
export const ratings = sqliteTable('ratings', {
  id: text('id').primaryKey(),
  liveId: text('live_id'),                  // LIVE審査用（任意）
  presentationId: text('presentation_id'),  // プレゼンテーション審査用（任意）
  judgeId: text('judge_id').notNull(),      // Discord ID
  judgeName: text('judge_name').notNull(),  // Discord username
  scores: text('scores').notNull(),         // JSON文字列
  comment: text('comment'),                 // 審査コメント（任意）
  submittedAt: text('submitted_at').notNull(),
});

// 評価軸テーブル
export const ratingAxes = sqliteTable('rating_axes', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),      // 例: 'technical'
  label: text('label').notNull(),           // 例: '技術力'
  order: integer('order').notNull(),        // 表示順
});

// 型定義
export type Generation = typeof generations.$inferSelect;
export type NewGeneration = typeof generations.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;
export type Presentation = typeof presentations.$inferSelect;
export type NewPresentation = typeof presentations.$inferInsert;
export type Live = typeof lives.$inferSelect;
export type NewLive = typeof lives.$inferInsert;
export type Rating = typeof ratings.$inferSelect;
export type NewRating = typeof ratings.$inferInsert;
export type RatingAxis = typeof ratingAxes.$inferSelect;
export type NewRatingAxis = typeof ratingAxes.$inferInsert;
