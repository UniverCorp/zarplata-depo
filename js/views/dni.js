import { buildMaps } from '../models.js';
import { dayTotals } from '../calc.js';
import { navigate } from '../router.js';
import { money, MONTHS_RU, WEEKDAYS_RU } from './ui.js';

function pad(n) { return String(n).padStart(2, '0'); }
function dateStr(y, m, d) { return `${y}-${pad(m)}-${pad(d)}`; }

export async function render(container, params) {
  const today = new Date();
  let year = params && params.year ? Number(params.year) : today.getFullYear();
  let month = params && params.month ? Number(params.month) : today.getMonth() + 1; // 1-12

  const maps = await buildMaps();
  const byDate = new Map(maps.dni.map(d => [d.date, d]));

  function draw() {
    const firstOfMonth = new Date(year, month - 1, 1);
    const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday=0
    const daysInMonth = new Date(year, month, 0).getDate();
    const todayStr = dateStr(today.getFullYear(), today.getMonth() + 1, today.getDate());

    const dayMoney = new Map();
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(year, month, d);
      const den = byDate.get(ds);
      if (den && (den.naryady || []).length) {
        dayMoney.set(ds, dayTotals(den, maps).total);
      }
    }
    const maxMoney = Math.max(0, ...dayMoney.values());

    const cells = [];
    for (let i = 0; i < startWeekday; i++) cells.push('<div class="calendar-cell empty-cell"></div>');
    for (let d = 1; d <= daysInMonth; d++) {
      const ds = dateStr(year, month, d);
      const sum = dayMoney.get(ds);
      const isToday = ds === todayStr;
      let style = '';
      let cls = 'calendar-cell';
      if (isToday) cls += ' today';
      if (sum !== undefined) {
        cls += ' has-data';
        const intensity = maxMoney > 0 ? sum / maxMoney : 0;
        const alpha = (0.14 + intensity * 0.6).toFixed(2);
        style = `background:rgba(255,122,53,${alpha});border-color:rgba(255,122,53,${(0.25 + intensity * 0.5).toFixed(2)})`;
      }
      cells.push(`<div class="${cls}" data-date="${ds}" style="${style}" title="${sum !== undefined ? money(sum) : ''}">${d}</div>`);
    }

    container.innerHTML = `
      <h1>Дни / Календарь</h1>
      <div class="calendar-nav">
        <button class="btn ghost" id="prev-month">&lsaquo; Пред.</button>
        <div style="font-weight:700">${MONTHS_RU[month - 1]} ${year}</div>
        <button class="btn ghost" id="next-month">След. &rsaquo;</button>
      </div>
      <div class="calendar-grid" style="margin-bottom:6px">
        ${WEEKDAYS_RU.map(w => `<div class="calendar-weekday">${w}</div>`).join('')}
      </div>
      <div class="calendar-grid">${cells.join('')}</div>
      <div class="calendar-legend">
        <span class="sq" style="background:rgba(255,122,53,.14)"></span>
        <span class="sq" style="background:rgba(255,122,53,.4)"></span>
        <span class="sq" style="background:rgba(255,122,53,.74)"></span>
        <span>меньше — больше заработано за день</span>
      </div>
      <p class="muted" style="margin-top:10px">Нажмите на день, чтобы открыть его и добавить наряды.</p>
    `;

    container.querySelector('#prev-month').addEventListener('click', () => {
      month -= 1;
      if (month < 1) { month = 12; year -= 1; }
      draw();
    });
    container.querySelector('#next-month').addEventListener('click', () => {
      month += 1;
      if (month > 12) { month = 1; year += 1; }
      draw();
    });
    container.querySelectorAll('[data-date]').forEach(el => {
      el.addEventListener('click', () => navigate(`/dni/${el.getAttribute('data-date')}`));
    });
  }

  draw();
}
