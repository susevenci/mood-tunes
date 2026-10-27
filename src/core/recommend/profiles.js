/**
 * profiles.js — 情绪 → 推荐目标（效价/唤醒度）、检索词、修复目标、本地兜底曲目。
 * 数值与 docs/recommendation.md 的表格保持一致。
 */
import { EMOTIONS } from '../emotion/taxonomy.js';
import { CONFIDENCE_THRESHOLD } from '../emotion/scoring.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export const RELATED_TAGS = {
  happy: ['surprised'],
  sad: ['calm'],
  angry: ['disgusted'],
  calm: ['sad'],
  surprised: ['happy'],
  fearful: ['disgusted', 'sad'],
  disgusted: ['angry'],
};

/** 三种推荐模式。 */
export const RECOMMEND_MODES = {
  smart: {
    key: 'smart',
    label: '智能模式',
    short: '智能',
    icon: 'sparkles',
    desc: '按当前情绪与置信度自动决定共鸣还是修复',
  },
  resonance: {
    key: 'resonance',
    label: '同频共鸣',
    short: '共鸣',
    icon: 'wave',
    desc: '顺着当前情绪选歌，被理解优先',
  },
  repair: {
    key: 'repair',
    label: '情绪修复',
    short: '修复',
    icon: 'heart',
    desc: '把情绪往更舒服的方向带，转换优先',
  },
};

export const MODE_ORDER = ['smart', 'resonance', 'repair'];

/** 智能模式下各情绪的共鸣基准（0=纯修复，1=纯共鸣）。 */
export const SMART_BASE = {
  happy: 0.85,
  sad: 0.55,
  angry: 0.45,
  calm: 0.6,
  surprised: 0.75,
  fearful: 0.45,
  disgusted: 0.5,
};

export const EMOTION_PROFILES = {
  happy: {
    empathy: { valence: 0.82, arousal: 0.68 },
    heal: { valence: 0.74, arousal: 0.5 },
    repair: 'happy',
    terms: {
      us: ['happy upbeat', 'feel good songs'],
      tw: ['快乐 轻快', '开心 流行'],
    },
    localId: 'local-happy-alley',
  },
  sad: {
    empathy: { valence: 0.28, arousal: 0.28 },
    heal: { valence: 0.55, arousal: 0.38 },
    repair: 'calm',
    terms: {
      us: ['sad piano melancholy', 'healing piano'],
      tw: ['伤感 钢琴', '治愈 钢琴'],
    },
    localId: 'local-heartbreaking',
  },
  angry: {
    empathy: { valence: 0.28, arousal: 0.85 },
    heal: { valence: 0.45, arousal: 0.55 },
    repair: 'calm',
    terms: {
      us: ['angry rock intense', 'workout rock'],
      tw: ['摇滚 愤怒', '热血 摇滚'],
    },
    localId: 'local-volatile-reaction',
  },
  calm: {
    empathy: { valence: 0.55, arousal: 0.25 },
    heal: { valence: 0.62, arousal: 0.18 },
    repair: 'calm',
    terms: {
      us: ['calm ambient relaxing', 'relaxing piano'],
      tw: ['轻音乐 放松', '安静 纯音乐'],
    },
    localId: 'local-peaceful-desolation',
  },
  surprised: {
    empathy: { valence: 0.78, arousal: 0.78 },
    heal: { valence: 0.65, arousal: 0.55 },
    repair: 'happy',
    terms: {
      us: ['quirky playful', 'electro swing'],
      tw: ['俏皮 欢快', '轻快 节奏'],
    },
    localId: 'local-monkeys-spinning-monkeys',
  },
  fearful: {
    empathy: { valence: 0.24, arousal: 0.62 },
    heal: { valence: 0.55, arousal: 0.35 },
    repair: 'calm',
    terms: {
      us: ['dark ambient suspense', 'cinematic tension'],
      tw: ['悬疑 配乐', '暗黑 氛围'],
    },
    localId: 'local-anxiety',
  },
  disgusted: {
    empathy: { valence: 0.3, arousal: 0.45 },
    heal: { valence: 0.55, arousal: 0.45 },
    repair: 'calm',
    terms: {
      us: ['dark jazz moody', 'experimental ambient'],
      tw: ['暗黑 爵士', '氛围 实验'],
    },
    localId: 'local-the-house-of-leaves',
  },
};

/**
 * 计算当前生效的共鸣比例（0=纯情绪修复，1=纯同频共鸣）。
 * 情绪不明显（无标签或置信度不足）时固定 0.5。
 */
export function resolveBlend({ emotion, confidence = 1, mode = 'smart', tune = 0 } = {}) {
  if (!emotion || !EMOTION_PROFILES[emotion] || confidence < CONFIDENCE_THRESHOLD) return 0.5;
  if (mode === 'resonance') return 1;
  if (mode === 'repair') return 0;
  const strength = (clamp01(confidence) - 0.5) * 0.3;
  const offset = Number.isFinite(tune) ? Math.max(-0.3, Math.min(0.3, tune)) : 0;
  return clamp01(SMART_BASE[emotion] + strength + offset);
}

/**
 * 生成当前推荐配置。
 * @param {string|null} emotion
 * @param {number} confidence
 * @param {number} blend 0=情绪修复，1=同频共鸣
 */
export function getProfile(emotion, confidence = 1, blend = 0.7) {
  const uncertain = !emotion || !EMOTION_PROFILES[emotion] || confidence < CONFIDENCE_THRESHOLD;
  const key = uncertain ? 'calm' : emotion;
  const base = EMOTION_PROFILES[key];
  const w = uncertain ? 0.5 : clamp01(Number.isFinite(blend) ? blend : 0.7);
  return {
    emotion: key,
    requestedEmotion: emotion ?? null,
    label: EMOTIONS[key].label,
    color: EMOTIONS[key].color,
    uncertain,
    blend: w,
    repairEmotion: uncertain ? 'calm' : base.repair,
    repairLabel: EMOTIONS[uncertain ? 'calm' : base.repair].label,
    target: {
      valence: w * base.empathy.valence + (1 - w) * base.heal.valence,
      arousal: w * base.empathy.arousal + (1 - w) * base.heal.arousal,
    },
    terms: base.terms,
    localId: base.localId,
  };
}
