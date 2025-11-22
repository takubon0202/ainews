// index.html をもとに簡易的な SEO キーワードを抽出し、post フォルダにブログ HTML を生成するスクリプト
// 実行方法: node scripts/auto-blog.js
// GitHub Actions (auto-blog.yml) からも利用される

const fs = require("fs");
const path = require("path");
const rootDir = path.join(__dirname, "..");
const indexPath = path.join(rootDir, "index.html");
const newsPath = path.join(rootDir, "data", "news.json");
const blogHistoryPath = path.join(rootDir, "data", "blog-used.json");
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

const readBlogHistory = () => {
  if (!fs.existsSync(blogHistoryPath)) return new Set();
  try {
    const arr = JSON.parse(fs.readFileSync(blogHistoryPath, "utf8"));
    return new Set(arr);
  } catch (e) {
    console.warn("blog-used.json の読み込みに失敗しました。新規作成します。", e);
    return new Set();
  }
};

const writeBlogHistory = (set) => {
  ensureDir(path.dirname(blogHistoryPath));
  fs.writeFileSync(blogHistoryPath, JSON.stringify([...set], null, 2), "utf8");
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
  const history = readBlogHistory();

  // 未使用のニュースを優先的にピックアップ
  const freshNews =
    news.find((n) => !history.has(n.url)) ||
    news.find((n) => !history.has(n.title)) ||
    news[0];

  // キーワード抽出用テキスト
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

  // Gemini で本文を生成（失敗したらシンプルテンプレにフォールバック）
  const fallbackBody = `
    <h2>今日のポイント</h2>
    <p>${keywords.slice(0, 3).join("・")} を中心に、主要トピックをまとめました。</p>
    <h2>注目動向</h2>
    <p>${freshNews ? freshNews.title : "最新ニュースを確認してください。"} を含む直近の話題をピックアップ。</p>
    <h2>ビジネス視点</h2>
    <p>モデル更新やAPI統合など、業務適用に影響する項目を優先的にフォローします。</p>
  `;

  let articleBody = fallbackBody;

  const geminiTextPromise = callGemini({ news, keywords, dateString });

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
    ${highlights.length ? `<h2>直近の注目記事</h2><ul>${highlightList}</ul>` : ""}
    <div id="llm-body">${articleBody}</div>
    <div class="cta">次回以降も ${keywords.slice(0, 4).join(" / ")} を軸に、実務に役立つ視点でアップデートしていきます。</div>
  </article>
</body>
</html>
`;

  const finalize = (llmHtml) => {
    const safeBody = llmHtml || articleBody;
    const filled = body.replace(
      '<div id="llm-body">${articleBody}</div>',
      `<div id="llm-body">${safeBody}</div>`
    );
    fs.writeFileSync(filePath, filled.trim() + "\n", "utf8");
    // 履歴に今回参照したニュースの URL/タイトルを保存
    if (freshNews) {
      history.add(freshNews.url);
      history.add(freshNews.title);
      writeBlogHistory(history);
    }
    console.log(`Blog generated: ${path.relative(rootDir, filePath)}`);
  };

  Promise.resolve(geminiTextPromise)
    .then((llmText) => finalize(llmText))
    .catch(() => finalize(null));
};

main();
// ---- Gemini API 呼び出し（キーが無ければ null 返却）----
async function callGemini({ news, keywords, dateString }) {
  const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  const model = process.env.GEMINI_MODEL || "gemini-3-pro-preview";

  const topNews = news.slice(0, 8);
  const headlineList = topNews
    .map((n, i) => `${i + 1}. ${n.title} (${n.date || ""}) - ${n.url}`)
    .join("\n");

  const prompt = `あなたはAIニュースのブログライターです。以下のヘッドラインを踏まえて、${dateString} のまとめ記事を日本語で書いてください。
- 口調: 落ち着いたビジネス調で、コンパクトに重要点を抑える
- セクション例: 「今日のポイント」「注目動向」「ビジネス視点」「まとめ」
- 見出しには指定のキーワードを散りばめる: ${keywords.slice(0, 8).join(", ")}
- 不明点は書かないでください。推測や捏造は禁止。
- 出力形式: プレーンなHTML断片（<h2> と <p> と <ul><li> のみ使用）

ヘッドライン一覧:
${headlineList}`;

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_LOW_AND_ABOVE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_LOW_AND_ABOVE" },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Gemini error ${res.status}`);
    const json = await res.json();
    const text =
      json?.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("\n") || "";
    return text.trim() || null;
  } catch (e) {
    console.error("Gemini呼び出し失敗:", e.message);
    return null;
  }
}
