/**
 * idb.js — 极简 IndexedDB Promise 封装（无第三方依赖）。
 * 数据库：moodtunes v1
 * stores: audio(id, blob) / catalog(id, meta) / plays(autoIncrement) / meta(key)
 */
import { APP_CONFIG } from '../../config.js';

let dbPromise = null;

export function isIndexedDbAvailable() {
  return typeof indexedDB !== 'undefined';
}

export function openDB() {
  if (!isIndexedDbAvailable()) return Promise.reject(new Error('IndexedDB 不可用'));
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(APP_CONFIG.storage.dbName, APP_CONFIG.storage.dbVersion);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('catalog')) db.createObjectStore('catalog', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('plays')) db.createObjectStore('plays', { autoIncrement: true });
      if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'));
    request.onblocked = () => reject(new Error('IndexedDB 被其他标签页占用'));
  });
  return dbPromise;
}

async function store(name, mode) {
  const db = await openDB();
  return db.transaction(name, mode).objectStore(name);
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function idbGet(name, key) {
  return wrap((await store(name, 'readonly')).get(key));
}

export async function idbGetAll(name) {
  return wrap((await store(name, 'readonly')).getAll());
}

export async function idbKeys(name) {
  return wrap((await store(name, 'readonly')).getAllKeys());
}

export async function idbPut(name, value) {
  return wrap((await store(name, 'readwrite')).put(value));
}

export async function idbDelete(name, key) {
  return wrap((await store(name, 'readwrite')).delete(key));
}

export async function idbClear(name) {
  return wrap((await store(name, 'readwrite')).clear());
}
