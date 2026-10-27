/**
 * useRecommendations.js — 推荐编排：本地即时结果 + iTunes 异步补充 + 缓存。
 */
import { reactive, watch } from 'vue';
import { APP_CONFIG } from '../config.js';
import { recommend } from '../core/recommend/rank.js';
import { resolveBlend } from '../core/recommend/profiles.js';
import {
  getOfflineCandidates,
  getOnlineCandidates,
} from '../core/recommend/providers/registry.js';
import {
  clearAudioCache,
  deleteCachedSong,
  getCacheUsage,
  getCachedSongMeta,
  saveCachedSong,
} from '../core/storage/audioCache.js';
import { toast } from '../stores/uiState.js';
import { useAudioPlayer } from './useAudioPlayer.js';
import { useSettings } from './useSettings.js';

const { settings } = useSettings();
const player = useAudioPlayer();

const state = reactive({
  emotion: null,
  confidence: 0,
  mode: APP_CONFIG.recommend.mode,
  blend: APP_CONFIG.recommend.defaultBlend,
  profile: null,
  target: null,
  list: [],
  loading: false,
  onlineLoading: false,
  error: null,
  onlineError: null,
  offline: typeof navigator !== 'undefined' ? navigator.onLine === false : false,
  seed: 0,
  lastIds: [],
  uncertain: false,
  cachedCount: 0,
  cacheBytes: 0,
  cacheProgress: {},
  initialized: false,
});

let requestSeq = 0;
let abortController = null;

function dedupe(songs) {
  const map = new Map();
  for (const song of songs) {
    if (song && !map.has(song.id)) map.set(song.id, song);
  }
  return [...map.values()];
}

async function refreshCacheUsage() {
  const [meta, usage] = await Promise.all([getCachedSongMeta(), getCacheUsage()]);
  state.cachedCount = meta.length;
  state.cacheBytes = usage.bytes;
}

async function refresh(emotion, confidence, { force = false, seed = state.seed } = {}) {
  const safeConfidence = Number.isFinite(confidence) ? confidence : 0;
  if (
    !force &&
    emotion === state.emotion &&
    Math.abs(safeConfidence - state.confidence) < 0.12
  ) {
    return;
  }

  abortController?.abort();
  abortController = new AbortController();
  const seq = ++requestSeq;

  state.emotion = emotion ?? null;
  state.confidence = safeConfidence;
  state.seed = seed;
  state.mode = settings.mode;
  state.blend = resolveBlend({
    emotion: state.emotion,
    confidence: state.confidence,
    mode: settings.mode,
    tune: settings.tune,
  });
  state.loading = true;
  state.error = null;
  state.onlineError = null;

  const offlineSongs = await getOfflineCandidates();
  if (seq !== requestSeq) return;

  const base = recommend({
    emotion: state.emotion,
    confidence: state.confidence,
    songs: offlineSongs,
    blend: state.blend,
    seed,
    recentIds: player.state.recentIds,
    previousIds: state.lastIds,
    limit: APP_CONFIG.recommend.limit,
  });

  state.profile = base.profile;
  state.target = base.target;
  state.list = base.list;
  state.uncertain = base.profile.uncertain;
  state.loading = false;

  if (!settings.online || state.offline) {
    state.onlineLoading = false;
    if (state.offline) state.onlineError = '当前离线，已使用本地曲库。';
    state.lastIds = state.list.slice(0, 2).map((item) => item.song.id);
    return;
  }

  state.onlineLoading = true;
  try {
    const onlineSongs = await getOnlineCandidates({
      emotion: state.emotion,
      confidence: state.confidence,
      blend: state.blend,
      seed,
      country: settings.country,
      signal: abortController.signal,
    });
    if (seq !== requestSeq) return;

    const merged = dedupe([...offlineSongs, ...onlineSongs]);
    const ranked = recommend({
      emotion: state.emotion,
      confidence: state.confidence,
      songs: merged,
      blend: state.blend,
      seed,
      recentIds: player.state.recentIds,
      previousIds: state.lastIds,
      limit: APP_CONFIG.recommend.limit,
    });
    state.profile = ranked.profile;
    state.target = ranked.target;
    state.list = ranked.list;
    state.uncertain = ranked.profile.uncertain;
  } catch (err) {
    if (seq !== requestSeq) return;
    state.onlineError =
      err?.code === 'OFFLINE'
        ? '当前离线，已使用本地曲库。'
        : err?.code === 'RATE_LIMIT'
          ? '在线曲库限流，稍后再试。本地曲目仍可播放。'
          : err?.message || '在线曲库不可用，已使用本地曲库。';
  } finally {
    if (seq === requestSeq) state.onlineLoading = false;
  }

  if (seq === requestSeq) {
    state.lastIds = state.list.slice(0, 2).map((item) => item.song.id);
  }
}

function applyResult(result) {
  if (!result) {
    return refresh(null, 0, { force: true });
  }
  return refresh(result.emotion ?? null, result.confidence ?? 0, { force: true });
}

function setEmotion(emotion, confidence = 0.9) {
  return refresh(emotion, confidence, { force: true });
}

function shuffle() {
  state.seed += 1;
  return refresh(state.emotion, state.confidence, { force: true, seed: state.seed });
}

function rerank() {
  if (!state.initialized) return Promise.resolve();
  return refresh(state.emotion, state.confidence, { force: true, seed: state.seed });
}

async function cacheSong(song) {
  if (!song || song.cached || state.cacheProgress[song.id] != null) return;
  state.cacheProgress[song.id] = 0.01;
  try {
    await saveCachedSong(song, (progress) => {
      state.cacheProgress[song.id] = Math.max(0.01, progress);
    });
    delete state.cacheProgress[song.id];
    toast('已缓存到本地，可离线播放。', 'success');
    await refreshCacheUsage();
    await refresh(state.emotion, state.confidence, { force: true });
  } catch (err) {
    delete state.cacheProgress[song.id];
    toast(err?.message || '缓存失败。', 'error');
  }
}

async function removeCached(song) {
  if (!song?.id) return;
  try {
    await deleteCachedSong(song.id);
    toast('已删除本地缓存。', 'info');
    await refreshCacheUsage();
    await refresh(state.emotion, state.confidence, { force: true });
  } catch (err) {
    toast(err?.message || '删除失败。', 'error');
  }
}

async function clearCache() {
  try {
    await clearAudioCache();
    await refreshCacheUsage();
    toast('本地缓存已清空。', 'success');
    await refresh(state.emotion, state.confidence, { force: true });
  } catch (err) {
    toast(err?.message || '清空失败。', 'error');
  }
}

async function init() {
  await refreshCacheUsage();
  if (state.initialized) return;
  state.initialized = true;
  await refresh(null, 0, { force: true });
}

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => {
    state.offline = true;
    state.onlineError = '当前离线，已使用本地曲库。';
  });
  window.addEventListener('online', () => {
    state.offline = false;
    state.onlineError = null;
    refresh(state.emotion, state.confidence, { force: true });
  });
}

function setMode(mode) {
  settings.mode = mode;
}

function setTune(tune) {
  settings.tune = Math.max(-0.3, Math.min(0.3, Number(tune) || 0));
}

let rerankTimer = null;

watch(
  () => [settings.mode, settings.tune, settings.online, settings.country],
  () => {
    if (!state.initialized) return;
    clearTimeout(rerankTimer);
    rerankTimer = setTimeout(() => rerank(), 280);
  },
);

export function useRecommendations() {
  return {
    state,
    init,
    refresh,
    applyResult,
    setEmotion,
    setMode,
    setTune,
    shuffle,
    rerank,
    cacheSong,
    removeCached,
    clearCache,
    refreshCacheUsage,
  };
}
