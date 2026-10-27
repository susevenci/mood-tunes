import test from 'node:test';
import assert from 'node:assert/strict';
import { recommend } from '../src/core/recommend/rank.js';
import { EMOTION_ORDER } from '../src/core/emotion/taxonomy.js';

const VECTORS = {
  happy: [0.82, 0.68],
  sad: [0.22, 0.28],
  angry: [0.3, 0.85],
  calm: [0.48, 0.22],
  surprised: [0.78, 0.78],
  fearful: [0.24, 0.62],
  disgusted: [0.3, 0.45],
};

const LOCAL = EMOTION_ORDER.map((emotion) => ({
  id: `local-${emotion}`,
  source: 'local',
  title: `${emotion} local`,
  artist: `Local Artist ${emotion}`,
  album: 'Local',
  cover: '',
  audioUrl: `/audio/${emotion}.mp3`,
  duration: 120,
  preview: false,
  emotionTags: [emotion],
  valence: VECTORS[emotion][0],
  arousal: VECTORS[emotion][1],
  tempo: 100,
  genre: `local-genre-${emotion}`,
  local: true,
  cached: false,
}));

const ONLINE = Array.from({ length: 6 }, (_, index) => ({
  id: `itunes-${index}`,
  source: 'itunes',
  title: `online ${index}`,
  artist: `Online Artist ${index}`,
  album: 'Online',
  cover: '',
  audioUrl: `https://example.com/${index}.m4a`,
  duration: 30,
  preview: true,
  emotionTags: ['happy'],
  valence: 0.82,
  arousal: 0.68,
  tempo: null,
  genre: `online-genre-${index}`,
  local: false,
  cached: false,
}));

test('rank: 每种情绪的第一名与标签匹配', () => {
  for (const emotion of EMOTION_ORDER) {
    const result = recommend({
      emotion,
      confidence: 0.9,
      songs: [...LOCAL, ...ONLINE],
      blend: 0.7,
      seed: 3,
    });
    assert.equal(result.list[0].song.emotionTags[0], emotion, `${emotion} 第一名不符`);
    assert.equal(result.list.length, 6);
  }
});

test('rank: 结果中至少有一首本地/缓存曲目', () => {
  for (const emotion of EMOTION_ORDER) {
    const result = recommend({ emotion, confidence: 0.9, songs: [...LOCAL, ...ONLINE], seed: 2 });
    assert.ok(
      result.list.some((item) => item.song.local || item.song.cached),
      `${emotion} 缺少本地兜底`,
    );
  }
});

test('rank: 同 seed 结果完全可复现', () => {
  const options = { emotion: 'sad', confidence: 0.9, songs: [...LOCAL, ...ONLINE], seed: 42 };
  const a = recommend(options);
  const b = recommend(options);
  assert.deepEqual(
    a.list.map((item) => item.song.id),
    b.list.map((item) => item.song.id),
  );
});

test('rank: 同艺人惩罚限制重复', () => {
  const sameArtist = [0, 1, 2].map((index) => ({
    ...ONLINE[index],
    id: `same-${index}`,
    artist: 'Same Artist',
    genre: 'same-genre',
    emotionTags: ['happy'],
    valence: 0.82,
    arousal: 0.68,
  }));
  const others = Array.from({ length: 5 }, (_, index) => ({
    ...ONLINE[index],
    id: `other-${index}`,
    artist: `Other ${index}`,
    genre: `other-genre-${index}`,
    emotionTags: ['happy'],
    valence: 0.82,
    arousal: 0.68,
  }));
  const result = recommend({
    emotion: 'happy',
    confidence: 0.9,
    songs: [...LOCAL, ...sameArtist, ...others],
    limit: 6,
    seed: 1,
  });
  const count = result.list.filter((item) => item.song.artist === 'Same Artist').length;
  assert.ok(count <= 2, `同艺人出现 ${count} 次`);
});

test('rank: 低置信度回落到平静方案', () => {
  const result = recommend({
    emotion: 'happy',
    confidence: 0.1,
    songs: [...LOCAL, ...ONLINE],
    blend: 0.9,
  });
  assert.equal(result.profile.emotion, 'calm');
  assert.equal(result.profile.uncertain, true);
  assert.equal(result.uncertain, true);
});

test('rank: 空曲库安全返回', () => {
  const result = recommend({ emotion: 'happy', confidence: 0.9, songs: [] });
  assert.deepEqual(result.list, []);
  assert.equal(result.profile.emotion, 'happy');
});
