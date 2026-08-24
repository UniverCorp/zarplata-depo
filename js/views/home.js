import { buildMaps } from '../models.js';
import { periodStats, avansForSlesar, monthSettlement, monthRange, dailySeries, periodPercent } from '../calc.js';
import { navigate } from '../router.js';
import { money, MONTHS_RU } from './ui.js';
import { sparkline, areaTrend, barChart } from './charts.js';

function pad(n) { return String(n).padStart(2, '0'); }

export async function render(container) {
  const maps = await buildMaps();
  const today = new Date();
  let year = today.getFullYear();
  let month = today.getMonth() + 1;
  const accent = 'var(--accent)';

  function draw() {
    const range = monthRange(year, month);
    const avansFrom = `${year}-${pad(month)}-${pad(maps.settings.avansStart)}`;
    const avansTo = `${year}-${pad(month)}-${pad(Math.min(maps.settings.avansEnd, range.lastDay))}`;

    const monthStats = periodStats(maps.dni, maps, range.from, range.to);
    const avansStats = periodStats(maps.dni, maps, avansFrom, avansTo);

    const meSlesari = maps.slesari.filter(s => s.active !== false && s.showOnHome);
    const meIds = meSlesari.map(s => s.id);

    let totalGross = 0, totalZonal = 0, totalZarplata = 0, totalAvans = 0;
    for (const s of meSlesari) {
      const r = maps.razryadyMap.get(s.razryad);
      const stavka = r ? (r.stavka || 0) : 0;
      const gross = monthStats.perSlesarMoney.get(s.id) || 0;
      const monthHours = monthStats.perSlesarAttendanceHours.get(s.id) || 0;
      const avansHours = avansStats.perSlesarAttendanceHours.get(s.id) || 0;
      const avansPaid = avansForSlesar(avansHours, s, maps.razryadyMap, maps.settings);
      const settlement = monthSettlement(gross, monthHours, stavka, maps.settings, avansPaid);
      totalGross += settlement.gross;
      totalZonal += settlement.zonal;
      totalZarplata += settlement.zarplata;
      totalAvans += avansPaid;
    }

    const series = dailySeries(maps.dni, maps, year, month, meIds.length ? meIds : null);
    const percentByDay = series.labels.map((_, i) => periodPercent(series.normHours[i], series.attendanceHours[i]));
    const hasBasics = maps.slesari.length > 0 && maps.lokomotivy.length > 0;

    container.innerHTML = `
      <h1>Главная</h1>
      <div class="calendar-nav">
        <button class="btn ghost" id="prev-month">&lsaquo; Пред.</button>
        <div style="font-weight:700">${MONTHS_RU[month - 1]} ${year}</div>
        <button class="btn ghost" id="next-month">След. &rsaquo;</button>
      </div>

      ${!hasBasics ? `
      <div class="card">
        <div class="title" style="font-weight:700;margin-bottom:6px">Начните с настройки справочников</div>
        <p class="muted">Сначала добавьте слесарей и хотя бы одну серию тепловоза, потом можно будет вносить наряды по дням.</p>
        <div class="btn-row">
          <button class="btn" id="go-slesari">Слесари</button>
          <button class="btn secondary" id="go-lok">Тепловозы</button>
        </div>
      </div>` : ''}

      ${hasBasics && meSlesari.length === 0 ? `
      <div class="card">
        <div class="title" style="font-weight:700;margin-bottom:6px">Отметьте, кто из слесарей — это вы</div>
        <p class="muted">Главная показывает доход только по отмеченным слесарям. Откройте раздел "Слесари" и включите переключатель "Показывать на Главной странице" у себя.</p>
        <div class="btn-row">
          <button class="btn" id="go-slesari2">Слесари</button>
        </div>
      </div>` : ''}

      <div class="home-columns">
        <div class="home-col">
          <div class="stat-card">
            <div class="stat-top">Зарплата</div>
            <div class="value">${money(totalZarplata)}</div>
            <div class="label">сдельщина + зональная</div>
            <div class="sparkline-wrap">${sparkline(series.gross, { color: accent })}</div>
          </div>
          <div class="stat-card">
            <div class="stat-top">Сдельная оплата</div>
            <div class="value">${money(totalGross)}</div>
            <div class="label">сумма всех нарядов</div>
            <div class="sparkline-wrap">${sparkline(series.gross, { color: accent })}</div>
          </div>
          <div class="stat-card">
            <div class="stat-top">Зональная надбавка</div>
            <div class="value">${money(totalZonal)}</div>
            <div class="label">часы явки × тариф × 50%</div>
            <div class="sparkline-wrap">${sparkline(series.attendanceHours, { color: accent })}</div>
          </div>
        </div>
        <div class="home-col avans-col">
          <div class="stat-card">
            <div class="stat-top">Аванс (1–${maps.settings.avansEnd})</div>
            <div class="value">${money(totalAvans)}</div>
            <div class="label">тариф × часы явки</div>
            <div class="sparkline-wrap">${sparkline(series.attendanceHours.slice(0, maps.settings.avansEnd), { color: accent })}</div>
          </div>
        </div>
      </div>

      <div class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">Динамика сдельщины</div>
          <div class="chart-value">${MONTHS_RU[month - 1]} ${year}</div>
        </div>
        ${areaTrend(series.gross, series.labels, { color: accent })}
      </div>

      <div class="card chart-card">
        <div class="chart-head">
          <div class="chart-title">Выработка по дням</div>
          <div class="chart-value">лично ваша</div>
        </div>
        ${barChart(percentByDay, series.labels, { color: accent })}
        <p class="muted" style="margin-top:8px">Часы наряда делятся между всеми, кто в нём участвовал — это ваша доля, а не общая выработка бригады по наряду.</p>
      </div>

      <div class="btn-row" style="margin-top:6px">
        <button class="btn block" id="go-today">Открыть сегодняшний день</button>
      </div>
      <div class="btn-row">
        <button class="btn secondary" id="go-dni">Календарь</button>
        <button class="btn secondary" id="go-avans">Аванс</button>
        <button class="btn secondary" id="go-itog">Итог месяца</button>
      </div>
    `;

    const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
    container.querySelector('#go-today').addEventListener('click', () => navigate(`/dni/${todayStr}`));
    container.querySelector('#go-dni').addEventListener('click', () => navigate('/dni'));
    container.querySelector('#go-avans').addEventListener('click', () => navigate('/avans'));
    container.querySelector('#go-itog').addEventListener('click', () => navigate('/itog'));
    if (!hasBasics) {
      container.querySelector('#go-slesari').addEventListener('click', () => navigate('/slesari'));
      container.querySelector('#go-lok').addEventListener('click', () => navigate('/lokomotivy'));
    }
    const goSlesari2 = container.querySelector('#go-slesari2');
    if (goSlesari2) goSlesari2.addEventListener('click', () => navigate('/slesari'));

    container.querySelector('#prev-month').addEventListener('click', () => {
      month -= 1; if (month < 1) { month = 12; year -= 1; } draw();
    });
    container.querySelector('#next-month').addEventListener('click', () => {
      month += 1; if (month > 12) { month = 1; year += 1; } draw();
    });
  }

  draw();
}
