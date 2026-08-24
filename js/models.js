import { getAll, get, put, remove } from './db.js';

const DEFAULT_SETTINGS = { key: 'main', ndfl: 0.13, zonalnaya: 0.5, avansStart: 1, avansEnd: 15, smenaChasovDefault: 11 };
export const RAZRYAD_MIN = 3;
export const RAZRYAD_MAX = 6;

export async function ensureDefaults() {
  const existing = await getAll('razryady');
  if (existing.length === 0) {
    for (let r = RAZRYAD_MIN; r <= RAZRYAD_MAX; r++) {
      await put('razryady', { razryad: r, stavka: 0, koef: 1 });
    }
  } else {
    for (const r of existing) {
      if (r.razryad < RAZRYAD_MIN || r.razryad > RAZRYAD_MAX) {
        await remove('razryady', r.razryad);
      }
    }
  }
  const settings = await get('settings', 'main');
  if (!settings) {
    await put('settings', DEFAULT_SETTINGS);
  } else if (settings.smenaChasovDefault === undefined) {
    await put('settings', { ...DEFAULT_SETTINGS, ...settings });
  }
}

export async function getSettings() {
  const s = await get('settings', 'main');
  return s || DEFAULT_SETTINGS;
}
export function saveSettings(settings) {
  return put('settings', { ...settings, key: 'main' });
}

export function getRazryady() { return getAll('razryady'); }
export function saveRazryad(r) { return put('razryady', r); }

export function getSlesari() { return getAll('slesari'); }
export function getSlesar(id) { return get('slesari', id); }
export function saveSlesar(s) { return put('slesari', s); }
export function deleteSlesar(id) { return remove('slesari', id); }

export function getLokomotivy() { return getAll('lokomotivy'); }
export function getLokomotiv(id) { return get('lokomotivy', id); }
export function saveLokomotiv(l) { return put('lokomotivy', l); }
export function deleteLokomotiv(id) { return remove('lokomotivy', id); }

export function getDopRabotyAll() { return getAll('dopRaboty'); }
export function getDopRabota(id) { return get('dopRaboty', id); }
export function saveDopRabota(d) { return put('dopRaboty', d); }
export function deleteDopRabota(id) { return remove('dopRaboty', id); }

export function getDen(date) { return get('dni', date); }
export function getDniAll() { return getAll('dni'); }
export function saveDen(d) { return put('dni', d); }
export function deleteDen(date) { return remove('dni', date); }

export function uid() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
}

export async function buildMaps() {
  const [slesari, lokomotivy, dopRaboty, razryady, dni, settings] = await Promise.all([
    getSlesari(), getLokomotivy(), getDopRabotyAll(), getRazryady(), getDniAll(), getSettings()
  ]);
  return {
    slesari, lokomotivy, dopRaboty, razryady, dni, settings,
    slesariMap: new Map(slesari.map(s => [s.id, s])),
    lokomotivyMap: new Map(lokomotivy.map(l => [l.id, l])),
    dopRabotyMap: new Map(dopRaboty.map(d => [d.id, d])),
    razryadyMap: new Map(razryady.map(r => [r.razryad, r])),
  };
}
