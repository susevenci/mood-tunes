import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mapItunesResults, upgradeArtwork } from '../src/core/recommend/providers/itunesMapper.js';

const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/itunes-search.json', import.meta.url), 'utf8'),
);

test('itunesMapper: 只保留有试听的 song', () => {
  const songs = mapItunesResults(fixture, {
    emotion: 'happy',
    target: { valence: 0.8, arousal: 0.7 },
    seed: 1,
  });
  assert.equal(songs.length, 2);
  assert.deepEqual(
    songs.map((song) => song.id),
    ['itunes-1001', 'itunes-1002'],
  );
  assert.ok(songs.every((song) => song.preview === true && song.duration === 30));
  assert.ok(songs.every((song) => song.emotionTags[0] === 'happy'));
});

test('itunesMapper: 封面升级与字段映射', () => {
  const songs = mapItunesResults(fixture, { emotion: 'sad', target: { valence: 0.4, arousal: 0.3 } });
  assert.equal(songs[0].cover, 'https://is1-ssl.mzstatic.com/image/thumb/Music/abc/400x400bb.jpg');
  assert.equal(songs[1].cover, 'https://is1-ssl.mzstatic.com/image/thumb/Music/def/400x400bb.jpg');
  assert.equal(songs[0].artist, 'Test Artist');
  assert.equal(songs[1].trackViewUrl, 'https://music.apple.com/cn/album/another/1002');
  assert.ok(songs[0].valence >= 0 && songs[0].valence <= 1);
  assert.ok(songs[0].arousal >= 0 && songs[0].arousal <= 1);
});

test('itunesMapper: upgradeArtwork 处理空值', () => {
  assert.equal(upgradeArtwork(''), '');
  assert.equal(upgradeArtwork(null), '');
  assert.equal(upgradeArtwork('https://x/60x60bb.png'), 'https://x/400x400bb.png');
});

test('itunesMapper: 非数组输入安全返回', () => {
  assert.deepEqual(mapItunesResults(null), []);
  assert.deepEqual(mapItunesResults({ resultCount: 0 }), []);
});
