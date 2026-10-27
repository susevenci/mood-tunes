/**
 * seed.js — 可复现的伪随机数（FNV-1a + mulberry32），用于「换一批」抖动。
 */
export function hashString(input) {
  let hash = 2166136261;
  const str = String(input);
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 返回 [0,1) 的可复现随机数。 */
export function seededRandom(seed, key = '') {
  return mulberry32(hashString(`${seed}|${key}`))();
}

/** 用 seed 从数组中选择一项。 */
export function seededIndex(seed, length, salt = '') {
  if (!length) return 0;
  return Math.min(length - 1, Math.floor(seededRandom(seed, salt) * length));
}
