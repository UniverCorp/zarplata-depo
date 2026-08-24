import { buildMaps } from '../models.js';
import { periodStats, avansForSlesar, monthRange, dailySeries } from '../calc.js';
import { escapeHtml, money, hours, MONTHS_RU } from './ui.js';
import { barChart } from './charts.js';

function pad(n) { return String(n).padStart(2, '0'); }

export async function render(container, params) {
  const today = new Date();
  let year = params && params.year ? Number(params.year) : today.getFullYear();
  let month = params && params.month ? Number(params.month) : today.getMonth() + 1;

  const maps = await buildMaps();

  function draw() {
    const range = monthRange(year, month);
    const from = `${year}-${pad(month)}-${pad(maps.settings.avansStart)}`;
    const to = `${year}-${pad(month)}-${pad(Math.min(maps.settings.avansEnd, range.lastDay))}`;

    const { perSlesarAttendanceHours, perSlesarDays } = periodStats(maps.dni, maps, from, to);
    const activeSlesari = maps.slesari.filter(s => s.active !== false);
    const fullSeries = dailySeries(maps.dni, maps, year, month, null);
    const periodEnd = Math.min(maps.settings.avansEnd, range.lastDay);
    const periodLabels = fullSeries.labels.slice(maps.settings.avansStart - 1, periodEnd);
    const periodHours = fullSeries.attendanceHours.slice(maps.settings.avansStart - 1, periodEnd);

    let totalAvans = 0;
    const rows = activeSlesari.map(s => {
      const h = perSlesarAttendanceHours.get(s.id) || 0;
      const days = perSlesarDays.get(s.id) || 0;
      const av = avansForSlesar(h, s, maps.razryadyMap, maps.settings);
      totalAvans += av;
      return { s, h, days, av };
    });

    container.innerHTML = `
      <h1>Аванс</h1>
      <div class="calendar-nav">
        <button class="btn ghost" id="prev-month">&lsaquo; Пред.</button>
        <div style="font-weight:700">${MONTHS_RU[month - 1]} ${year}</div>
        <button class="btn ghost" id="next-month">След. &rsaquo;</button>
      </div>
      <p class="muted">Период: ${maps.settings.avansStart}–${maps.settings.avansEnd} число. Часы берутся из явки (отмечается на экране дня) и часов смены — это чистый тариф, наряды и сдельщина на аванс не влияют.</p>

      <div class="stat-grid">
        <div class="stat-card"><div class="value">${money(totalAvans)}</div><div class="label">Аванс всего</div></div>
        <div class="stat-card"><div class="value">${rows.length}</div><div class="label">Слесарей</div></div>
      </div>

      <div class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">Явка по дням</div>
          <div class="chart-value">часы смены, вся бригада</div>
        </div>
        ${barChart(periodHours, periodLabels, { color: 'var(--accent)' })}
      </div>

      <h2>По слесарям</h2>
      <div class="card">
        ${rows.length === 0 ? '<div class="empty">Нет активных слесарей</div>' : rows.map(({ s, h, days, av }) => `
          <div class="list-item">
            <div>
              <div class="title">${escapeHtml(s.familia)}</div>
              <div class="sub">${days} дн. · ${hours(h)} · разряд ${s.razryad}</div>
            </div>
            <span class="badge money">${money(av)}</span>
          </div>
        `).join('')}
      </div>
      <p class="muted">Формула: тарифная ставка × часы смены × (1 + зональная надбавка) × (1 − НДФЛ). Проценты и часы смены по умолчанию настраиваются в разделе "Настройки", на конкретный день — на экране дня.</p>
    `;

    container.querySelector('#prev-month').addEventListener('click', () => {
      month -= 1; if (month < 1) { month = 12; year -= 1; } draw();
    });
    container.querySelector('#next-month').addEventListener('click', () => {
      month += 1; if (month > 12) { month = 1; year += 1; } draw();
    });
  }

  draw();
}
