/**
 * rank.js — 情绪化歌曲排序（纯函数）
 *
 * tag = blend·tag(当前情绪) + (1−blend)·tag(修复目标情绪)
 * S = 40·tag + 22·valenceFit + 18·arousalFit + 10·freshness + 5·local + 5·jitter
 * 之后做贪心多样性重排，并保证结果中至少有一首本地/已缓存歌曲。
 *
 * blend 由推荐模式决定：同频共鸣=1、情绪修复=0、智能模式=按情绪与置信度自动计算。
 */
import { APP_CONFIG } from '../../config.js';
import { getProfile, RELATED_TAGS } from './profiles.js';
import { seededRandom } from './seed.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

const DEFAULT_WEIGHTS = APP_CONFIG.recommend.weights;

function tagScore(tags, emotion) {
  if (!Array.isArray(tags) || tags.length === 0) return 0;
  if (tags[0] === emotion) return 1;
  if (tags.includes(emotion)) return 0.6;
  const related = RELATED_TAGS[emotion] ?? [];
  if (tags.some((tag) => related.includes(tag))) return 0.25;
  return 0;
}

function scoreSong(song, profile, seed, recentIds, weights) {
  const target = profile.target;
  const blend = Number.isFinite(profile.blend) ? profile.blend : 1;
  const tagNow = tagScore(song.emotionTags, profile.emotion);
  const tagRepair = tagScore(song.emotionTags, profile.repairEmotion || profile.emotion);
  const tag = blend * tagNow + (1 - blend) * tagRepair;
  const valenceFit = 1 - Math.abs(clamp01(song.valence) - target.valence);
  const arousalFit = 1 - Math.abs(clamp01(song.arousal) - target.arousal);
  const freshness = recentIds.includes(song.id) ? 0.35 : 1;
  const localBonus = song.local || song.cached ? 1 : 0;
  const jitter = seededRandom(seed, song.id) * 2 - 1;

  const breakdown = {
    tag: weights.tag * tag,
    valence: weights.valence * valenceFit,
    arousal: weights.arousal * arousalFit,
    freshness: weights.freshness * freshness,
    local: weights.local * localBonus,
    jitter: weights.jitter * jitter,
  };
  const score = Math.min(
    100,
    Math.max(
      0,
      breakdown.tag +
        breakdown.valence +
        breakdown.arousal +
        breakdown.freshness +
        breakdown.local +
        breakdown.jitter,
    ),
  );

  const reasons = [];
  if (tagNow >= 1) reasons.push(`同频标签「${profile.label}」`);
  else if (tagNow >= 0.6) reasons.push(`次标签包含「${profile.label}」`);
  else if (tagNow >= 0.25) reasons.push('相关情绪过渡');
  if (tagRepair >= 1 && profile.repairEmotion && profile.repairEmotion !== profile.emotion) {
    reasons.push(`修复目标「${profile.repairLabel}」`);
  }
  if (valenceFit >= 0.85) reasons.push(`效价接近 ${target.valence.toFixed(2)}`);
  if (arousalFit >= 0.85) reasons.push(`唤醒度接近 ${target.arousal.toFixed(2)}`);
  if (localBonus) reasons.push(song.cached ? '已缓存，可离线播放' : '本地曲目，可离线播放');
  if (song.preview) reasons.push('30 秒试听');
  if (freshness < 1) reasons.push('最近听过，降低权重');

  return {
    song,
    score: Number(score.toFixed(2)),
    breakdown: Object.fromEntries(
      Object.entries(breakdown).map(([key, value]) => [key, Number(value.toFixed(2))]),
    ),
    reasons,
  };
}

/**
 * @param {object} options
 * @param {string|null} options.emotion
 * @param {number} options.confidence
 * @param {Array} options.songs
 * @param {number} options.blend
 * @param {number} options.seed
 * @param {string[]} options.recentIds
 * @param {string[]} options.previousIds 上一批的前 2 首（换一批时软惩罚）
 * @param {number} options.limit
 * @param {object} options.weights
 */
export function recommend({
  emotion,
  confidence = 1,
  songs = [],
  blend = APP_CONFIG.recommend.defaultBlend,
  seed = 0,
  recentIds = [],
  previousIds = [],
  limit = APP_CONFIG.recommend.limit,
  weights = DEFAULT_WEIGHTS,
}) {
  const profile = getProfile(emotion, confidence, blend);
  const scored = songs
    .filter((song) => song && (song.audioUrl || song.cached))
    .map((song) => scoreSong(song, profile, seed, recentIds, weights));

  const selected = [];
  const tagCounts = {};
  const pool = [...scored];

  while (selected.length < limit && pool.length > 0) {
    let bestIndex = -1;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const item = pool[i];
      let adjusted = item.score;
      if (selected.some((picked) => picked.song.artist && picked.song.artist === item.song.artist)) {
        adjusted -= 15;
      }
      if (selected.some((picked) => picked.song.genre && picked.song.genre === item.song.genre)) {
        adjusted -= 8;
      }
      const primary = item.song.emotionTags?.[0] ?? 'unknown';
      if ((tagCounts[primary] ?? 0) >= 2) adjusted -= 6;
      if (previousIds.includes(item.song.id)) adjusted -= 20;

      if (
        adjusted > bestAdjusted + 1e-9 ||
        (Math.abs(adjusted - bestAdjusted) < 1e-9 &&
          bestIndex >= 0 &&
          item.score > pool[bestIndex].score)
      ) {
        bestAdjusted = adjusted;
        bestIndex = i;
      }
    }

    if (bestIndex < 0) break;
    const chosen = pool.splice(bestIndex, 1)[0];
    const primary = chosen.song.emotionTags?.[0] ?? 'unknown';
    tagCounts[primary] = (tagCounts[primary] ?? 0) + 1;
    selected.push({ ...chosen, adjustedScore: Number(bestAdjusted.toFixed(2)) });
  }

  // 本地兜底：断网时至少有一首能播。
  if (!selected.some((item) => item.song.local || item.song.cached)) {
    const local = scored
      .filter((item) => item.song.local || item.song.cached)
      .sort((a, b) => b.score - a.score)[0];
    if (local) {
      const insertAt = Math.min(2, selected.length);
      selected.splice(insertAt, 0, { ...local, adjustedScore: local.score, inserted: true });
    }
  }

  return {
    profile,
    target: profile.target,
    uncertain: profile.uncertain,
    list: selected.slice(0, limit),
  };
}
