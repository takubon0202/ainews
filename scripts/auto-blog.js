// index.html をもとに簡易的な SEO キーワードを抽出し、post フォルダにブログ HTML を生成するスクリプト
// 実行方法: node scripts/auto-blog.js
// GitHub Actions (auto-blog.yml) からも利用される

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const indexPath = path.join(rootDir, "index.html");
const newsPath = path.join(rootDir, "data", "news.json");
const postsDir = path.join(rootDir, "post");

// ---- ユーティリティ ----
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const readIndexText = () => {
  const html = fs.readFileSync(indexPath, "utf8");
  // script/style を除去してプレーンテキスト化
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
  return stripped;
};

const readNewsData = () => {
  if (!fs.existsSync(newsPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(newsPath, "utf8"));
  } catch (e) {
    console.warn("news.json の読み込みに失敗しました。index.html から抽出に切り替えます。", e);
    return [];
  }
};

const extractKeywords = (text) => {
  // 英数と日本語の塊を抽出
  const tokens = text.match(/[A-Za-z0-9]+|[ぁ-んァ-ヴー一-龠々ー]+/g) || [];
  const stop = new Set([
    "html",
    "head",
    "body",
    "meta",
    "charset",
    "lang",
    "id",
    "class",
    "title",
    "script",
    "style",
    "news",
    "daily",
    "ai",
    "jp",
    "en",
  ]);

  const counts = new Map();
  tokens.forEach((t) => {
    if (t.length < 2) return;
    const key = t.toLowerCase();
    if (stop.has(key)) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  const ranked = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);

  // 事業テーマに寄せたバックアップキーワード
  const fallback = [
    "aiニュース",
    "生成ai",
    "最新モデル",
    "企業動向",
    "研究速報",
    "プロダクトレビュー",
    "日本のニュース",
    "マルチモーダル",
    "llm",
    "api統合",
  ];

  // 上位語とバックアップをマージ
  const merged = Array.from(new Set([...ranked.slice(0, 8), ...fallback]));
  return merged.slice(0, 12);
};

const slugify = (titleBase) => {
  // 英数字以外はハイフンに寄せたシンプルなスラッグ
  const safe = titleBase
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
  return safe || "post";
};

const uniqueFilename = (baseName) => {
  let name = baseName;
  let counter = 1;
  while (fs.existsSync(path.join(postsDir, `${name}.html`))) {
    name = `${baseName}-${counter}`;
    counter += 1;
  }
  return `${name}.html`;
};

// ---- 本処理 ----
const main = () => {
  ensureDir(postsDir);

  // ニュース本文があれば優先的にキーワード抽出に使う
  const news = readNewsData();
  const newsText = news.map((n) => `${n.title} ${n.summary}`).join(" ");
  const text = newsText || readIndexText();

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const dateString = `${yyyy}-${mm}-${dd}`;

  const keywords = extractKeywords(text);
  const title = `Daily AI News トレンド解説 - ${dateString}`;
  const description = `${keywords.slice(0, 5).join(" / ")} にフォーカスした自動生成ブログ。`;

  // 実行のたびに異なるファイル名になるようにタイムスタンプを付与
  const baseSlug = slugify(`daily-ai-news-${yyyy}${mm}${dd}-${hh}${min}${ss}`);
  const fileName = uniqueFilename(baseSlug);
  const filePath = path.join(postsDir, fileName);

  const keywordBadges = keywords
    .map((k) => `<span class="tag">${k}</span>`)
    .join("");

  const highlights = news.slice(0, 5);
  const highlightList = highlights
    .map(
      (n) =>
        `<li><a href="${n.url}" target="_blank" rel="noopener">${n.title}</a><span class="hl-date">${n.date || ""}</span></li>`
    )
    .join("");

  const body = `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <meta name="description" content="${description}">
  <style>
    :root {
      --bg: #0b0d10;
      --panel: #121722;
      --text: #e8ecf2;
      --muted: #9aa3b6;
      --accent: #4fd1c5;
      --accent-2: #6c8bff;
      --border: #1f2733;
      --radius: 18px;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Inter", "Noto Sans JP", system-ui, -apple-system, sans-serif;
      background: radial-gradient(circle at 20% 20%, rgba(79,209,197,0.08), transparent 28%),
                  radial-gradient(circle at 80% 0%, rgba(108,139,255,0.07), transparent 32%),
                  var(--bg);
      color: var(--text);
      line-height: 1.7;
      padding: 24px 16px 60px;
    }
    .wrap {
      max-width: 900px;
      margin: 0 auto;
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      box-shadow: 0 16px 40px rgba(0,0,0,0.35);
      padding: 26px 26px 34px;
    }
    .title { margin: 0 0 6px; font-size: 28px; font-weight: 800; letter-spacing: 0.01em; }
    .meta { color: var(--muted); margin: 0 0 16px; }
    .tags { display: flex; flex-wrap: wrap; gap: 8px; margin: 14px 0 18px; }
    .tag {
      display: inline-flex;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(79,209,197,0.12);
      border: 1px solid rgba(79,209,197,0.4);
      color: var(--text);
      font-weight: 700;
      font-size: 13px;
    }
    h2 { margin: 18px 0 10px; font-size: 20px; }
    p { margin: 10px 0; color: var(--muted); }
    ul { padding-left: 18px; color: var(--muted); }
    .hl-date { margin-left: 8px; color: var(--muted); font-size: 12px; }
    .cta {
      margin-top: 22px;
      padding: 14px 16px;
      background: linear-gradient(135deg, rgba(79,209,197,0.15), rgba(108,139,255,0.15));
      border-radius: 14px;
      border: 1px solid var(--border);
      color: var(--text);
      font-weight: 700;
    }
    a { color: var(--accent); }
  </style>
</head>
<body>
  <article class="wrap">
    <h1 class="title">${title}</h1>
    <p class="meta">公開日: ${dateString}</p>
    <div class="tags">${keywordBadges}</div>
    <h2>このブログで伝えたいこと</h2>
    <p>Daily AI News では、${keywords.slice(0, 3).join("・")} を中心に、最新動向や事業に直結するポイントをコンパクトにまとめます。</p>
    <h2>注目ポイント</h2>
    <p>マルチモーダル対応や API 統合など、実務で活きるトピックをピックアップ。国内外の動向を追いつつ、ビジネスでの活用視点を優先して解説します。</p>
    ${
      highlights.length
        ? `<h2>直近の注目記事</h2><ul>${highlightList}</ul>`
        : ""
    }
    <h2>なぜ今重要か</h2>
    <p>${keywords.slice(0, 2).join(" と ")} の進化は、競争優位やオペレーション効率に直結します。最新ニュースを追うことで、次の打ち手を早めに検討できます。</p>
    <div class="cta">次回以降も ${keywords.slice(0, 4).join(" / ")} を軸に、実務に役立つ視点でアップデートしていきます。</div>
  </article>
</body>
</html>
`;

  fs.writeFileSync(filePath, body.trim() + "\n", "utf8");
  console.log(`Blog generated: ${path.relative(rootDir, filePath)}`);
};

main();
