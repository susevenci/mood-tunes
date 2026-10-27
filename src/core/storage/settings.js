/**
 * settings.js — 设置持久化（localStorage，失败时静默降级）。
 */
import { APP_CONFIG } from '../../config.js';

const KEY = APP_CONFIG.storage.settingsKey;
const MODES = ['smart', 'resonance', 'repair'];

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function normalize(raw) {
  const defaults = APP_CONFIG.defaultSettings;
  const source = raw && typeof raw === 'object' ? raw : {};

  let mode = MODES.includes(source.mode) ? source.mode : null;
  let tune = Number.isFinite(source.tune) ? clamp(source.tune, -0.3, 0.3) : null;

  // 兼容旧版本：只有 blend 滑杆时映射到模式 + 微调。
  if (!mode && Number.isFinite(source.blend)) {
    const blend = clamp(source.blend, 0, 1);
    if (blend >= 0.95) mode = 'resonance';
    else if (blend <= 0.05) mode = 'repair';
    else {
      mode = 'smart';
      tune = clamp(blend - 0.7, -0.3, 0.3);
    }
  }

  return {
    mode: mode ?? defaults.mode,
    tune: tune ?? defaults.tune,
    online: typeof source.online === 'boolean' ? source.online : defaults.online,
    country: source.country === 'us' ? 'us' : 'tw',
    debug: typeof source.debug === 'boolean' ? source.debug : defaults.debug,
    volume: Number.isFinite(source.volume) ? clamp(source.volume, 0, 1) : defaults.volume,
    autoplay: typeof source.autoplay === 'boolean' ? source.autoplay : defaults.autoplay,
  };
}

export function loadSettings() {
  try {
    return normalize(JSON.parse(localStorage.getItem(KEY) || 'null'));
  } catch {
    return normalize(null);
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalize(settings)));
  } catch {
    // 隐私模式/配额不足时忽略。
  }
}

export function resetSettings() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
  return normalize(null);
}
