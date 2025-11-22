// post 配下の .html をスキャンして posts.json を生成する簡易スクリプト
// 使い方: node post/generate-manifest.js

const fs = require('fs');
const path = require('path');

const postsDir = __dirname; // post フォルダ
const manifestPath = path.join(postsDir, 'posts.json');

const files = fs.readdirSync(postsDir)
  .filter((file) => file.toLowerCase().endsWith('.html'));

const posts = files.map((file) => {
  const fullPath = path.join(postsDir, file);
  const html = fs.readFileSync(fullPath, 'utf8');
  const titleMatch = html.match(/<title>([^<]*)<\/title>/i);
  const descMatch = html.match(/<meta[^>]*name=["\']description["\'][^>]*content=["\']([^"\']*)["\'][^>]*>/i);
  const stats = fs.statSync(fullPath);
  const date = stats.mtime.toISOString().slice(0, 10);

  return {
    slug: file,
    title: titleMatch ? titleMatch[1].trim() : file.replace(/\.html$/i, ''),
    description: descMatch ? descMatch[1].trim() : '記事の概要が未設定です。',
    date,
    url: `post/${file}`
  };
}).sort((a, b) => b.date.localeCompare(a.date));

fs.writeFileSync(manifestPath, JSON.stringify(posts, null, 2), 'utf8');
console.log(`posts.json updated with ${posts.length} entries.`);
