import test from 'node:test';
import assert from 'node:assert/strict';
import { EmotionSmoother } from '../src/core/emotion/smoother.js';
import { EMOTION_ORDER } from '../src/core/emotion/taxonomy.js';

const probs = (emotion, value = 0.9) => {
  const rest = (1 - value) / (EMOTION_ORDER.length - 1);
  return Object.fromEntries(EMOTION_ORDER.map((key) => [key, key === emotion ? value : rest]));
};

test('smoother: 稳定输入建立标签', () => {
  const smoother = new EmotionSmoother();
  let state;
  for (let i = 0; i < 20; i += 1) state = smoother.push(probs('happy'), 1000 + i * 125);
  assert.equal(state.emotion, 'happy');
  assert.ok(state.confidence > 0.8);
});

test('smoother: 单帧尖峰不会切换标签', () => {
  const smoother = new EmotionSmoother();
  let ts = 0;
  for (let i = 0; i < 10; i += 1) smoother.push(probs('happy'), (ts += 125));
  smoother.push(probs('sad', 0.95), (ts += 125));
  const state = smoother.push(probs('happy'), (ts += 125));
  assert.equal(state.emotion, 'happy');
});

test('smoother: 持续变化超过滞回时间后切换', () => {
  const smoother = new EmotionSmoother();
  let ts = 0;
  for (let i = 0; i < 10; i += 1) smoother.push(probs('happy'), (ts += 125));
  let state;
  for (let i = 0; i < 12; i += 1) state = smoother.push(probs('sad', 0.95), (ts += 125));
  assert.equal(state.emotion, 'sad');
});

test('smoother: 长时间无人脸后清空标签', () => {
  const smoother = new EmotionSmoother();
  let ts = 0;
  for (let i = 0; i < 10; i += 1) smoother.push(probs('angry'), (ts += 125));
  const state = smoother.handleNoFace(ts + 1300);
  assert.equal(state.emotion, null);
  assert.equal(state.changed, true);
});
