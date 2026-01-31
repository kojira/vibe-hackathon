#!/bin/bash
# 全体デプロイスクリプト
# 使用方法: ./scripts/deploy.sh [frontend|workers|all]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

deploy_frontend() {
    echo "==================================="
    echo "フロントエンドのデプロイ (GitHub Pages)"
    echo "==================================="
    
    cd "$PROJECT_ROOT/frontend"
    
    # ビルド
    echo "1. ビルド中..."
    pnpm build
    
    # gh-pages ブランチにデプロイ
    echo ""
    echo "2. gh-pages ブランチにデプロイ中..."
    
    # gh-pages がインストールされているか確認
    if ! npx gh-pages --version &> /dev/null; then
        echo "   gh-pages をインストール中..."
        pnpm add -D gh-pages
    fi
    
    # デプロイ
    npx gh-pages -d dist
    
    echo ""
    echo "フロントエンドのデプロイが完了しました！"
    echo "URL: https://kojira.github.io/vibe-theme-generator"
}

deploy_workers() {
    echo "==================================="
    echo "Cloudflare Workers のデプロイ"
    echo "==================================="
    
    cd "$PROJECT_ROOT/workers"
    
    # 依存関係確認
    if [ ! -d "node_modules" ]; then
        echo "1. 依存関係をインストール中..."
        npm install
    fi
    
    # デプロイ
    echo "2. デプロイ中..."
    npx wrangler deploy
    
    echo ""
    echo "Workers のデプロイが完了しました！"
}

show_usage() {
    echo "使用方法: $0 [frontend|workers|all]"
    echo ""
    echo "オプション:"
    echo "  frontend  - フロントエンドのみデプロイ (GitHub Pages)"
    echo "  workers   - Cloudflare Workers のみデプロイ"
    echo "  all       - すべてデプロイ"
    echo ""
    echo "例:"
    echo "  $0 all"
}

# メイン処理
case "${1:-all}" in
    frontend)
        deploy_frontend
        ;;
    workers)
        deploy_workers
        ;;
    all)
        deploy_workers
        deploy_frontend
        ;;
    -h|--help)
        show_usage
        ;;
    *)
        echo "エラー: 不明なオプション '$1'"
        show_usage
        exit 1
        ;;
esac

echo ""
echo "==================================="
echo "デプロイ完了！"
echo "==================================="
