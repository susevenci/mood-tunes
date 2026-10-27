/**
 * audioCache.js — 在线试听的本地缓存（IndexedDB Blob）。
 * 元数据存 catalog，音频 Blob 存 audio，避免推荐时把所有音频读入内存。
 */
import { APP_CONFIG } from '../../config.js';
import {
  idbGet,
  idbGetAll,
  idbKeys,
  idbPut,
  idbDelete,
  idbClear,
  isIndexedDbAvailable,
} from './idb.js';

function cachedMeta(meta) {
  return {
    ...meta,
    source: 'cache',
    local: true,
    cached: true,
    audioUrl: '',
    cacheBadge: '已缓存',
  };
}

/**
 * 把 Vue 响应式对象转换为可 structured clone 的纯对象。
 * 注意：IndexedDB 不能直接存 reactive proxy，否则会抛 DataCloneError。
 */
function toPlain(value) {
  return JSON.parse(JSON.stringify(value));
}

let cleanedOrphans = false;

/** 清理“音频已写入但 catalog 写入失败”留下的孤儿记录。 */
async function cleanupOrphanAudio() {
  if (cleanedOrphans || !isIndexedDbAvailable()) return;
  cleanedOrphans = true;
  try {
    const [audioKeys, catalogKeys] = await Promise.all([idbKeys('audio'), idbKeys('catalog')]);
    const keep = new Set(catalogKeys);
    for (const key of audioKeys) {
      if (!keep.has(key)) await idbDelete('audio', key);
    }
  } catch {
    // 清理失败不影响主流程。
  }
}

export async function getCachedSongMeta() {
  if (!isIndexedDbAvailable()) return [];
  await cleanupOrphanAudio();
  try {
    const records = await idbGetAll('catalog');
    return records
      .map((record) => cachedMeta(record.meta))
      .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0));
  } catch {
    return [];
  }
}

export async function getCachedBlob(id) {
  if (!isIndexedDbAvailable()) return null;
  try {
    const record = await idbGet('audio', id);
    return record?.blob ?? null;
  } catch {
    return null;
  }
}

async function pruneCache() {
  const records = await idbGetAll('catalog');
  records.sort((a, b) => (a.savedAt ?? 0) - (b.savedAt ?? 0));
  let totalBytes = records.reduce((acc, record) => acc + (record.bytes ?? 0), 0);
  let count = records.length;

  for (const record of records) {
    if (count <= APP_CONFIG.cache.maxSongs && totalBytes <= APP_CONFIG.cache.maxBytes) break;
    await idbDelete('audio', record.id);
    await idbDelete('catalog', record.id);
    count -= 1;
    totalBytes -= record.bytes ?? 0;
  }
}

async function readWithProgress(response, onProgress) {
  const total = Number(response.headers.get('content-length')) || 0;
  if (!response.body || !total) {
    const blob = await response.blob();
    onProgress?.(1);
    return blob;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.length;
    onProgress?.(Math.min(0.99, received / total));
  }
  return new Blob(chunks, {
    type: response.headers.get('content-type') || 'audio/mp4',
  });
}

/**
 * 下载在线试听到 IndexedDB。
 * @returns {Promise<{blob:Blob, record:object}>}
 */
export async function saveCachedSong(song, onProgress) {
  if (!isIndexedDbAvailable()) throw new Error('当前浏览器不支持本地缓存。');
  if (!song?.audioUrl) throw new Error('该曲目没有可缓存的音频地址。');
  await cleanupOrphanAudio();

  const response = await fetch(song.audioUrl, { mode: 'cors', cache: 'no-store' });
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`);
  const blob = await readWithProgress(response, onProgress);
  if (!blob.size) throw new Error('下载到的音频为空。');

  const savedAt = Date.now();
  const meta = toPlain({
    ...song,
    source: 'cache',
    local: true,
    cached: true,
    audioUrl: '',
    savedAt,
    bytes: blob.size,
  });
  await idbPut('audio', { id: song.id, blob, savedAt });
  try {
    await idbPut('catalog', { id: song.id, meta, savedAt, bytes: blob.size });
  } catch (err) {
    // 元数据写入失败时回滚音频，避免留下不可见的孤儿 Blob。
    await idbDelete('audio', song.id).catch(() => {});
    throw err;
  }
  await pruneCache();
  onProgress?.(1);
  return { blob, record: meta };
}

export async function deleteCachedSong(id) {
  await idbDelete('audio', id);
  await idbDelete('catalog', id);
}

export async function clearAudioCache() {
  await idbClear('audio');
  await idbClear('catalog');
}

export async function getCacheUsage() {
  if (!isIndexedDbAvailable()) return { count: 0, bytes: 0 };
  try {
    const records = await idbGetAll('catalog');
    return {
      count: records.length,
      bytes: records.reduce((acc, record) => acc + (record.bytes ?? 0), 0),
    };
  } catch {
    return { count: 0, bytes: 0 };
  }
}
