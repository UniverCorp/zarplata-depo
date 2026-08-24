import { getAll, get, put, remove } from './db.js';

const DEFAULT_SETTINGS = { key: 'main', ndfl: 0.13, zonalnaya: 0.5, avansStart: 1, avansEnd: 15, smenaChasovDefault: 11 };
export const RAZRYAD_MIN = 3;
export const RAZRYAD_MAX = 6;

// Тарифные ставки депо "Астраханское" на 01.04.2026 (разряды 3-6, работы 2-го уровня).
const DEFAULT_RAZRYADY = [
  { razryad: 3, stavka: 143.80, koef: 1.63 },
  { razryad: 4, stavka: 166.74, koef: 1.89 },
  { razryad: 5, stavka: 187.03, koef: 2.12 },
  { razryad: 6, stavka: 203.79, koef: 2.31 },
];

// Расценочная ведомость депо — только "Диз. вспомогательная группа" по каждому тепловозу/ремонту.
const DEFAULT_LOKOMOTIVY = [
  {
    seria: 'ЧМЭ3', sections: ['A'],
    remonty: [
      { tip: 'ТО-3', normaChasov: 16.17, stoimostZaSektsiyu: 2749.22 },
      { tip: 'ТР-1', normaChasov: 31.8, stoimostZaSektsiyu: 4835.51 },
    ],
  },
  {
    seria: 'ТЭМ14', sections: ['A'],
    remonty: [
      { tip: 'ТО-3', normaChasov: 20.17, stoimostZaSektsiyu: 3350.64 },
      { tip: 'ТР-1', normaChasov: 58.57, stoimostZaSektsiyu: 8654.30 },
    ],
  },
  {
    seria: '2ТЭ25КМ', sections: ['A', 'Б'],
    remonty: [
      { tip: 'ТО-3', normaChasov: 36.13, stoimostZaSektsiyu: 6142.82 },
      { tip: 'ТР-1', normaChasov: 89.98, stoimostZaSektsiyu: 15122.94 },
    ],
  },
  {
    seria: '2ТЭ116', sections: ['A', 'Б'],
    remonty: [
      { tip: 'ТО-3', normaChasov: 31.6, stoimostZaSektsiyu: 5372.63 },
      { tip: 'ТР-1', normaChasov: 66.3, stoimostZaSektsiyu: 11143.04 },
    ],
  },
];

const DEFAULT_SLESARI = [
  { familia: 'Афанасьева', razryad: 5, active: true, showOnHome: true },
  { familia: 'Быценко', razryad: 6, active: true, showOnHome: false },
  { familia: 'Гурьянов', razryad: 5, active: true, showOnHome: false },
  { familia: 'Медведев', razryad: 4, active: true, showOnHome: false },
  { familia: 'Иргалиев', razryad: 4, active: true, showOnHome: false },
];

export async function ensureDefaults() {
  const existing = await getAll('razryady');
  const defaultsByRazryad = new Map(DEFAULT_RAZRYADY.map(r => [r.razryad, r]));
  if (existing.length === 0) {
    for (const r of DEFAULT_RAZRYADY) await put('razryady', r);
  } else {
    for (const r of existing) {
      if (r.razryad < RAZRYAD_MIN || r.razryad > RAZRYAD_MAX) {
        await remove('razryady', r.razryad);
      } else if (r.stavka === 0 && r.koef === 1 && defaultsByRazryad.has(r.razryad)) {
        // старая пустая заглушка (ставка 0 / коэф. 1) — ещё не заполнена вручную, подставляем реальные цифры
        await put('razryady', defaultsByRazryad.get(r.razryad));
      }
    }
  }
  const settings = await get('settings', 'main');
  if (!settings) {
    await put('settings', DEFAULT_SETTINGS);
  } else if (settings.smenaChasovDefault === undefined) {
    await put('settings', { ...DEFAULT_SETTINGS, ...settings });
  }
  const lokomotivy = await getAll('lokomotivy');
  if (lokomotivy.length === 0) {
    for (const l of DEFAULT_LOKOMOTIVY) {
      await put('lokomotivy', { ...l, remonty: l.remonty.map(r => ({ ...r, id: uid() })) });
    }
  }
  const slesari = await getAll('slesari');
  if (slesari.length === 0) {
    for (const s of DEFAULT_SLESARI) await put('slesari', s);
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
