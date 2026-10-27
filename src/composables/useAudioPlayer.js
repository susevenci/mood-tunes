/**
 * useAudioPlayer.js — 单例音频播放器（本地/在线/缓存 Blob）。
 */
import { reactive, watch } from 'vue';
import { getCachedBlob } from '../core/storage/audioCache.js';
import { toast } from '../stores/uiState.js';
import { useSettings } from './useSettings.js';

const { settings } = useSettings();

const state = reactive({
  current: null,
  queue: [],
  index: -1,
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  volume: settings.volume,
  error: null,
  visualizer: false,
  recentIds: [],
});

let audio = null;
let ctx = null;
let analyser = null;
let freqData = null;
let blobUrl = null;

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'metadata';
  audio.crossOrigin = 'anonymous';
  audio.volume = settings.volume;

  audio.addEventListener('timeupdate', () => {
    state.time = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
  });
  audio.addEventListener('loadedmetadata', () => {
    state.duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    state.loading = false;
  });
  audio.addEventListener('play', () => {
    state.playing = true;
  });
  audio.addEventListener('pause', () => {
    state.playing = false;
  });
  audio.addEventListener('ended', () => {
    state.playing = false;
    next();
  });
  audio.addEventListener('error', () => {
    state.error = '音频播放失败，请重试或更换曲目。';
    state.playing = false;
    state.loading = false;
    toast(state.error, 'error');
  });
  return audio;
}

async function initAnalyser() {
  if (ctx) {
    if (ctx.state === 'suspended') await ctx.resume().catch(() => {});
    return;
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = new AudioCtx();
    const source = ctx.createMediaElementSource(audio);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    freqData = new Uint8Array(analyser.frequencyBinCount);
    state.visualizer = true;
  } catch {
    // 跨域音频没有 CORS 时无法接入 AnalyserNode，播放本身不受影响。
    state.visualizer = false;
  }
}

async function resolveUrl(song) {
  if (song.cached) {
    const blob = await getCachedBlob(song.id);
    if (!blob) throw new Error('本地缓存不存在，请重新缓存该曲目。');
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(blob);
    return blobUrl;
  }
  if (blobUrl) {
    URL.revokeObjectURL(blobUrl);
    blobUrl = null;
  }
  return song.audioUrl;
}

async function playSong(song, queue = state.queue, index = 0) {
  if (!song) return;
  ensureAudio();
  state.loading = true;
  state.error = null;
  try {
    const url = await resolveUrl(song);
    if (!url) throw new Error('该曲目没有可播放的音频地址。');
    state.current = song;
    state.queue = queue;
    state.index = index;
    state.time = 0;
    state.duration = 0;

    if (audio.src !== url) {
      audio.src = url;
      audio.load();
    } else {
      audio.currentTime = 0;
    }

    await initAnalyser();
    await audio.play();
    if (!state.recentIds.includes(song.id)) {
      state.recentIds = [song.id, ...state.recentIds].slice(0, 12);
    }
  } catch (err) {
    state.error = err?.name === 'NotAllowedError' ? '浏览器阻止了自动播放，请点击播放按钮。' : err?.message || '播放失败。';
    toast(state.error, 'error');
  } finally {
    state.loading = false;
  }
}

function playQueue(list, index = 0) {
  if (!Array.isArray(list) || !list.length) return;
  const safeIndex = Math.min(Math.max(0, index), list.length - 1);
  const song = list[safeIndex];
  return playSong(song, list, safeIndex);
}

function toggle() {
  if (!audio || !state.current) {
    if (state.queue.length) return playQueue(state.queue, Math.max(0, state.index));
    return;
  }
  if (state.playing) {
    audio.pause();
  } else {
    audio.play().catch((err) => {
      state.error = err?.message || '播放失败。';
      toast(state.error, 'error');
    });
  }
}

function pause() {
  audio?.pause();
}

function next() {
  if (!state.queue.length) return;
  const nextIndex = (state.index + 1) % state.queue.length;
  return playSong(state.queue[nextIndex], state.queue, nextIndex);
}

function previous() {
  if (!state.queue.length) return;
  const prevIndex = (state.index - 1 + state.queue.length) % state.queue.length;
  return playSong(state.queue[prevIndex], state.queue, prevIndex);
}

function seek(seconds) {
  if (!audio || !Number.isFinite(seconds)) return;
  audio.currentTime = Math.min(Math.max(0, seconds), audio.duration || 0);
}

function setVolume(value) {
  const volume = Math.min(1, Math.max(0, Number(value)));
  settings.volume = volume;
  state.volume = volume;
  if (audio) audio.volume = volume;
}

function getFrequencyData() {
  if (!analyser || !freqData) return null;
  analyser.getByteFrequencyData(freqData);
  return freqData;
}

watch(
  () => settings.volume,
  (value) => {
    state.volume = value;
    if (audio) audio.volume = value;
  },
);

export function useAudioPlayer() {
  return {
    state,
    playQueue,
    playSong,
    toggle,
    pause,
    next,
    previous,
    seek,
    setVolume,
    getFrequencyData,
  };
}
