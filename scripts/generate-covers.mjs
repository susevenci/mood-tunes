/**
 * generate-covers.mjs
 * 生成 7 张情绪渐变 SVG 封面与站点 favicon，避免任何外部图片依赖。
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DEST = join(ROOT, 'public', 'covers');
const PUBLIC = join(ROOT, 'public');

const ITEMS = [
  { key: 'happy', zh: '高兴', en: 'HAPPY', from: '#ffb23e', to: '#ff6b3d' },
  { key: 'sad', zh: '悲伤', en: 'SAD', from: '#5b8def', to: '#3d4f9f' },
  { key: 'angry', zh: '愤怒', en: 'ANGRY', from: '#ff5a5f', to: '#a1122b' },
  { key: 'calm', zh: '平静', en: 'CALM', from: '#2ed6b3', to: '#127a86' },
  { key: 'surprised', zh: '惊讶', en: 'SURPRISED', from: '#b983ff', to: '#5b3fd6' },
  { key: 'fearful', zh: '恐惧', en: 'FEARFUL', from: '#7b6cff', to: '#2c2a6e' },
  { key: 'disgusted', zh: '厌恶', en: 'DISGUSTED', from: '#a3d65c', to: '#41663a' },
];

function cover({ key, zh, en, from, to }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400" role="img" aria-label="${zh}">
  <defs>
    <linearGradient id="g-${key}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
    <radialGradient id="r-${key}" cx="0.7" cy="0.25" r="0.8">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.45"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur-${key}"><feGaussianBlur stdDeviation="18"/></filter>
  </defs>
  <rect width="400" height="400" fill="url(#g-${key})"/>
  <circle cx="320" cy="80" r="130" fill="url(#r-${key})"/>
  <g filter="url(#blur-${key})" opacity="0.55">
    <circle cx="70" cy="320" r="90" fill="#05070f"/>
    <circle cx="330" cy="300" r="60" fill="#05070f"/>
  </g>
  <g fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.2">
    <circle cx="200" cy="200" r="118"/>
    <circle cx="200" cy="200" r="86"/>
    <circle cx="200" cy="200" r="54"/>
  </g>
  <path d="M70 250 C120 210 160 290 210 250 S300 210 340 250" fill="none" stroke="#ffffff" stroke-opacity="0.55" stroke-width="2"/>
  <text x="40" y="330" fill="#ffffff" font-family="Segoe UI, Microsoft YaHei, sans-serif" font-size="46" font-weight="700">${zh}</text>
  <text x="42" y="360" fill="#ffffff" fill-opacity="0.7" font-family="Segoe UI, sans-serif" font-size="14" letter-spacing="4">${en}</text>
</svg>
`;
}

await mkdir(DEST, { recursive: true });
for (const item of ITEMS) {
  await writeFile(join(DEST, `${item.key}.svg`), cover(item), 'utf8');
}

const favicon = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
  <defs>
    <linearGradient id="f" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6ea8ff"/>
      <stop offset="0.55" stop-color="#b983ff"/>
      <stop offset="1" stop-color="#2ed6b3"/>
    </linearGradient>
  </defs>
  <rect width="64" height="64" rx="16" fill="#070b14"/>
  <circle cx="32" cy="32" r="21" fill="none" stroke="url(#f)" stroke-width="3"/>
  <path d="M24 39V25l8 6 8-6v14" fill="none" stroke="url(#f)" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>
`;
await writeFile(join(PUBLIC, 'favicon.svg'), favicon, 'utf8');

console.log('[covers] 已生成 7 张封面与 favicon.svg');
