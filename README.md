# AI News Auto Blog

GitHub Actions で最新の AI ニュースを取得し、Gemini 3.0 Pro でブログを自動生成します。

## API キーの設定手順（GitHub Secrets）
画像のようにリポジトリ Settings から設定します。

1. GitHub リポジトリの `Settings` を開く。
2. 左メニューから `Secrets and variables` → `Actions` を選択。
3. `New repository secret` をクリックし、以下を追加して保存。
   - `GOOGLE_API_KEY`（または `GEMINI_API_KEY`）：Gemini の API キー
   - 任意: `GEMINI_MODEL`（未設定なら `gemini-3-pro-preview` を使用）

## 使い方
- 手動実行: Actions の「Auto Blog from index.html」を `Run workflow` で起動。
- スケジュール: ワークフロー内の cron（毎日 02:00 UTC）で自動実行。
- 実行ごとに:
  1) 最新ニュース取得 (`data/news.json` を更新)
  2) 新規ブログ生成（時分秒付きのユニークな HTML を `post/` に追加）
  3) `post/posts.json` 更新 → 自動コミット＆プッシュ

## ローカル確認
```
node scripts/auto-news.js      # ニュース取得
node scripts/auto-blog.js      # ブログ生成
node post/generate-manifest.js # manifest 更新
```
`index.html` をブラウザで開いて、ブログ一覧に新しい記事が表示されることを確認してください。
