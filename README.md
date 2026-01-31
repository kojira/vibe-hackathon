# Vibe Theme Generator + リアルタイム審査システム

ハッカソンのテーマ生成とリアルタイム審査を行うシステムです。

## アーキテクチャ

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Pages   │────▶│ Cloudflare       │────▶│    Discord      │
│  (Frontend)     │     │ Workers (OAuth)  │     │    API          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
         │
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Nostr Relays                               │
│  wss://r.kojira.io   wss://x.kojira.io   wss://yabu.me         │
└─────────────────────────────────────────────────────────────────┘
```

- **フロントエンド**: GitHub Pages（静的サイト）
- **認証**: Cloudflare Workers（Discord OAuth）
- **データストア**: Nostr Relays（分散型）
- **サーバー運用コスト**: 0円

## 機能

### リアルタイム審査システム
- Nostrプロトコルによるリアルタイム通信
- Discord OAuthによるユーザー認証
- パスワードによるNostr秘密鍵生成（ユーザーはNostrを意識しない）
- カスタマイズ可能な評価軸
- 審査結果の永続化（複数リレーにレプリケーション）

### テーマ生成機能（管理者専用・レガシーモード）
- LLM（OpenAI/Anthropic/Gemini）によるテーマ生成
- 履歴管理
- プロンプトカスタマイズ

## 画面構成

| ルート | 説明 | アクセス権限 |
|--------|------|------------|
| `/gate` | ログイン | 誰でも |
| `/judge` | 審査画面 | ログイン済み |
| `/me` | ログイン状態確認 | 誰でも |

## セットアップ

### 1. 依存関係のインストール

```bash
pnpm install
```

### 2. Cloudflare Workers のセットアップ

```bash
./scripts/setup-workers.sh
```

このスクリプトは以下を行います:
1. wrangler CLIのログイン
2. 依存関係のインストール
3. 環境変数（Secrets）の設定
4. Workersのデプロイ

### 3. Discord Developer Portal での設定

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリック
3. アプリケーション名を入力して作成
4. 左メニューの「OAuth2」を選択
5. 「Client ID」と「Client Secret」をメモ
6. 「Redirects」に以下を追加:
   - `https://<your-worker>.workers.dev/auth/discord/callback`

### 4. フロントエンドの設定

```bash
cp frontend/.env.example frontend/.env
```

`frontend/.env` を編集:

```env
VITE_WORKERS_URL=https://vibe-theme-generator-auth.your-account.workers.dev
```

### 5. ローカル開発

```bash
# フロントエンドのみ（Nostrモード）
cd frontend && pnpm dev
```

## デプロイ

### 自動デプロイ（GitHub Actions）

mainブランチにpushすると自動でデプロイされます。

**必要なSecrets（GitHubリポジトリ設定）:**
- `CLOUDFLARE_API_TOKEN`: Cloudflare APIトークン
- `WORKERS_URL`: Workers URL（例: `https://vibe-theme-generator-auth.xxx.workers.dev`）

### 手動デプロイ

```bash
./scripts/deploy.sh all
```

または個別に:

```bash
./scripts/deploy.sh workers   # Cloudflare Workers
./scripts/deploy.sh frontend  # GitHub Pages
```

## 技術スタック

### フロントエンド
- React 19 + TypeScript
- Vite
- Tailwind CSS
- rx-nostr（Nostrクライアント）
- React Router

### バックエンド（サーバーレス）
- Cloudflare Workers（Discord OAuth）
- Nostr Relays（データストア）

### 使用リレー
- `wss://r.kojira.io`
- `wss://x.kojira.io`
- `wss://yabu.me`

## 認証フロー

```
1. ユーザーが「Discordでログイン」をクリック
2. Cloudflare Workers → Discord OAuth
3. Workers が JWTトークンを発行
4. フロントエンドでパスワード入力
5. Discord ID + パスワード → Nostr秘密鍵を生成
6. Nostr秘密鍵でデータの署名・検証
```

**重要**: パスワードを忘れると過去のデータにアクセスできなくなります。

## Nostrイベント設計

Kind 30078（カスタムアプリデータ）を使用:

### イベント（審査会）
```json
{
  "kind": 30078,
  "tags": [["d", "vibe:event:<id>"], ["app", "vibe-theme-generator"]],
  "content": "{\"title\":\"...\",\"ratingAxes\":[...]}"
}
```

### プレゼンテーション
```json
{
  "kind": 30078,
  "tags": [["d", "vibe:presentation:<id>"], ["e", "<event_id>"], ["app", "vibe-theme-generator"]],
  "content": "{\"title\":\"...\",\"presenterName\":\"...\"}"
}
```

### 審査
```json
{
  "kind": 30078,
  "tags": [["d", "vibe:rating:<presentation_id>:<judge_pubkey>"], ["e", "<presentation_id>"], ["app", "vibe-theme-generator"]],
  "content": "{\"scores\":{...},\"comment\":\"...\"}"
}
```

## レガシーモード（バックエンドサーバー使用）

従来のExpress + Socket.IO + SQLiteバックエンドを使用する場合:

```bash
# 環境変数設定
export VITE_USE_LEGACY_BACKEND=true

# バックエンドとフロントエンドを起動
pnpm dev
```

詳細は `backend/README.md` を参照してください。

## 注意事項

- パスワードを忘れるとNostr秘密鍵を復元できず、過去のデータにアクセスできなくなります
- Nostrリレーの可用性に依存します
- リレー上のデータは公開されます（暗号化が必要な場合は別途対応）

## ライセンス

MIT
