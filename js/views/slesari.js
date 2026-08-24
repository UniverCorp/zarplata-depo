import { getSlesari, saveSlesar, deleteSlesar, getRazryady } from '../models.js';
import { escapeHtml, toast, confirmAction, RAZRYAD_OPTIONS } from './ui.js';

export async function render(container) {
  await renderList(container);
}

async function renderList(container) {
  const [slesari, razryady] = await Promise.all([getSlesari(), getRazryady()]);
  const razryadyMap = new Map(razryady.map(r => [r.razryad, r]));
  slesari.sort((a, b) => (a.familia || '').localeCompare(b.familia || '', 'ru'));

  container.innerHTML = `
    <h1>Слесари</h1>
    <div class="card" id="list-card">
      ${slesari.length === 0 ? '<div class="empty">Пока никого нет. Добавьте первого слесаря.</div>' : slesari.map(s => {
        const r = razryadyMap.get(s.razryad);
        return `
        <div class="list-item" data-edit="${s.id}" style="cursor:pointer">
          <div>
            <div class="title">${escapeHtml(s.familia)} ${s.active === false ? '<span class="badge off">неактивен</span>' : ''} ${s.showOnHome ? '<span class="badge hours">я</span>' : ''}</div>
            <div class="sub">Разряд ${s.razryad} · ставка ${r ? r.stavka : '?'} ₽/ч · коэф. ${r ? r.koef : '?'}</div>
          </div>
          <span class="chevron">&rsaquo;</span>
        </div>`;
      }).join('')}
    </div>
    <button class="btn block" id="add-btn">+ Добавить слесаря</button>
  `;

  container.querySelector('#add-btn').addEventListener('click', () => renderForm(container, null));
  container.querySelectorAll('[data-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.getAttribute('data-edit'));
      const s = slesari.find(x => x.id === id);
      renderForm(container, s);
    });
  });
}

async function renderForm(container, slesar) {
  const razryady = await getRazryady();
  const isEdit = !!slesar;
  const s = slesar || { familia: '', razryad: RAZRYAD_OPTIONS[0], active: true, showOnHome: false };

  container.innerHTML = `
    <h1>${isEdit ? 'Редактировать слесаря' : 'Новый слесарь'}</h1>
    <div class="card">
      <label>Фамилия</label>
      <input type="text" id="f-familia" value="${escapeHtml(s.familia)}" placeholder="Иванов" />

      <label>Разряд</label>
      <select id="f-razryad">
        ${RAZRYAD_OPTIONS.map(r => `<option value="${r}" ${r === s.razryad ? 'selected' : ''}>${r} разряд</option>`).join('')}
      </select>
      <div class="muted" id="tarif-info" style="margin-top:8px"></div>

      <div class="toggle-row">
        <span>Активен (числится в текущей бригаде)</span>
        <label class="switch">
          <input type="checkbox" id="f-active" ${s.active !== false ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
      </div>

      <div class="toggle-row">
        <span>Показывать на Главной странице (это я)</span>
        <label class="switch">
          <input type="checkbox" id="f-show-home" ${s.showOnHome ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
      </div>
      <p class="muted" style="margin-top:2px">Главная страница считает доход только для отмеченных слесарей. Доход всей бригады смотрите в разделе "Итог месяца".</p>

      <div id="err" class="field-error" style="display:none"></div>
    </div>
    <div class="btn-row">
      <button class="btn" id="save-btn">Сохранить</button>
      <button class="btn secondary" id="cancel-btn">Отмена</button>
      ${isEdit ? '<button class="btn danger" id="delete-btn">Удалить</button>' : ''}
    </div>
  `;

  const razryadySelect = container.querySelector('#f-razryad');
  const updateTarifInfo = () => {
    const r = razryady.find(x => x.razryad === Number(razryadySelect.value));
    container.querySelector('#tarif-info').textContent = r
      ? `Тарифная ставка: ${r.stavka} ₽/ч, коэффициент: ${r.koef}`
      : 'Нет данных по этому разряду — настройте в разделе "Настройки".';
  };
  razryadySelect.addEventListener('change', updateTarifInfo);
  updateTarifInfo();

  container.querySelector('#cancel-btn').addEventListener('click', () => renderList(container));

  container.querySelector('#save-btn').addEventListener('click', async () => {
    const familia = container.querySelector('#f-familia').value.trim();
    const errEl = container.querySelector('#err');
    if (!familia) {
      errEl.textContent = 'Укажите фамилию.';
      errEl.style.display = 'block';
      return;
    }
    const payload = {
      familia,
      razryad: Number(razryadySelect.value),
      active: container.querySelector('#f-active').checked,
      showOnHome: container.querySelector('#f-show-home').checked,
    };
    if (isEdit) payload.id = s.id;
    await saveSlesar(payload);
    toast('Сохранено');
    renderList(container);
  });

  if (isEdit) {
    container.querySelector('#delete-btn').addEventListener('click', async () => {
      if (!confirmAction(`Удалить ${s.familia}? Это действие необратимо. Если у слесаря уже есть наряды, лучше пометить его неактивным вместо удаления.`)) return;
      await deleteSlesar(s.id);
      toast('Удалено');
      renderList(container);
    });
  }
}
