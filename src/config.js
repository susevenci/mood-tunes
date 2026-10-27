/**
 * 全局可调参数。算法/推荐/网络/缓存的所有“魔法数字”集中在这里，
 * 便于对照 docs/algorithm.md 与 docs/recommendation.md 调试。
 */
const BASE = import.meta.env?.BASE_URL ?? '/';

export const APP_CONFIG = {
  name: 'MoodTunes',
  version: '1.0.0',
  modelsPath: `${BASE}models`,

  engine: {
    imageInputSize: 512,
    videoInputSize: 320,
    lowPowerInputSize: 224,
    detectionThreshold: 0.35,
    targetFps: 8,
    lowPowerFps: 4,
    imageMaxWidth: 960,
    videoMaxWidth: 640,
  },

  thresholds: {
    confidence: 0.34,
    margin: 0.06,
    faceSize: 0.1,
    tiltDeg: 32,
    detectionScore: 0.5,
  },

  penalties: {
    smallFace: 0.7,
    tiltedFace: 0.75,
    lowDetection: 0.7,
  },

  smoothing: {
    window: 5,
    tauMs: 450,
    hysteresis: 0.07,
    holdMs: 500,
    lostFaceMs: 1200,
  },

  recommend: {
    mode: 'smart',
    tune: 0,
    defaultBlend: 0.7,
    limit: 6,
    online: true,
    country: 'tw',
    uncertainBlend: 0.5,
    weights: {
      tag: 40,
      valence: 22,
      arousal: 18,
      freshness: 10,
      local: 5,
      jitter: 5,
    },
  },

  itunes: {
    endpoint: 'https://itunes.apple.com/search',
    limit: 20,
    requestGapMs: 1500,
    timeoutMs: 8000,
    ttlMs: 10 * 60 * 1000,
  },

  cache: {
    maxSongs: 30,
    maxBytes: 150 * 1024 * 1024,
  },

  storage: {
    settingsKey: 'moodtunes:settings:v1',
    historyKey: 'moodtunes:history:v1',
    dbName: 'moodtunes',
    dbVersion: 1,
  },

  defaultSettings: {
    mode: 'smart',
    tune: 0,
    online: true,
    country: 'tw',
    debug: false,
    volume: 0.8,
    autoplay: false,
  },
};
