/**
 * scoring.js — 几何特征 + 表情 CNN 的融合评分（纯函数）
 *
 * 每个情绪：
 *   R_e = Σ w_geo * feature + w_expr * expression[e]
 *   P_e = R_e^gamma / Σ R_j^gamma
 *
 * 权重合计为 1.0，由 tests/scoring.test.mjs 校验。
 */
import { EMOTION_ORDER, EXPRESSION_KEYS, EXPRESSION_LABELS } from './taxonomy.js';

export const GAMMA = 1.15;
export const CONFIDENCE_THRESHOLD = 0.34;
export const MARGIN_THRESHOLD = 0.06;

export const WEIGHTS = {
  happy: {
    expr: 'happy',
    exprWeight: 0.6,
    geo: { smile: 0.2, mouthWidth: 0.1, eyeSquint: 0.1 },
  },
  sad: {
    expr: 'sad',
    exprWeight: 0.6,
    geo: { frown: 0.2, innerBrowRaise: 0.12, lipPress: 0.08 },
  },
  angry: {
    expr: 'angry',
    exprWeight: 0.6,
    geo: { browFurrow: 0.1, browSlope: 0.08, lipPress: 0.12, eyeSquint: 0.1 },
  },
  surprised: {
    expr: 'surprised',
    exprWeight: 0.65,
    geo: { eyeWide: 0.15, mouthOpen: 0.15, browRaise: 0.05 },
  },
  fearful: {
    expr: 'fearful',
    exprWeight: 0.66,
    geo: { eyeWide: 0.12, innerBrowRaise: 0.1, browRaise: 0.06, mouthOpen: 0.06 },
  },
  disgusted: {
    expr: 'disgusted',
    exprWeight: 0.82,
    geo: { upperLipRaise: 0.1, lipPress: 0.05, browFurrow: 0.03 },
  },
  calm: {
    expr: 'neutral',
    exprWeight: 0.75,
    geo: { lowActivation: 0.15 },
    inverseMax: 0.1,
  },
};

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

function normalizeExpressions(expressions) {
  const out = {};
  for (const key of EXPRESSION_KEYS) {
    out[key] = clamp01(expressions?.[key] ?? 0);
  }
  return out;
}

function maxGeoOf(features) {
  if (Number.isFinite(features?.maxGeo)) return features.maxGeo;
  return Math.max(
    features?.smile ?? 0,
    features?.frown ?? 0,
    features?.eyeWide ?? 0,
    features?.mouthOpen ?? 0,
    features?.browRaise ?? 0,
    features?.browFurrow ?? 0,
    features?.browSlope ?? 0,
  );
}

/**
 * @param {object} features  geometry.extractFeatures().features
 * @param {object} expressions face-api 的 7 类概率
 * @param {number} qualityPenalty 质量门控惩罚（默认 1）
 */
export function scoreEmotions(features, expressions, qualityPenalty = 1) {
  const f = features ?? {};
  const e = normalizeExpressions(expressions);
  const maxGeo = maxGeoOf(f);

  const hasFeature = [
    'smile',
    'frown',
    'eyeWide',
    'mouthOpen',
    'browRaise',
    'browFurrow',
    'browSlope',
    'lowActivation',
    'upperLipRaise',
    'innerBrowRaise',
  ].some((key) => (f[key] ?? 0) > 1e-6);
  const hasExpression = EXPRESSION_KEYS.some((key) => e[key] > 1e-6);
  if (!hasFeature && !hasExpression) {
    const uniform = 1 / EMOTION_ORDER.length;
    return {
      emotion: null,
      candidate: 'calm',
      confidence: 0,
      margin: 0,
      uncertain: true,
      rawScores: Object.fromEntries(EMOTION_ORDER.map((key) => [key, 0])),
      probabilities: Object.fromEntries(EMOTION_ORDER.map((key) => [key, uniform])),
      contributions: [],
      allContributions: Object.fromEntries(EMOTION_ORDER.map((key) => [key, []])),
      expressions: e,
    };
  }

  const rawScores = {};
  const contributions = {};

  for (const emotion of EMOTION_ORDER) {
    const config = WEIGHTS[emotion];
    const items = [];
    let score = 0;

    for (const [key, weight] of Object.entries(config.geo)) {
      const value = key === 'lowActivation' ? clamp01(f.lowActivation) : clamp01(f[key]);
      const weighted = weight * value;
      score += weighted;
      items.push({ key, label: key, value, weight, weighted });
    }

    if (config.inverseMax != null) {
      const value = clamp01(1 - maxGeo);
      const weighted = config.inverseMax * value;
      score += weighted;
      items.push({
        key: 'inverseMax',
        label: '1 - maxGeo',
        value,
        weight: config.inverseMax,
        weighted,
      });
    }

    const exprValue = e[config.expr] ?? 0;
    const exprWeighted = config.exprWeight * exprValue;
    score += exprWeighted;
    items.push({
      key: `expr.${config.expr}`,
      label: `表情·${EXPRESSION_LABELS[config.expr]}`,
      value: exprValue,
      weight: config.exprWeight,
      weighted: exprWeighted,
    });

    rawScores[emotion] = score;
    contributions[emotion] = items;
  }

  const sumPow = EMOTION_ORDER.reduce(
    (acc, key) => acc + Math.pow(rawScores[key], GAMMA),
    0,
  );

  const probabilities = {};
  for (const key of EMOTION_ORDER) {
    probabilities[key] =
      sumPow > 1e-9 ? Math.pow(rawScores[key], GAMMA) / sumPow : 1 / EMOTION_ORDER.length;
  }

  const ranked = [...EMOTION_ORDER].sort((a, b) => probabilities[b] - probabilities[a]);
  const top = ranked[0];
  const second = ranked[1];
  const margin = probabilities[top] - probabilities[second];
  const confidence = clamp01(probabilities[top] * clamp01(qualityPenalty));
  const uncertain = confidence < CONFIDENCE_THRESHOLD || margin < MARGIN_THRESHOLD;

  return {
    emotion: uncertain ? null : top,
    candidate: top,
    confidence,
    margin,
    uncertain,
    rawScores,
    probabilities,
    contributions: contributions[top],
    allContributions: contributions,
    expressions: e,
  };
}
