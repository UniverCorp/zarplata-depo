import { getLokomotivy, saveLokomotiv, deleteLokomotiv, uid } from '../models.js';
import { escapeHtml, toast, confirmAction } from './ui.js';

export async function render(container) {
  await renderList(container);
}

async function renderList(container) {
  const lokomotivy = await getLokomotivy();
  lokomotivy.sort((a, b) => (a.seria || '').localeCompare(b.seria || '', 'ru'));

  container.innerHTML = `
    <h1>Тепловозы (серии)</h1>
    <div class="card" id="list-card">
      ${lokomotivy.length === 0 ? '<div class="empty">Пока нет ни одной серии. Добавьте первую.</div>' : lokomotivy.map(l => `
        <div class="list-item" data-edit="${l.id}" style="cursor:pointer">
          <div>
            <div class="title">${escapeHtml(l.seria)}</div>
            <div class="sub">${l.sections.length === 1 ? '1 секция' : 'Секции: ' + l.sections.join(', ')} · ${(l.remonty || []).length} вид(ов) ремонта</div>
          </div>
          <span class="chevron">&rsaquo;</span>
        </div>`).join('')}
    </div>
    <button class="btn block" id="add-btn">+ Добавить серию тепловоза</button>
  `;

  container.querySelector('#add-btn').addEventListener('click', () => renderForm(container, null));
  container.querySelectorAll('[data-edit]').forEach(el => {
    el.addEventListener('click', () => {
      const id = Number(el.getAttribute('data-edit'));
      const l = lokomotivy.find(x => x.id === id);
      renderForm(container, l);
    });
  });
}

function cloneLok(l) {
  return l ? JSON.parse(JSON.stringify(l)) : { seria: '', sections: ['A'], remonty: [] };
}

async function renderForm(container, lokomotiv) {
  const isEdit = !!lokomotiv;
  const state = cloneLok(lokomotiv);

  function draw() {
    container.innerHTML = `
      <h1>${isEdit ? 'Редактировать серию' : 'Новая серия тепловоза'}</h1>
      <div class="card">
        <label>Серия тепловоза</label>
        <input type="text" id="f-seria" value="${escapeHtml(state.seria)}" placeholder="ЧМЭ3" />

        <label>Количество секций</label>
        <select id="f-sections">
          <option value="1" ${state.sections.length === 1 ? 'selected' : ''}>1 секция (маневровый, например ЧМЭ3)</option>
          <option value="2" ${state.sections.length === 2 ? 'selected' : ''}>2 секции — А и Б (например 2ТЭ25КМ)</option>
        </select>
      </div>

      <h2>Виды ремонта</h2>
      <div class="card">
        ${state.remonty.length === 0 ? '<div class="empty">Ремонты ещё не добавлены</div>' : ''}
        ${state.remonty.map((r, i) => `
          <div class="step" style="margin-bottom:14px">
            <label>Тип ремонта</label>
            <input type="text" class="r-tip" data-i="${i}" value="${escapeHtml(r.tip)}" placeholder="ТО-3, ТР-1..." />
            <label>Норма часов (за секцию)</label>
            <input type="number" class="r-norma" data-i="${i}" value="${r.normaChasov}" min="0" step="0.1" />
            <label>Стоимость за ремонт 1 секции, ₽</label>
            <input type="number" class="r-stoim" data-i="${i}" value="${r.stoimostZaSektsiyu}" min="0" step="0.01" />
            <button class="btn danger r-del" data-i="${i}" style="margin-top:8px">Удалить этот вид ремонта</button>
          </div>
        `).join('')}
        <button class="btn secondary block" id="add-remont">+ Добавить вид ремонта</button>
      </div>

      <div id="err" class="field-error" style="display:none"></div>
      <div class="btn-row">
        <button class="btn" id="save-btn">Сохранить</button>
        <button class="btn secondary" id="cancel-btn">Отмена</button>
        ${isEdit ? '<button class="btn danger" id="delete-btn">Удалить серию</button>' : ''}
      </div>
    `;

    container.querySelector('#f-seria').addEventListener('input', e => { state.seria = e.target.value; });
    container.querySelector('#f-sections').addEventListener('change', e => {
      state.sections = Number(e.target.value) === 2 ? ['A', 'Б'] : ['A'];
    });
    container.querySelector('#add-remont').addEventListener('click', () => {
      state.remonty.push({ id: uid(), tip: '', normaChasov: 0, stoimostZaSektsiyu: 0 });
      draw();
    });
    container.querySelectorAll('.r-tip').forEach(el => el.addEventListener('input', e => {
      state.remonty[Number(e.target.dataset.i)].tip = e.target.value;
    }));
    container.querySelectorAll('.r-norma').forEach(el => el.addEventListener('input', e => {
      state.remonty[Number(e.target.dataset.i)].normaChasov = Number(e.target.value) || 0;
    }));
    container.querySelectorAll('.r-stoim').forEach(el => el.addEventListener('input', e => {
      state.remonty[Number(e.target.dataset.i)].stoimostZaSektsiyu = Number(e.target.value) || 0;
    }));
    container.querySelectorAll('.r-del').forEach(el => el.addEventListener('click', () => {
      state.remonty.splice(Number(el.dataset.i), 1);
      draw();
    }));

    container.querySelector('#cancel-btn').addEventListener('click', () => renderList(container));

    container.querySelector('#save-btn').addEventListener('click', async () => {
      const errEl = container.querySelector('#err');
      if (!state.seria.trim()) {
        errEl.textContent = 'Укажите серию тепловоза.';
        errEl.style.display = 'block';
        return;
      }
      if (state.remonty.some(r => !r.tip.trim())) {
        errEl.textContent = 'У каждого вида ремонта должно быть название (например ТО-3).';
        errEl.style.display = 'block';
        return;
      }
      const payload = { seria: state.seria.trim(), sections: state.sections, remonty: state.remonty };
      if (isEdit) payload.id = lokomotiv.id;
      await saveLokomotiv(payload);
      toast('Сохранено');
      renderList(container);
    });

    if (isEdit) {
      container.querySelector('#delete-btn').addEventListener('click', async () => {
        if (!confirmAction(`Удалить серию "${lokomotiv.seria}"? Наряды, где она использовалась, останутся, но перестанут считаться корректно.`)) return;
        await deleteLokomotiv(lokomotiv.id);
        toast('Удалено');
        renderList(container);
      });
    }
  }

  draw();
}
