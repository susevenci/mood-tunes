/**
 * itunesProvider.js — 在线曲库适配器（iTunes Search API，30 秒试听）。
 *
 * 约束：每次刷新最多 1 个请求；全局限速 1.5s；相同 country:term 缓存 10 分钟。
 * 失败时抛出的 Error 带 code: OFFLINE / RATE_LIMIT / TIMEOUT / NETWORK。
 */
import { APP_CONFIG } from '../../../config.js';
import { getProfile } from '../profiles.js';
import { mapItunesResults } from './itunesMapper.js';

const cache = new Map();
let gate = Promise.resolve();
let lastRequestAt = 0;

function providerError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function schedule(task) {
  const run = gate.then(async () => {
    const wait = Math.max(0, lastRequestAt + APP_CONFIG.itunes.requestGapMs - Date.now());
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastRequestAt = Date.now();
    return task();
  });
  gate = run.catch(() => {});
  return run;
}

function isOnline() {
  return typeof navigator === 'undefined' || navigator.onLine !== false;
}

async function fetchSearch(term, country, signal) {
  if (signal?.aborted) throw providerError('ABORTED', '请求已取消');
  const url = new URL(APP_CONFIG.itunes.endpoint);
  url.searchParams.set('term', term);
  url.searchParams.set('media', 'music');
  url.searchParams.set('entity', 'song');
  url.searchParams.set('limit', String(APP_CONFIG.itunes.limit));
  url.searchParams.set('country', country);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), APP_CONFIG.itunes.timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });

  try {
    const response = await fetch(url.href, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });
    if (response.status === 429 || response.status === 403) {
      throw providerError('RATE_LIMIT', '在线曲库限流，请稍后再试。');
    }
    if (!response.ok) {
      throw providerError('NETWORK', `在线曲库暂时不可用（HTTP ${response.status}）。`);
    }
    return await response.json();
  } catch (err) {
    if (err?.code) throw err;
    if (err?.name === 'AbortError') throw providerError('TIMEOUT', '在线曲库请求超时。');
    throw providerError('NETWORK', '在线曲库不可用，请检查网络。');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

export const itunesProvider = {
  id: 'itunes',
  label: 'Apple iTunes 试听',
  available: isOnline,

  async search({ emotion, confidence = 1, blend = 0.7, seed = 0, country = 'tw', signal } = {}) {
    if (!isOnline()) throw providerError('OFFLINE', '当前离线，已切换到本地曲库。');

    const profile = getProfile(emotion, confidence, blend);
    const terms = profile.terms[country] ?? profile.terms.tw;
    const term = terms[Math.abs(seed) % terms.length] ?? terms[0];
    const key = `${country}:${term}`;

    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < APP_CONFIG.itunes.ttlMs) {
      return hit.songs.map((song) => ({ ...song }));
    }

    return schedule(async () => {
      if (signal?.aborted) throw providerError('ABORTED', '请求已取消');
      const fresh = cache.get(key);
      if (fresh && Date.now() - fresh.ts < APP_CONFIG.itunes.ttlMs) {
        return fresh.songs.map((song) => ({ ...song }));
      }
      const payload = await fetchSearch(term, country, signal);
      const songs = mapItunesResults(payload, {
        emotion: profile.emotion,
        target: profile.target,
        seed,
      });
      cache.set(key, { ts: Date.now(), songs });
      return songs;
    });
  },
};
