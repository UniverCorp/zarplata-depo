import { getAll, put, clearStore, STORES } from './db.js';

export async function exportBackup() {
  const data = {};
  for (const store of STORES) {
    data[store] = await getAll(store);
  }
  const payload = { app: 'zarplata-depo', version: 1, exportedAt: new Date().toISOString(), data };
  const json = JSON.stringify(payload, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const filename = `zarplata-backup-${new Date().toISOString().slice(0, 10)}.json`;

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: 'JSON backup', accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return { ok: true, method: 'file-picker' };
    } catch (e) {
      if (e && e.name === 'AbortError') return { ok: false, method: 'cancelled' };
      // fall through to download fallback
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return { ok: true, method: 'download' };
}

export async function importBackupFromFile(file) {
  const text = await file.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch (e) {
    throw new Error('Файл повреждён или это не резервная копия (некорректный JSON).');
  }
  if (!payload || payload.app !== 'zarplata-depo' || !payload.data) {
    throw new Error('Это не похоже на резервную копию приложения.');
  }
  for (const store of STORES) {
    await clearStore(store);
    const rows = payload.data[store] || [];
    for (const row of rows) {
      await put(store, row);
    }
  }
  return true;
}
