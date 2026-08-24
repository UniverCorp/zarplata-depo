import { getDopRabotyAll, saveDopRabota, deleteDopRabota, getLokomotivy } from '../models.js';
import { escapeHtml, toast, confirmAction } from './ui.js';

export async function render(container) {
  await renderList(container);
}

async function renderList(container) {
  const [items, lokomotivy] = await Promise.all([getDopRabotyAll(), getLokomotivy()]);
  const lokMap = new Map(lokomotivy.map(l => [l.id, l]));
  items.sort((a, b) => (a.nazvanie || '').localeCompare(b.nazvanie || '', 'ru'));

  container.innerHTML = `
    <h1>Доп. работы</h1>
    <div class="card" id="list-card">
      ${items.length === 0 ? '<div class="empty">Пока нет доп. работ. Добавьте первую.</div>' : items.map(d => `
        <div class="list-item" data-edit="${d.id}" style="cursor:pointer">
          <div>
            <div class="title">${escapeHtml(d.nazvanie)}</div>
            <div class="sub">${d.stoimost} ₽ · ${d.normaChasov} ч · тепловозы: ${(d.lokomotivyIds || []).map(id => lokMap.get(id)?.seria).filter(Boolean).join(', ') || '—'}</div>
          </div>
          <span class="chevron">&rsaquo;</span>
        </div>`).join('')}
    </div>
    <button class="btn block" id="add-btn">+ Добавить доп. работу</button>
  `;

  container.querySelector('#add-btn').addEventListener('click', () => renderForm(container, null, lokomotivy));
  container.querySelectorAll('[data-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.getAttribute('data-edit'));
      const d = items.find(x => x.id === id);
      renderForm(container, d, lokomotivy);
    });
  });
}

async function renderForm(container, dopRabota, lokomotivy) {
  const isEdit = !!dopRabota;
  const d = dopRabota || { nazvanie: '', normaChasov: 0, stoimost: 0, lokomotivyIds: [] };
  const selected = new Set(d.lokomotivyIds || []);

  container.innerHTML = `
    <h1>${isEdit ? 'Редактировать доп. работу' : 'Новая доп. работа'}</h1>
    <div class="card">
      <label>Название</label>
      <input type="text" id="f-nazvanie" value="${escapeHtml(d.nazvanie)}" placeholder="Замена колодок" />
      <label>Норма часов</label>
      <input type="number" id="f-norma" value="${d.normaChasov}" min="0" step="0.1" />
      <label>Стоимость, ₽</label>
      <input type="number" id="f-stoim" value="${d.stoimost}" min="0" step="0.01" />
    </div>

    <h2>На каких тепловозах доступна</h2>
    <div class="card">
      ${lokomotivy.length === 0 ? '<div class="empty">Сначала добавьте хотя бы одну серию тепловоза.</div>' : `
      <div class="check-list">
        ${lokomotivy.map(l => `
          <label class="check-item">
            <input type="checkbox" class="lok-check" value="${l.id}" ${selected.has(l.id) ? 'checked' : ''} />
            ${escapeHtml(l.seria)}
          </label>
        `).join('')}
      </div>`}
    </div>

    <div id="err" class="field-error" style="display:none"></div>
    <div class="btn-row">
      <button class="btn" id="save-btn">Сохранить</button>
      <button class="btn secondary" id="cancel-btn">Отмена</button>
      ${isEdit ? '<button class="btn danger" id="delete-btn">Удалить</button>' : ''}
    </div>
  `;

  container.querySelector('#cancel-btn').addEventListener('click', () => renderList(container));

  container.querySelector('#save-btn').addEventListener('click', async () => {
    const nazvanie = container.querySelector('#f-nazvanie').value.trim();
    const errEl = container.querySelector('#err');
    if (!nazvanie) {
      errEl.textContent = 'Укажите название.';
      errEl.style.display = 'block';
      return;
    }
    const lokomotivyIds = Array.from(container.querySelectorAll('.lok-check:checked')).map(el => Number(el.value));
    const payload = {
      nazvanie,
      normaChasov: Number(container.querySelector('#f-norma').value) || 0,
      stoimost: Number(container.querySelector('#f-stoim').value) || 0,
      lokomotivyIds,
    };
    if (isEdit) payload.id = d.id;
    await saveDopRabota(payload);
    toast('Сохранено');
    renderList(container);
  });

  if (isEdit) {
    container.querySelector('#delete-btn').addEventListener('click', async () => {
      if (!confirmAction(`Удалить доп. работу "${d.nazvanie}"?`)) return;
      await deleteDopRabota(d.id);
      toast('Удалено');
      renderList(container);
    });
  }
}
