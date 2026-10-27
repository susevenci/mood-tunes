/**
 * localProvider.js — 内置 CC-BY 曲库（7 首器乐曲）。
 */
import { LOCAL_SONGS } from '../../../data/localSongs.js';

export const localProvider = {
  id: 'local',
  label: '本地曲库',
  available: () => true,
  async search() {
    return LOCAL_SONGS.map((song) => ({ ...song }));
  },
};
