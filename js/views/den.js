import { getDen, saveDen, deleteDen, uid, buildMaps } from '../models.js';
import { dayTotals, naryadCost, naryadNormHours, slesarPercent } from '../calc.js';
import { navigate } from '../router.js';
import { escapeHtml, money, toast, confirmAction } from './ui.js';

export async function render(container, params) {
  const date = params.date;
  const maps = await buildMaps();
  let den = await getDen(date) || {
    date,
    dvoinaya: false,
    smenaChasov: maps.settings.smenaChasovDefault || 11,
    prisutstvuyut: [],
    naryady: [],
  };
  if (!den.prisutstvuyut) den.prisutstvuyut = [];

  await drawDay(container, date, den, maps);
}

async function persist(den) {
  await saveDen(den);
}

async function drawDay(container, date, den, maps) {
  const totals = dayTotals(den, maps);
  const activeSlesari = maps.slesari.filter(s => s.active !== false);

  container.innerHTML = `
    <h1>${formatDate(date)}</h1>

    <div class="card">
      <label>Часы смены сегодня</label>
      <input type="number" id="f-smena" value="${den.smenaChasov}" min="0" max="24" step="0.5" />
      <div class="toggle-row">
        <span>Двойная оплата на весь день (×2)</span>
        <label class="switch">
          <input type="checkbox" id="f-dvoinaya" ${den.dvoinaya ? 'checked' : ''} />
          <span class="slider"></span>
        </label>
      </div>
    </div>

    <h2>Явка (для аванса)</h2>
    <div class="card">
      <p class="muted" style="margin-top:0">Кто сегодня был на смене — от этого списка и часов смены считается аванс. На сдельщину (наряды) явка не влияет, там свой список бригады.</p>
      ${activeSlesari.length === 0 ? '<div class="empty">Нет активных слесарей.</div>' : `
      <div class="check-list">
        ${activeSlesari.map(s => `
          <label class="check-item">
            <input type="checkbox" class="f-prisutstvuyut" value="${s.id}" ${den.prisutstvuyut.includes(s.id) ? 'checked' : ''} />
            ${escapeHtml(s.familia)} <span class="muted">(разряд ${s.razryad})</span>
          </label>
        `).join('')}
      </div>`}
    </div>

    <h2>Наряды за день</h2>
    <div class="card">
      ${den.naryady.length === 0 ? '<div class="empty">Нарядов пока нет</div>' : totals.naryadRows.map(row => renderNaryadRow(row)).join('')}
    </div>
    <button class="btn block" id="add-naryad-btn">+ Добавить наряд</button>

    <h2>Итог дня (сдельщина)</h2>
    <div class="stat-grid">
      <div class="stat-card"><div class="value">${money(totals.total)}</div><div class="label">Общий заработок</div></div>
      <div class="stat-card"><div class="value">${avgPercentLabel(totals, den.smenaChasov)}</div><div class="label">Средняя выработка</div></div>
    </div>

    <h3>По слесарям</h3>
    <div class="card">
      ${totals.displayed.size === 0 ? '<div class="empty">Пока никого нет — отметьте явку или добавьте наряд.</div>' : Array.from(totals.displayed).map((id) => {
        const s = maps.slesariMap.get(id);
        const moneySum = totals.perSlesarMoney.get(id) || 0;
        const percent = slesarPercent(totals.perSlesarNormHours.get(id) || 0, den.smenaChasov);
        return `<div class="list-item">
          <div class="title">${escapeHtml(s ? s.familia : '—')}</div>
          <div style="text-align:right">
            <div class="badge money">${money(moneySum)}</div>
            <div class="badge hours" style="margin-top:4px">${percent.toFixed(0)}%</div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="btn-row">
      <button class="btn secondary" id="delete-day-btn">Удалить день целиком</button>
    </div>
  `;

  container.querySelector('#f-smena').addEventListener('change', async (e) => {
    const val = Number(e.target.value) || 0;
    den = { ...den, smenaChasov: val };
    await persist(den);
    drawDay(container, date, den, maps);
  });

  container.querySelector('#f-dvoinaya').addEventListener('change', async (e) => {
    den = { ...den, dvoinaya: e.target.checked };
    await persist(den);
    drawDay(container, date, den, maps);
  });

  container.querySelectorAll('.f-prisutstvuyut').forEach(el => {
    el.addEventListener('change', async () => {
      const ids = Array.from(container.querySelectorAll('.f-prisutstvuyut:checked')).map(x => Number(x.value));
      den = { ...den, prisutstvuyut: ids };
      await persist(den);
      drawDay(container, date, den, maps);
    });
  });

  container.querySelector('#add-naryad-btn').addEventListener('click', () => {
    drawNaryadForm(container, date, den, maps, null);
  });

  container.querySelectorAll('[data-edit-naryad]').forEach(el => {
    el.addEventListener('click', () => {
      const id = el.getAttribute('data-edit-naryad');
      const naryad = den.naryady.find(n => n.id === id);
      drawNaryadForm(container, date, den, maps, naryad);
    });
  });

  container.querySelectorAll('[data-del-naryad]').forEach(el => {
    el.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      const id = el.getAttribute('data-del-naryad');
      if (!confirmAction('Удалить этот наряд?')) return;
      den = { ...den, naryady: den.naryady.filter(n => n.id !== id) };
      await persist(den);
      drawDay(container, date, den, maps);
    });
  });

  container.querySelector('#delete-day-btn').addEventListener('click', async () => {
    if (!confirmAction('Удалить весь день со всеми нарядами?')) return;
    await deleteDen(date);
    toast('День удалён');
    navigate('/dni');
  });
}

function avgPercentLabel(totals, smenaChasov) {
  if (totals.naryadParticipants.size === 0) return '—';
  let sum = 0;
  for (const id of totals.naryadParticipants) {
    sum += slesarPercent(totals.perSlesarNormHours.get(id) || 0, smenaChasov);
  }
  return Math.round(sum / totals.naryadParticipants.size) + '%';
}

function renderNaryadRow(row) {
  const { naryad, lokomotiv, cost } = row;
  const remont = (lokomotiv.remonty || []).find(r => r.id === naryad.remontId);
  const dopCount = (naryad.dopRaboty || []).reduce((a, e) => a + (e.kolichestvo || 1), 0);
  return `
    <div class="list-item" data-edit-naryad="${naryad.id}" style="cursor:pointer">
      <div>
        <div class="title">${escapeHtml(lokomotiv.seria)} № ${escapeHtml(naryad.nomer || '—')} — ${escapeHtml(remont ? remont.tip : '?')}</div>
        <div class="sub">Секции: ${naryad.sektsii.join(', ')} · Бригада: ${naryad.slesariIds.length} чел. ${dopCount ? '· доп. работ: ' + dopCount : ''}</div>
      </div>
      <div style="text-align:right">
        <div class="badge money">${money(cost)}</div>
        <button class="btn ghost" data-del-naryad="${naryad.id}" style="padding:2px 6px;font-size:13px">удалить</button>
      </div>
    </div>
  `;
}

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split('-');
  return `${d}.${m}.${y}`;
}

function drawNaryadForm(container, date, den, maps, existingNaryad) {
  const isEdit = !!existingNaryad;
  const state = existingNaryad ? JSON.parse(JSON.stringify(existingNaryad)) : {
    id: uid(), lokomotivId: null, nomer: '', remontId: null, sektsii: [], slesariIds: [], dopRaboty: [],
  };
  if (!state.dopRaboty) state.dopRaboty = [];
  const activeSlesari = maps.slesari.filter(s => s.active !== false);
  const ui = { dopSearchOpen: false, dopSearchQuery: '' };

  function currentLokomotiv() {
    return state.lokomotivId ? maps.lokomotivyMap.get(state.lokomotivId) : null;
  }

  function draw() {
    const lokomotiv = currentLokomotiv();
    const availableDopRaboty = lokomotiv ? maps.dopRaboty.filter(d => (d.lokomotivyIds || []).includes(lokomotiv.id)) : [];
    const previewCost = lokomotiv && state.remontId && state.sektsii.length
      ? naryadCost(state, lokomotiv, maps.dopRabotyMap, den.dvoinaya)
      : null;

    container.innerHTML = `
      <h1>${isEdit ? 'Редактировать наряд' : 'Новый наряд'}</h1>

      <div class="card">
        <label>Тепловоз (серия)</label>
        <select id="f-lok">
          <option value="">— выбрать —</option>
          ${maps.lokomotivy.map(l => `<option value="${l.id}" ${state.lokomotivId === l.id ? 'selected' : ''}>${escapeHtml(l.seria)}</option>`).join('')}
        </select>

        ${lokomotiv ? `
        <label>Номер тепловоза</label>
        <input type="text" id="f-nomer" value="${escapeHtml(state.nomer)}" placeholder="Например 1523" />

        <label>Вид ремонта</label>
        <select id="f-remont">
          <option value="">— выбрать —</option>
          ${(lokomotiv.remonty || []).map(r => `<option value="${r.id}" ${state.remontId === r.id ? 'selected' : ''}>${escapeHtml(r.tip)} (${r.stoimostZaSektsiyu} ₽/секц.)</option>`).join('')}
        </select>
        ${(lokomotiv.remonty || []).length === 0 ? '<div class="field-error">У этой серии не настроены виды ремонта — добавьте их в разделе "Тепловозы".' : ''}

        ${lokomotiv.sections.length > 1 ? `
        <label>Секции, которые ремонтировались</label>
        <div class="check-list">
          ${lokomotiv.sections.map(sec => `
            <label class="check-item">
              <input type="checkbox" class="f-sektsiya" value="${sec}" ${state.sektsii.includes(sec) ? 'checked' : ''} />
              Секция ${sec}
            </label>
          `).join('')}
        </div>` : ''}
        ` : '<p class="muted">Сначала выберите серию тепловоза.</p>'}
      </div>

      ${lokomotiv ? `
      <h2>Бригада (кто работал)</h2>
      <div class="card">
        ${activeSlesari.length === 0 ? '<div class="empty">Нет активных слесарей. Добавьте их в разделе "Слесари".</div>' : `
        <div class="check-list">
          ${activeSlesari.map(s => `
            <label class="check-item">
              <input type="checkbox" class="f-slesar" value="${s.id}" ${state.slesariIds.includes(s.id) ? 'checked' : ''} />
              ${escapeHtml(s.familia)} <span class="muted">(разряд ${s.razryad})</span>
            </label>
          `).join('')}
        </div>`}
      </div>

      <h2>Доп. работы (необязательно)</h2>
      <div class="card" id="dop-card">
        ${renderDopEntries(state, lokomotiv, maps)}
        ${state.sektsii.length === 0 ? '<p class="muted">Сначала выберите секции наряда.</p>' : renderDopAdder(availableDopRaboty, ui)}
      </div>
      ` : ''}

      ${previewCost !== null ? `
      <div class="card">
        <div class="row"><span>Стоимость наряда${den.dvoinaya ? ' (уже ×2 за двойной день)' : ''}</span><span class="badge money">${money(previewCost)}</span></div>
      </div>` : ''}

      <div id="err" class="field-error" style="display:none"></div>
      <div class="btn-row">
        <button class="btn" id="save-btn">Сохранить наряд</button>
        <button class="btn secondary" id="cancel-btn">Отмена</button>
      </div>
    `;

    container.querySelector('#f-lok').addEventListener('change', (e) => {
      const id = e.target.value ? Number(e.target.value) : null;
      if (id !== state.lokomotivId) {
        state.lokomotivId = id;
        state.remontId = null;
        state.sektsii = [];
        state.dopRaboty = [];
        const lok = id ? maps.lokomotivyMap.get(id) : null;
        if (lok && lok.sections.length === 1) state.sektsii = [...lok.sections];
      }
      draw();
    });

    if (lokomotiv) {
      container.querySelector('#f-nomer').addEventListener('input', e => { state.nomer = e.target.value; });
      container.querySelector('#f-remont').addEventListener('change', e => {
        state.remontId = e.target.value || null;
        draw();
      });
      container.querySelectorAll('.f-sektsiya').forEach(el => el.addEventListener('change', () => {
        const checked = Array.from(container.querySelectorAll('.f-sektsiya:checked')).map(x => x.value);
        state.sektsii = checked;
        // убираем доп. работы, привязанные к секции, которую сняли с наряда
        state.dopRaboty = state.dopRaboty.filter(e => !e.sektsiya || state.sektsii.includes(e.sektsiya));
        draw();
      }));
      container.querySelectorAll('.f-slesar').forEach(el => el.addEventListener('change', () => {
        state.slesariIds = Array.from(container.querySelectorAll('.f-slesar:checked')).map(x => Number(x.value));
        draw();
      }));

      wireDopAdder(container, state, lokomotiv, availableDopRaboty, ui, draw);
      wireDopEntries(container, state, draw);
    }

    container.querySelector('#cancel-btn').addEventListener('click', () => drawDay(container, date, den, maps));

    container.querySelector('#save-btn').addEventListener('click', async () => {
      const errEl = container.querySelector('#err');
      if (!state.lokomotivId) { errEl.textContent = 'Выберите тепловоз.'; errEl.style.display = 'block'; return; }
      if (!state.nomer || !state.nomer.trim()) { errEl.textContent = 'Укажите номер тепловоза.'; errEl.style.display = 'block'; return; }
      if (!state.remontId) { errEl.textContent = 'Выберите вид ремонта.'; errEl.style.display = 'block'; return; }
      if (!state.sektsii.length) { errEl.textContent = 'Выберите хотя бы одну секцию.'; errEl.style.display = 'block'; return; }
      if (!state.slesariIds.length) { errEl.textContent = 'Выберите хотя бы одного слесаря.'; errEl.style.display = 'block'; return; }

      const newNaryad = {
        id: state.id,
        lokomotivId: state.lokomotivId,
        nomer: state.nomer.trim(),
        remontId: state.remontId,
        sektsii: state.sektsii,
        slesariIds: state.slesariIds,
        dopRaboty: state.dopRaboty,
      };

      let naryady;
      if (isEdit) {
        naryady = den.naryady.map(n => n.id === newNaryad.id ? newNaryad : n);
      } else {
        naryady = [...den.naryady, newNaryad];
      }
      den = { ...den, naryady };
      await persist(den);
      toast('Наряд сохранён');
      drawDay(container, date, den, maps);
    });
  }

  draw();
}

function renderDopEntries(state, lokomotiv, maps) {
  if (!state.dopRaboty.length) return '';
  const multiSektsii = state.sektsii.length > 1;
  return `
    <div class="check-list" id="dop-entries" style="margin-bottom:12px">
      ${state.dopRaboty.map((entry) => {
        const d = maps.dopRabotyMap.get(entry.dopRabotaId);
        return `
        <div class="check-item" data-entry="${entry.entryId}" style="align-items:center;gap:8px">
          <div style="flex:1">
            <div>${escapeHtml(d ? d.nazvanie : '—')}</div>
            <div class="muted">${d ? money(d.stoimost) + ' / шт.' : ''}</div>
          </div>
          ${multiSektsii ? `
          <select class="dop-entry-sektsiya" data-entry="${entry.entryId}" style="width:70px">
            ${state.sektsii.map(sec => `<option value="${sec}" ${entry.sektsiya === sec ? 'selected' : ''}>${sec}</option>`).join('')}
          </select>` : ''}
          <input type="number" class="dop-entry-kol" data-entry="${entry.entryId}" value="${entry.kolichestvo}" min="1" step="1" style="width:60px" />
          <button class="btn ghost dop-entry-del" data-entry="${entry.entryId}">✕</button>
        </div>`;
      }).join('')}
    </div>
  `;
}

function renderDopAdder(availableDopRaboty, ui) {
  if (availableDopRaboty.length === 0) {
    return '<div class="empty">Для этой серии тепловоза доп. работы не настроены</div>';
  }
  if (!ui.dopSearchOpen) {
    return '<button class="btn secondary block" id="dop-open-btn">+ Добавить доп. работу</button>';
  }
  return `
    <input type="text" id="dop-search" placeholder="Поиск доп. работы..." value="${ui.dopSearchQuery ? ui.dopSearchQuery.replace(/"/g, '&quot;') : ''}" autocomplete="off" />
    <div id="dop-search-results" style="margin-top:8px"></div>
  `;
}

function wireDopAdder(container, state, lokomotiv, availableDopRaboty, ui, draw) {
  const openBtn = container.querySelector('#dop-open-btn');
  if (openBtn) {
    openBtn.addEventListener('click', () => { ui.dopSearchOpen = true; ui.dopSearchQuery = ''; draw(); });
    return;
  }
  const searchInput = container.querySelector('#dop-search');
  if (!searchInput) return;

  function renderResults() {
    const q = ui.dopSearchQuery.trim().toLowerCase();
    const matches = availableDopRaboty
      .filter(d => !q || d.nazvanie.toLowerCase().includes(q))
      .slice(0, 20);
    const resultsEl = container.querySelector('#dop-search-results');
    if (!resultsEl) return;
    resultsEl.innerHTML = matches.length === 0
      ? '<div class="empty" style="padding:10px 0">Ничего не найдено</div>'
      : matches.map(d => `
        <div class="list-item dop-result" data-id="${d.id}" style="cursor:pointer">
          <div class="title">${escapeHtml(d.nazvanie)}</div>
          <span class="badge money">${money(d.stoimost)}</span>
        </div>
      `).join('');
    resultsEl.querySelectorAll('.dop-result').forEach(el => {
      el.addEventListener('click', () => {
        const dopRabotaId = Number(el.getAttribute('data-id'));
        state.dopRaboty = [...state.dopRaboty, {
          entryId: uid(),
          dopRabotaId,
          sektsiya: state.sektsii[0] || null,
          kolichestvo: 1,
        }];
        ui.dopSearchOpen = false;
        ui.dopSearchQuery = '';
        draw();
      });
    });
  }

  searchInput.focus();
  searchInput.addEventListener('input', (e) => {
    ui.dopSearchQuery = e.target.value;
    renderResults();
  });
  renderResults();
}

function wireDopEntries(container, state, draw) {
  container.querySelectorAll('.dop-entry-kol').forEach(el => el.addEventListener('change', (e) => {
    const entryId = e.target.getAttribute('data-entry');
    const entry = state.dopRaboty.find(x => x.entryId === entryId);
    if (entry) entry.kolichestvo = Math.max(1, Number(e.target.value) || 1);
    draw();
  }));
  container.querySelectorAll('.dop-entry-sektsiya').forEach(el => el.addEventListener('change', (e) => {
    const entryId = e.target.getAttribute('data-entry');
    const entry = state.dopRaboty.find(x => x.entryId === entryId);
    if (entry) entry.sektsiya = e.target.value;
    draw();
  }));
  container.querySelectorAll('.dop-entry-del').forEach(el => el.addEventListener('click', (e) => {
    const entryId = e.target.getAttribute('data-entry');
    state.dopRaboty = state.dopRaboty.filter(x => x.entryId !== entryId);
    draw();
  }));
}
