/**
 * history.js — 情绪历史持久化（只保存标签/置信度/时间，不保存图像）。
 */
import { APP_CONFIG } from '../../config.js';

const KEY = APP_CONFIG.storage.historyKey;
const LIMIT = 20;

export function loadHistory() {
  try {
    const list = JSON.parse(localStorage.getItem(KEY) || '[]');
    if (!Array.isArray(list)) return [];
    return list
      .filter((item) => item && typeof item.ts === 'number' && typeof item.emotion === 'string')
      .slice(0, LIMIT);
  } catch {
    return [];
  }
}

export function saveHistory(list) {
  try {
    localStorage.setItem(KEY, JSON.stringify((list || []).slice(0, LIMIT)));
  } catch {
    // ignore
  }
}

export function clearHistoryStorage() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
