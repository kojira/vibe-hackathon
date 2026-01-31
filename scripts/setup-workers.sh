#!/bin/bash
# Cloudflare Workers セットアップスクリプト
# 使用方法: ./scripts/setup-workers.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
WORKERS_DIR="$PROJECT_ROOT/workers"

echo "==================================="
echo "Cloudflare Workers セットアップ"
echo "==================================="
echo ""

# wrangler CLI インストール確認
echo "1. wrangler CLI の確認..."
if ! command -v wrangler &> /dev/null; then
    echo "   wrangler がインストールされていません。"
    echo "   グローバルインストール: npm install -g wrangler"
    echo "   または workers/ 内でローカルインストールします。"
fi

# workers ディレクトリに移動
cd "$WORKERS_DIR"

# 依存関係インストール
echo ""
echo "2. 依存関係のインストール..."
if [ -f "package.json" ]; then
    npm install
    echo "   完了！"
else
    echo "   エラー: package.json が見つかりません"
    exit 1
fi

# Cloudflare ログイン確認
echo ""
echo "3. Cloudflare アカウントへのログイン..."
echo "   ブラウザが開きます。Cloudflare アカウントでログインしてください。"
npx wrangler login

# 環境変数の設定
echo ""
echo "==================================="
echo "4. 環境変数（Secrets）の設定"
echo "==================================="
echo ""
echo "以下のコマンドで環境変数を設定してください："
echo ""
echo "  # Discord Developer Portal で取得"
echo "  npx wrangler secret put DISCORD_CLIENT_ID"
echo "  npx wrangler secret put DISCORD_CLIENT_SECRET"
echo ""
echo "  # JWT署名用シークレット（任意の文字列）"
echo "  npx wrangler secret put JWT_SECRET"
echo ""
echo "今すぐ設定しますか？ [y/N]: "
read -r answer

if [[ "$answer" =~ ^[Yy]$ ]]; then
    echo ""
    echo "DISCORD_CLIENT_ID を入力してください："
    npx wrangler secret put DISCORD_CLIENT_ID
    
    echo ""
    echo "DISCORD_CLIENT_SECRET を入力してください："
    npx wrangler secret put DISCORD_CLIENT_SECRET
    
    echo ""
    echo "JWT_SECRET を入力してください（任意の長い文字列）："
    npx wrangler secret put JWT_SECRET
    
    echo ""
    echo "環境変数の設定が完了しました！"
fi

# デプロイ確認
echo ""
echo "==================================="
echo "5. デプロイ"
echo "==================================="
echo ""
echo "Workers をデプロイしますか？ [y/N]: "
read -r deploy_answer

if [[ "$deploy_answer" =~ ^[Yy]$ ]]; then
    npx wrangler deploy
    echo ""
    echo "デプロイが完了しました！"
    echo "Workers URL は上記の出力を確認してください。"
else
    echo ""
    echo "後で以下のコマンドでデプロイできます："
    echo "  cd workers && npx wrangler deploy"
fi

echo ""
echo "==================================="
echo "セットアップ完了！"
echo "==================================="
echo ""
echo "Discord Developer Portal での設定："
echo "  1. https://discord.com/developers/applications にアクセス"
echo "  2. アプリを選択 → OAuth2 → Redirects"
echo "  3. 以下のURLを追加："
echo "     https://<your-worker>.workers.dev/auth/discord/callback"
echo ""
echo "次のステップ："
echo "  1. フロントエンドの VITE_WORKERS_URL を Workers URL に設定"
echo "  2. pnpm build でフロントエンドをビルド"
echo "  3. GitHub Pages にデプロイ"
