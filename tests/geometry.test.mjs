import test from 'node:test';
import assert from 'node:assert/strict';
import { extractFeatures, normalizeLandmarks } from '../src/core/emotion/geometry.js';
import { NEUTRAL_LANDMARKS, cloneLandmarks } from './fixtures/landmarks-neutral.mjs';

function transform(points, fn) {
  return points.map(([x, y]) => fn(x, y));
}

function rotate(points, degrees, cx = 320, cy = 250) {
  const rad = (degrees * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return points.map(([x, y]) => {
    const dx = x - cx;
    const dy = y - cy;
    return [cx + dx * cos - dy * sin, cy + dx * sin + dy * cos];
  });
}

test('geometry: 68 点可归一化并输出有限特征', () => {
  const norm = normalizeLandmarks(NEUTRAL_LANDMARKS);
  assert.equal(norm.ok, true);
  assert.ok(norm.d > 0);
  const { ok, features } = extractFeatures(NEUTRAL_LANDMARKS);
  assert.equal(ok, true);
  for (const [key, value] of Object.entries(features)) {
    assert.ok(Number.isFinite(value), `${key} 应为有限数`);
    assert.ok(value >= 0 && value <= 1, `${key} 应在 0..1`);
  }
});

test('geometry: 平移 + 等比缩放后特征基本不变', () => {
  const base = extractFeatures(NEUTRAL_LANDMARKS).features;
  const scaled = transform(NEUTRAL_LANDMARKS, (x, y) => [(x - 320) * 1.6 + 700, (y - 250) * 1.6 + 120]);
  const after = extractFeatures(scaled).features;
  for (const key of ['smile', 'frown', 'eyeOpen', 'browRaise', 'browFurrow', 'mouthOpen']) {
    assert.ok(Math.abs(base[key] - after[key]) < 0.06, `${key} 缩放后漂移过大`);
  }
});

test('geometry: ±15° 旋转后特征基本不变', () => {
  const base = extractFeatures(NEUTRAL_LANDMARKS).features;
  for (const deg of [-15, 15]) {
    const after = extractFeatures(rotate(NEUTRAL_LANDMARKS, deg)).features;
    for (const key of ['smile', 'frown', 'eyeOpen', 'browRaise', 'mouthWidth']) {
      assert.ok(Math.abs(base[key] - after[key]) < 0.08, `${key} 在 ${deg}° 漂移过大`);
    }
  }
});

test('geometry: 嘴角上抬使 smile 增大、frown 减小', () => {
  const base = extractFeatures(NEUTRAL_LANDMARKS).features;
  const smiling = cloneLandmarks();
  for (const index of [48, 54]) smiling[index][1] -= 7;
  for (const index of [49, 53]) smiling[index][1] -= 4;
  const after = extractFeatures(smiling).features;
  assert.ok(after.smile > base.smile + 0.2, 'smile 应显著增大');
  assert.ok(after.frown <= base.frown + 1e-9, 'frown 不应增大');
});

test('geometry: 上眼睑下移使眼睛开合度下降', () => {
  const base = extractFeatures(NEUTRAL_LANDMARKS).features;
  const closing = cloneLandmarks();
  for (const index of [37, 38, 43, 44]) closing[index][1] += 7;
  const after = extractFeatures(closing).features;
  assert.ok(after.eyeOpen < base.eyeOpen - 0.2, 'eyeOpen 应显著下降');
  assert.ok(after.eyeSquint > base.eyeSquint, 'eyeSquint 应上升');
});

test('geometry: 瞳距为 0 / 点数不足时安全返回', () => {
  const zero = Array.from({ length: 68 }, () => [0, 0]);
  const result = extractFeatures(zero);
  assert.equal(result.ok, false);
  assert.equal(result.features.smile, 0);
  assert.equal(normalizeLandmarks([[1, 2]]).ok, false);
});
