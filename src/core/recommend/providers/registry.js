/**
 * registry.js — 曲库适配层。
 *
 * 当前启用：local / cache / itunes。
 * 扩展：实现 { id, label, available(), search(ctx) } 后 registerProvider 即可；
 * 未来若接入网易云等第三方源，应放在独立 provider 中，不影响推荐与播放层。
 */
import { cacheProvider } from './cacheProvider.js';
import { itunesProvider } from './itunesProvider.js';
import { localProvider } from './localProvider.js';

const providers = new Map();

export function registerProvider(provider) {
  if (!provider?.id) throw new Error('Provider 必须有 id');
  providers.set(provider.id, provider);
}

export function getProvider(id) {
  return providers.get(id);
}

export function listProviders() {
  return [...providers.values()];
}

registerProvider(localProvider);
registerProvider(cacheProvider);
registerProvider(itunesProvider);

/** 离线候选：本地曲库 + 已缓存试听。 */
export async function getOfflineCandidates() {
  const [local, cached] = await Promise.all([localProvider.search(), cacheProvider.search()]);
  const map = new Map();
  for (const song of [...local, ...cached]) {
    if (!map.has(song.id)) map.set(song.id, song);
  }
  return [...map.values()];
}

/** 在线候选：当前只启用 iTunes。 */
export async function getOnlineCandidates(options) {
  return itunesProvider.search(options);
}

/** 未启用的扩展占位：接口形状与真实 provider 一致。 */
export const neteaseProviderStub = {
  id: 'netease',
  label: '网易云（未启用）',
  available: () => false,
  async search() {
    return [];
  },
};
