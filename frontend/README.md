# Frontend

Vite + React + TypeScript + TailwindCSSで構築されたフロントエンドです。

## 構成

```
src/
├── components/     # 共通コンポーネント
│   └── Layout.tsx  # ナビゲーション付きレイアウト
├── pages/          # ページコンポーネント
│   ├── MainPage.tsx      # テーマ生成・表示画面
│   ├── SettingsPage.tsx  # 設定画面
│   └── HistoryPage.tsx   # 履歴画面
├── lib/            # ユーティリティ
│   └── api.ts      # APIクライアント
├── App.tsx         # ルーティング設定
└── index.css       # Tailwind CSS
```

## 開発

```bash
npm install
npm run dev
```

## ビルド

```bash
npm run build
```
