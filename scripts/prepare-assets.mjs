/**
 * prepare-assets.mjs
 * 从 @vladmandic/face-api 包内复制运行所需的三组模型权重到 public/models。
 * 幂等：源文件较新或目标缺失时才写入，并校验字节数。
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { mkdir, copyFile, stat } from 'node:fs/promises';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const DEST = join(ROOT, 'public', 'models');

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model.bin',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model.bin',
  'face_expression_model-weights_manifest.json',
  'face_expression_model.bin',
];

let pkgJson;
try {
  pkgJson = require.resolve('@vladmandic/face-api/package.json');
} catch {
  console.error('[assets] 未找到 @vladmandic/face-api，请先执行 npm install。');
  process.exit(1);
}

const SRC = join(dirname(pkgJson), 'model');
await mkdir(DEST, { recursive: true });

let copied = 0;
for (const name of FILES) {
  const src = join(SRC, name);
  const dest = join(DEST, name);
  const srcStat = await stat(src).catch(() => null);
  if (!srcStat) {
    console.error(`[assets] 模型文件缺失：${src}`);
    process.exit(1);
  }
  const destStat = await stat(dest).catch(() => null);
  if (destStat && destStat.size === srcStat.size && destStat.mtimeMs >= srcStat.mtimeMs) {
    continue;
  }
  await copyFile(src, dest);
  copied += 1;
}

const summary = [];
for (const name of FILES) {
  const s = await stat(join(DEST, name));
  if (s.size < 1000) {
    console.error(`[assets] 文件异常（过小）：${name}`);
    process.exit(1);
  }
  summary.push(`${name}  ${(s.size / 1024).toFixed(1)}KB`);
}

console.log(`[assets] 模型就绪（本次复制 ${copied} 个文件）`);
for (const line of summary) console.log('  ' + line);
