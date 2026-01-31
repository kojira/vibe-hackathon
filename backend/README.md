# Backend

Hono + TypeScript + SQLiteで構築されたバックエンドAPIです。

## 構成

```
src/
├── routes/           # APIルート
│   ├── generate.ts   # テーマ生成API
│   ├── generations.ts # 履歴取得API
│   └── settings.ts   # 設定API
├── services/         # ビジネスロジック
│   └── llm.ts        # LLMサービス（OpenAI/Anthropic/Gemini）
├── db/               # データベース
│   ├── index.ts      # 接続・初期化
│   └── schema.ts     # Drizzle ORMスキーマ
└── index.ts          # エントリーポイント
```

## 開発

```bash
npm install
cp .env.example .env
# .envにAPIキーを設定
npm run dev
```

## ビルド

```bash
npm run build
npm start
```

## API

- `POST /api/generate` - テーマ生成
- `GET /api/generations` - 履歴一覧
- `GET /api/generations/:id` - 特定の履歴
- `GET /api/settings` - 設定取得
- `PUT /api/settings` - 設定更新
- `GET /api/settings/models` - モデル一覧
