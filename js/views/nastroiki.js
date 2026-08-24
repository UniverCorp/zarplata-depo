import { getSettings, saveSettings, getRazryady, saveRazryad } from '../models.js';
import { clearStore, STORES } from '../db.js';
import { exportBackup, importBackupFromFile } from '../backup.js';
import { toast, confirmAction } from './ui.js';

export async function render(container) {
  const [settings, razryady] = await Promise.all([getSettings(), getRazryady()]);
  razryady.sort((a, b) => a.razryad - b.razryad);

  container.innerHTML = `
    <h1>Настройки</h1>

    <h2>Тарифная сетка</h2>
    <div class="card">
      <table>
        <thead><tr><th>Разряд</th><th>Ставка, ₽/ч</th><th>Коэффициент</th></tr></thead>
        <tbody>
          ${razryady.map(r => `
            <tr>
              <td>${r.razryad}</td>
              <td><input type="number" class="rz-stavka" data-r="${r.razryad}" value="${r.stavka}" min="0" step="0.01" style="width:100%"/></td>
              <td><input type="number" class="rz-koef" data-r="${r.razryad}" value="${r.koef}" min="0" step="0.01" style="width:100%"/></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <button class="btn secondary block" id="save-razryady" style="margin-top:12px">Сохранить тарифную сетку</button>
    </div>

    <h2>Расчёт зарплаты</h2>
    <div class="card">
      <label>НДФЛ, %</label>
      <input type="number" id="f-ndfl" value="${settings.ndfl * 100}" min="0" max="100" step="0.1" />
      <label>Зональная надбавка, %</label>
      <input type="number" id="f-zonal" value="${settings.zonalnaya * 100}" min="0" max="100" step="0.1" />
      <label>Период аванса — с какого числа</label>
      <input type="number" id="f-avans-start" value="${settings.avansStart}" min="1" max="28" />
      <label>Период аванса — по какое число</label>
      <input type="number" id="f-avans-end" value="${settings.avansEnd}" min="1" max="28" />
      <label>Часы смены по умолчанию</label>
      <input type="number" id="f-smena" value="${settings.smenaChasovDefault}" min="0" max="24" step="0.5" />
      <p class="muted" style="margin-top:2px">Используются для расчёта аванса (тариф × часы смены) и % выработки. Подставляются в новый день, но на конкретный день можно изменить (например, для сокращённого месяца).</p>
      <button class="btn secondary block" id="save-settings" style="margin-top:12px">Сохранить настройки расчёта</button>
    </div>

    <h2>Резервная копия</h2>
    <div class="card">
      <p class="muted">Данные хранятся локально на телефоне. Чтобы не потерять их при переустановке приложения, смене телефона или очистке данных браузера — регулярно делайте резервную копию в файл.</p>
      <div class="btn-row">
        <button class="btn" id="export-btn">Сохранить резервную копию</button>
        <label class="btn secondary" for="import-file" style="cursor:pointer">Восстановить из файла</label>
        <input type="file" id="import-file" accept="application/json" style="display:none" />
      </div>
    </div>

    <h2>Опасная зона</h2>
    <div class="card">
      <button class="btn danger block" id="reset-btn">Удалить все данные</button>
    </div>
  `;

  container.querySelector('#save-razryady').addEventListener('click', async () => {
    const rows = razryady.map(r => ({
      razryad: r.razryad,
      stavka: Number(container.querySelector(`.rz-stavka[data-r="${r.razryad}"]`).value) || 0,
      koef: Number(container.querySelector(`.rz-koef[data-r="${r.razryad}"]`).value) || 0,
    }));
    for (const row of rows) await saveRazryad(row);
    toast('Тарифная сетка сохранена');
  });

  container.querySelector('#save-settings').addEventListener('click', async () => {
    const ndfl = (Number(container.querySelector('#f-ndfl').value) || 0) / 100;
    const zonalnaya = (Number(container.querySelector('#f-zonal').value) || 0) / 100;
    const avansStart = Number(container.querySelector('#f-avans-start').value) || 1;
    const avansEnd = Number(container.querySelector('#f-avans-end').value) || 15;
    const smenaChasovDefault = Number(container.querySelector('#f-smena').value) || 0;
    await saveSettings({ ndfl, zonalnaya, avansStart, avansEnd, smenaChasovDefault });
    toast('Настройки сохранены');
  });

  container.querySelector('#export-btn').addEventListener('click', async () => {
    const res = await exportBackup();
    if (res.ok) toast('Резервная копия сохранена');
  });

  container.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!confirmAction('Это заменит все текущие данные в приложении данными из файла. Продолжить?')) {
      e.target.value = '';
      return;
    }
    try {
      await importBackupFromFile(file);
      toast('Данные восстановлены');
      render(container);
    } catch (err) {
      window.alert(err.message || 'Не удалось восстановить резервную копию.');
    }
  });

  container.querySelector('#reset-btn').addEventListener('click', async () => {
    if (!confirmAction('Удалить ВСЕ данные приложения безвозвратно (слесари, тепловозы, наряды, настройки)? Рекомендуем сначала сохранить резервную копию.')) return;
    if (!confirmAction('Точно удалить всё? Это нельзя отменить.')) return;
    for (const store of STORES) await clearStore(store);
    toast('Все данные удалены');
    window.location.hash = '#/';
    window.location.reload();
  });
}
