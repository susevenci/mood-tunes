/**
 * download-audio.mjs
 * 下载 7 首 Kevin MacLeod 的 CC BY 4.0 器乐曲到 public/audio/local。
 * 仅在首次准备资源时执行；已存在的文件会跳过。
 */
import { createWriteStream } from 'node:fs';
import { mkdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import https from 'node:https';

const ROOT = process.cwd();
const DEST = join(ROOT, 'public', 'audio', 'local');
const BASE = 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/';

const TRACKS = [
  {
    title: 'Happy Alley',
    slug: 'happy-alley',
    emotion: 'happy',
    minBytes: 2_500_000,
  },
  {
    title: 'Heartbreaking',
    slug: 'heartbreaking',
    emotion: 'sad',
    minBytes: 3_000_000,
  },
  {
    title: 'Volatile Reaction',
    slug: 'volatile-reaction',
    emotion: 'angry',
    minBytes: 4_000_000,
  },
  {
    title: 'Peaceful Desolation',
    slug: 'peaceful-desolation',
    emotion: 'calm',
    minBytes: 2_500_000,
  },
  {
    title: 'Monkeys Spinning Monkeys',
    slug: 'monkeys-spinning-monkeys',
    emotion: 'surprised',
    minBytes: 3_500_000,
  },
  {
    title: 'Anxiety',
    slug: 'anxiety',
    emotion: 'fearful',
    minBytes: 3_500_000,
  },
  {
    title: 'The House of Leaves',
    slug: 'the-house-of-leaves',
    emotion: 'disgusted',
    minBytes: 6_000_000,
  },
];

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 MoodTunes/1.0';

function download(url, filePath, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    const req = https.get(
      url,
      { headers: { 'User-Agent': UA, Accept: 'audio/mpeg,*/*' }, timeout: 60_000 },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(new URL(res.headers.location, url).href, filePath, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }
        const out = createWriteStream(filePath);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve()));
        out.on('error', reject);
        res.on('error', reject);
      },
    );
    req.on('timeout', () => req.destroy(new Error('下载超时')));
    req.on('error', reject);
  });
}

function attribution(title) {
  return `"${title}" Kevin MacLeod (incompetech.com)\nLicensed under Creative Commons: By Attribution 4.0 License\nhttp://creativecommons.org/licenses/by/4.0/`;
}

await mkdir(DEST, { recursive: true });
await mkdir(dirname(DEST), { recursive: true });

for (const track of TRACKS) {
  const target = join(DEST, `${track.slug}.mp3`);
  const existing = await stat(target).catch(() => null);
  if (existing && existing.size >= track.minBytes) {
    console.log(`[audio] 跳过（已存在） ${track.slug}.mp3  ${(existing.size / 1024 / 1024).toFixed(2)}MB`);
    continue;
  }
  const url = `${BASE}${encodeURIComponent(track.title)}.mp3`;
  process.stdout.write(`[audio] 下载 ${track.title} ... `);
  try {
    await download(url, target);
    const info = await stat(target);
    if (info.size < track.minBytes) throw new Error(`文件过小（${info.size} 字节）`);
    console.log(`完成 ${(info.size / 1024 / 1024).toFixed(2)}MB`);
  } catch (err) {
    console.error(`失败：${err.message}`);
    process.exitCode = 1;
  }
}

const attributionFile = [
  '# 本地曲目署名 / Attribution',
  '',
  '本目录中的 7 首器乐曲均由 **Kevin MacLeod** 创作，来自 [incompetech.com](https://incompetech.com/)，',
  '采用 [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/) 许可。',
  '页面页脚与「音乐署名」弹窗中同步展示以下署名。',
  '',
  ...TRACKS.map(
    (t) =>
      `## ${t.title}\n\n文件：\`${t.slug}.mp3\`  \n用途：${
        { happy: '高兴', sad: '悲伤', angry: '愤怒', calm: '平静', surprised: '惊讶', fearful: '恐惧', disgusted: '厌恶' }[
          t.emotion
        ]
      }情绪示例曲目

\`\`\`text
${attribution(t.title)}
\`\`\`
`,
  ),
].join('\n');

await writeFile(join(DEST, 'ATTRIBUTION.md'), attributionFile, 'utf8');
console.log('[audio] 已生成 public/audio/local/ATTRIBUTION.md');
