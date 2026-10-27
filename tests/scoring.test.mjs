import test from 'node:test';
import assert from 'node:assert/strict';
import { WEIGHTS, scoreEmotions } from '../src/core/emotion/scoring.js';
import { extractFeatures, zeroFeatures } from '../src/core/emotion/geometry.js';
import { EMOTION_ORDER } from '../src/core/emotion/taxonomy.js';
import { NEUTRAL_LANDMARKS } from './fixtures/landmarks-neutral.mjs';

const expressions = (top, value = 0.9) =>
  Object.fromEntries(
    ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'].map((key) => [
      key,
      key === top ? value : (1 - value) / 6,
    ]),
  );

test('scoring: 每个情绪的权重合计为 1', () => {
  for (const emotion of EMOTION_ORDER) {
    const config = WEIGHTS[emotion];
    const total =
      Object.values(config.geo).reduce((a, b) => a + b, 0) +
      config.exprWeight +
      (config.inverseMax ?? 0);
    assert.ok(Math.abs(total - 1) < 1e-9, `${emotion} 权重和=${total}`);
  }
});

test('scoring: 强笑 + happy 表情 → happy 第一', () => {
  const features = {
    ...extractFeatures(NEUTRAL_LANDMARKS).features,
    smile: 0.92,
    mouthWidth: 0.85,
    eyeSquint: 0.72,
    maxGeo: 0.92,
  };
  const result = scoreEmotions(features, expressions('happy', 0.92));
  assert.equal(result.candidate, 'happy');
  assert.equal(result.emotion, 'happy');
  assert.ok(result.confidence > 0.34, `confidence=${result.confidence}`);
});

test('scoring: 中性脸 + neutral 表情 → calm 第一', () => {
  const features = extractFeatures(NEUTRAL_LANDMARKS).features;
  const result = scoreEmotions(features, expressions('neutral', 0.95));
  assert.equal(result.candidate, 'calm');
  assert.equal(result.emotion, 'calm');
});

test('scoring: 全零输入 → 均匀分布且判为不确定', () => {
  const result = scoreEmotions(zeroFeatures(), Object.fromEntries(
    ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'].map((k) => [k, 0]),
  ));
  for (const key of EMOTION_ORDER) {
    assert.ok(Math.abs(result.probabilities[key] - 1 / 7) < 1e-9);
  }
  assert.equal(result.uncertain, true);
  assert.equal(result.emotion, null);
});

test('scoring: 贡献度加权和等于原始分', () => {
  const features = extractFeatures(NEUTRAL_LANDMARKS).features;
  const result = scoreEmotions(features, expressions('sad', 0.8));
  for (const emotion of EMOTION_ORDER) {
    const sum = result.allContributions[emotion].reduce((acc, item) => acc + item.weighted, 0);
    assert.ok(Math.abs(sum - result.rawScores[emotion]) < 1e-9, `${emotion} 贡献度不一致`);
    for (const item of result.allContributions[emotion]) {
      assert.ok(item.value >= 0 && item.value <= 1);
      assert.ok(item.weighted >= 0);
    }
  }
});

test('scoring: 质量惩罚会降低置信度', () => {
  const features = extractFeatures(NEUTRAL_LANDMARKS).features;
  const exprs = expressions('happy', 0.9);
  const normal = scoreEmotions(features, exprs, 1);
  const penalized = scoreEmotions(features, exprs, 0.7);
  assert.ok(penalized.confidence < normal.confidence);
});
