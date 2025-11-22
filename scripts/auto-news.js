// 最新の AI ニュースを RSS から取得し、data/news.json に追記するスクリプト
// 実行方法: node scripts/auto-news.js
// GitHub Actions (auto-blog.yml) からも利用されます。

const fs = require("fs");
const path = require("path");

const rootDir = path.join(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const newsPath = path.join(dataDir, "news.json");

// 取得対象の RSS (Google News)
const feeds = [
  {
    url: "https://news.google.com/rss/search?q=AI+OR+%E4%BA%BA%E5%B7%A5%E7%9F%A5%E8%83%BD&hl=ja&gl=JP&ceid=JP:ja",
    lang: "JP",
    category: "AIニュース",
  },
  {
    url: "https://news.google.com/rss/search?q=%E7%94%9F%E6%88%90AI+OR+LLM+OR+%E3%83%9E%E3%83%AB%E3%83%81%E3%83%A2%E3%83%BC%E3%83%80%E3%83%AB&hl=ja&gl=JP&ceid=JP:ja",
    lang: "JP",
    category: "生成AI",
  },
  {
    url: "https://news.google.com/rss/search?q=AI+model+OR+LLM&hl=en-US&gl=US&ceid=US:en",
    lang: "EN",
    category: "Models",
  },
  {
    url: "https://news.google.com/rss/search?q=AI+research+OR+machine+learning&hl=en-US&gl=US&ceid=US:en",
    lang: "EN",
    category: "Research",
  },
];

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

const decode = (str = "") =>
  str
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

const stripTags = (str = "") => decode(str.replace(/<[^>]+>/g, " "));

const toISODate = (dateStr) => {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const hashId = (url, title) => {
  const base = url || title || String(Date.now());
  return (
    "n-" +
    Buffer.from(base).toString("base64url").replace(/[^a-z0-9]/gi, "").slice(0, 12)
  );
};

const parseItems = (xml, lang, category) => {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag) => {
      const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? decode(m[1]) : "";
    };
    const title = getTag("title");
    let link = getTag("link");
    const desc = stripTags(getTag("description")).replace(/\s+/g, " ").trim();
    const date = toISODate(getTag("pubDate"));

    if (!title || !link) continue;
    // Google News のリンクは news.google.com 経由なのでそのまま利用
    // 同一リンクでの重複防止のためトリミング
    link = link.split("?")[0];

    const id = hashId(link, title);
    const source = (() => {
      try {
        const u = new URL(link);
        return u.hostname.replace(/^www\./, "");
      } catch (e) {
        return "news.google.com";
      }
    })();

    items.push({
      id,
      title,
      summary: desc || "要約情報は取得できませんでした。",
      category: category || "ニュース",
      lang: lang || "EN",
      date: date || new Date().toISOString().slice(0, 10),
      source,
      url: link,
    });
  }
  return items;
};

const dedupeAndMerge = (existing, incoming) => {
  const map = new Map();
  existing.forEach((item) => map.set(item.url || item.title, item));
  incoming.forEach((item) => {
    if (!map.has(item.url) && !map.has(item.title)) {
      map.set(item.url || item.title, item);
    }
  });
  return Array.from(map.values());
};

const sortAndLimit = (items, limit = 200) =>
  items
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
    .slice(0, limit);

const fetchFeed = async (feed) => {
  const res = await fetch(feed.url);
  if (!res.ok) throw new Error(`Failed to fetch ${feed.url}: ${res.status}`);
  const xml = await res.text();
  return parseItems(xml, feed.lang, feed.category);
};

const main = async () => {
  ensureDir(dataDir);
  let current = [];
  if (fs.existsSync(newsPath)) {
    try {
      current = JSON.parse(fs.readFileSync(newsPath, "utf8"));
    } catch (e) {
      console.warn("既存 news.json の読み込みに失敗しました。新規作成します。", e);
      current = [];
    }
  }

  const all = [];
  for (const feed of feeds) {
    try {
      const items = await fetchFeed(feed);
      all.push(...items);
    } catch (e) {
      console.error("フィード取得エラー:", feed.url, e.message);
    }
  }

  const merged = sortAndLimit(dedupeAndMerge(current, all));
  fs.writeFileSync(newsPath, JSON.stringify(merged, null, 2), "utf8");
  console.log(`news.json updated: ${merged.length} items`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
