import { buildMaps } from '../models.js';
import { periodStats, avansForSlesar, monthSettlement, monthRange, periodPercent, dailySeries } from '../calc.js';
import { escapeHtml, money, MONTHS_RU } from './ui.js';
import { barChart } from './charts.js';

function pad(n) { return String(n).padStart(2, '0'); }

export async function render(container, params) {
  const today = new Date();
  let year = params && params.year ? Number(params.year) : today.getFullYear();
  let month = params && params.month ? Number(params.month) : today.getMonth() + 1;

  const maps = await buildMaps();

  function draw() {
    const range = monthRange(year, month);
    const avansFrom = `${year}-${pad(month)}-${pad(maps.settings.avansStart)}`;
    const avansTo = `${year}-${pad(month)}-${pad(Math.min(maps.settings.avansEnd, range.lastDay))}`;

    const monthStats = periodStats(maps.dni, maps, range.from, range.to);
    const avansStats = periodStats(maps.dni, maps, avansFrom, avansTo);
    const dailySeriesData = dailySeries(maps.dni, maps, year, month, null);

    const activeSlesari = maps.slesari.filter(s => s.active !== false);

    const percentByDay = dailySeriesData.labels.map((_, i) => periodPercent(dailySeriesData.normHours[i], dailySeriesData.attendanceHours[i]));

    let totalZarplata = 0, totalAvans = 0, totalItogo = 0;
    const rows = activeSlesari.map(s => {
      const r = maps.razryadyMap.get(s.razryad);
      const stavka = r ? (r.stavka || 0) : 0;
      const gross = monthStats.perSlesarMoney.get(s.id) || 0;
      const monthHours = monthStats.perSlesarAttendanceHours.get(s.id) || 0;
      const avansHours = avansStats.perSlesarAttendanceHours.get(s.id) || 0;
      const avansPaid = avansForSlesar(avansHours, s, maps.razryadyMap, maps.settings);
      const settlement = monthSettlement(gross, monthHours, stavka, maps.settings, avansPaid);
      totalZarplata += settlement.zarplata;
      totalAvans += avansPaid;
      totalItogo += settlement.itogo;
      return { s, ...settlement };
    });

    container.innerHTML = `
      <h1>Итог месяца</h1>
      <div class="calendar-nav">
        <button class="btn ghost" id="prev-month">&lsaquo; Пред.</button>
        <div style="font-weight:700">${MONTHS_RU[month - 1]} ${year}</div>
        <button class="btn ghost" id="next-month">След. &rsaquo;</button>
      </div>
      <p class="muted">Зарплата (сдельщина) и аванс — две отдельные, независимые выплаты в разные даты. Аванс не вычитается из зарплаты — он просто приходит отдельно.</p>

      <div class="stat-grid">
        <div class="stat-card"><div class="value">${money(totalZarplata)}</div><div class="label">Зарплата</div></div>
        <div class="stat-card"><div class="value">${money(totalAvans)}</div><div class="label">Аванс</div></div>
        <div class="stat-card"><div class="value">${money(totalItogo)}</div><div class="label">Итого доход за месяц</div></div>
      </div>

      <div class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">Сдельщина по дням</div>
          <div class="chart-value">вся бригада</div>
        </div>
        ${barChart(dailySeriesData.gross, dailySeriesData.labels, { color: 'var(--accent)' })}
      </div>

      <div class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">Выработка по дням</div>
          <div class="chart-value">% нормо-часов к часам явки</div>
        </div>
        ${barChart(percentByDay, dailySeriesData.labels, { color: 'var(--accent)' })}
      </div>

      <h2>По слесарям</h2>
      <div class="card table-scroll">
        ${rows.length === 0 ? '<div class="empty">Нет активных слесарей</div>' : `
        <table>
          <thead><tr><th>Слесарь</th><th>Сдельщина</th><th>Зональная</th><th>Аванс</th><th>Итого</th></tr></thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td>${escapeHtml(r.s.familia)}</td>
                <td>${money(r.gross)}</td>
                <td>${money(r.zonal)}</td>
                <td>${money(r.avansPaid)}</td>
                <td><strong>${money(r.itogo)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>`}
      </div>
      <p class="muted">Зарплата = сдельщина (сумма всех нарядов) + зональная надбавка. Зональная надбавка = часы явки за месяц × тарифная ставка × 50%. Аванс считается отдельно, по часам явки за 1–${maps.settings.avansEnd} число × тариф × (1 + зональная надбавка) × (1 − НДФЛ). Итого = зарплата + аванс. Выработка на графике — % нормо-часов от часов смены за каждый рабочий день.</p>
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
