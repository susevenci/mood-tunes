/**
 * itunesMapper.js — iTunes Search API JSON → 统一 Song 模型（纯函数，便于单测）
 */
import { seededRandom } from '../seed.js';

const clamp01 = (v) => Math.min(1, Math.max(0, Number.isFinite(v) ? v : 0));

export function upgradeArtwork(url) {
  if (typeof url !== 'string' || !url) return '';
  return url.replace(/\/\d+x\d+bb/, '/400x400bb');
}

/**
 * @param {object} payload iTunes 原始 JSON
 * @param {object} options { emotion, target:{valence,arousal}, seed }
 */
export function mapItunesResults(payload, options = {}) {
  const { emotion = 'calm', target = { valence: 0.5, arousal: 0.5 }, seed = 0 } = options;
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const seen = new Set();

  return results
    .filter((item) => {
      if (!item || item.kind !== 'song') return false;
      if (item.trackId == null) return false;
      if (typeof item.previewUrl !== 'string' || !/^https?:\/\//i.test(item.previewUrl)) return false;
      if (seen.has(item.trackId)) return false;
      seen.add(item.trackId);
      return true;
    })
    .map((item) => {
      const jitterV = (seededRandom(seed, `${item.trackId}|v`) * 2 - 1) * 0.06;
      const jitterA = (seededRandom(seed, `${item.trackId}|a`) * 2 - 1) * 0.06;
      const trackViewUrl = item.trackViewUrl || item.collectionViewUrl || '';
      return {
        id: `itunes-${item.trackId}`,
        source: 'itunes',
        title: item.trackName || '未知曲目',
        artist: item.artistName || '未知艺人',
        album: item.collectionName || '',
        cover: upgradeArtwork(item.artworkUrl100),
        audioUrl: item.previewUrl,
        duration: 30,
        preview: true,
        emotionTags: [emotion],
        valence: clamp01((target.valence ?? 0.5) + jitterV),
        arousal: clamp01((target.arousal ?? 0.5) + jitterA),
        tempo: null,
        genre: item.primaryGenreName || 'music',
        local: false,
        cached: false,
        trackViewUrl,
        attribution: {
          text: '试听片段由 Apple iTunes Search API 提供，版权归原权利人所有',
          url: trackViewUrl,
        },
      };
    });
}
