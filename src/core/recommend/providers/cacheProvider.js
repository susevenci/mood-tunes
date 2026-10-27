/**
 * cacheProvider.js — 已缓存到 IndexedDB 的在线试听。
 */
import { getCachedSongMeta } from '../../storage/audioCache.js';

export const cacheProvider = {
  id: 'cache',
  label: '已缓存',
  available: () => true,
  async search() {
    return getCachedSongMeta();
  },
};
