const DB_NAME = 'zarplata-depo';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('razryady')) {
        db.createObjectStore('razryady', { keyPath: 'razryad' });
      }
      if (!db.objectStoreNames.contains('slesari')) {
        db.createObjectStore('slesari', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('lokomotivy')) {
        db.createObjectStore('lokomotivy', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('dopRaboty')) {
        db.createObjectStore('dopRaboty', { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains('dni')) {
        db.createObjectStore('dni', { keyPath: 'date' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

let dbPromise = null;
export function getDB() {
  if (!dbPromise) dbPromise = openDB();
  return dbPromise;
}

async function storeOf(storeName, mode) {
  const db = await getDB();
  return db.transaction(storeName, mode).objectStore(storeName);
}

export async function getAll(storeName) {
  const store = await storeOf(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function get(storeName, key) {
  const store = await storeOf(storeName, 'readonly');
  return new Promise((resolve, reject) => {
    const req = store.get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function put(storeName, value) {
  const store = await storeOf(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.put(value);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function remove(storeName, key) {
  const store = await storeOf(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.delete(key);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function clearStore(storeName) {
  const store = await storeOf(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const req = store.clear();
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export const STORES = ['razryady', 'slesari', 'lokomotivy', 'dopRaboty', 'dni', 'settings'];
