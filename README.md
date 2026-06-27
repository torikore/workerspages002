# ミニゲームゲート

左サイドメニューでゲームを選び、メインエリアで遊べるミニゲームポータル。
Cloudflare Pages + D1 + Pages Functions（無料プラン）で運用。

## 構成

```
/
├── index.html              # ポータルシェル
├── css/portal.css
├── js/portal.js
├── functions/api/games.js  # ゲーム一覧 API
├── games/                  # 各ゲーム（独立アプリ）
├── migrations/             # D1 スキーマ
└── wrangler.toml
```

## ローカル開発

### 1. Wrangler のインストール

```bash
npm install -g wrangler
wrangler login
```

### 2. D1 データベースの作成

```bash
wrangler d1 create minigame-gate-db
```

表示された `database_id` を `wrangler.toml` の `REPLACE_WITH_YOUR_DATABASE_ID` に設定。

### 3. マイグレーション適用

```bash
# ローカル
wrangler d1 migrations apply minigame-gate-db --local

# 本番
wrangler d1 migrations apply minigame-gate-db --remote
```

### 4. 開発サーバー起動

```bash
wrangler pages dev .
```

ブラウザで `http://localhost:8788` を開く。

API が使えない場合、ポータルは組み込みのフォールバック一覧で動作します。

## 本番デプロイ（Cloudflare Pages）

1. GitHub リポジトリを Cloudflare Pages に接続
2. ビルドコマンド: なし（静的サイト）
3. 出力ディレクトリ: `/`（プロジェクトルート）
4. Pages プロジェクト設定で D1 バインディング `DB` → `minigame-gate-db` を追加
5. 本番 D1 にマイグレーションを適用

```bash
wrangler d1 migrations apply minigame-gate-db --remote
```

## ゲームの追加

1. `games/{slug}/` にゲームを作成（`index.html` 必須）
2. D1 の `games` テーブルに行を追加（またはマイグレーション / SQL）
3. Git push → 自動デプロイ

## サンプルゲーム

| slug | タイトル |
|------|----------|
| `number-guess` | 数字当て |
| `tetris` | テトリス |
