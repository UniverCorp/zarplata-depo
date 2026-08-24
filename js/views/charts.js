// Лёгкие SVG-графики без внешних библиотек. Все функции — чистые: данные внутрь, строка SVG наружу.

function fmtPath(points) {
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(' ');
}

// Компактный спарклайн для карточки статистики.
export function sparkline(values, { width = 120, height = 36, color = 'var(--accent)' } = {}) {
  if (!values || values.length < 2) {
    return `<svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none"></svg>`;
  }
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const points = values.map((v, i) => [i * stepX, height - ((v - min) / range) * (height - 4) - 2]);
  const linePath = fmtPath(points);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const id = 'sg' + Math.random().toString(36).slice(2, 9);
  return `
    <svg class="sparkline" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${id})" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;
}

// Кольцевая диаграмма прогресса (0-100%, может быть > 100 — тогда кольцо полное + подпись).
export function donut(percent, { size = 120, stroke = 12, color = 'var(--accent)', track = 'var(--border-strong)' } = {}) {
  const r = (size - stroke) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = circumference * (1 - clamped / 100);
  return `
    <svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${track}" stroke-width="${stroke}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${stroke}"
        stroke-linecap="round" stroke-dasharray="${circumference.toFixed(2)}" stroke-dashoffset="${offset.toFixed(2)}"
        transform="rotate(-90 ${c} ${c})"/>
    </svg>
  `;
}

// Столбчатая диаграмма по дням (значения >= 0).
export function barChart(values, labels, { width = 320, height = 140, color = 'var(--accent)', barGap = 3 } = {}) {
  const max = Math.max(...values, 1);
  const n = values.length;
  const barWidth = Math.max(1, width / n - barGap);
  const bars = values.map((v, i) => {
    const h = Math.max(1, (v / max) * (height - 4));
    const x = i * (width / n) + barGap / 2;
    const y = height - h;
    return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" rx="2" fill="${v > 0 ? color : 'var(--border-strong)'}" fill-opacity="${v > 0 ? 1 : 0.5}"/>`;
  }).join('');
  const step = Math.max(1, Math.ceil(n / 8));
  const labelEls = labels.map((l, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    const x = i * (width / n) + (width / n) / 2;
    return `<text x="${x.toFixed(2)}" y="${height + 14}" font-size="9" fill="var(--text-dim)" text-anchor="middle">${l}</text>`;
  }).join('');
  return `
    <svg class="bar-chart" viewBox="0 0 ${width} ${height + 18}" preserveAspectRatio="none" style="width:100%;height:auto">
      ${bars}
      ${labelEls}
    </svg>
  `;
}

// Линейно-заливная диаграмма тренда (как биржевой график) с точками по дням месяца.
export function areaTrend(values, labels, { width = 640, height = 180, color = 'var(--accent)' } = {}) {
  const max = Math.max(...values, 1);
  const n = values.length;
  const stepX = n > 1 ? width / (n - 1) : width;
  const points = values.map((v, i) => [i * stepX, height - (v / max) * (height - 16) - 8]);
  const linePath = fmtPath(points);
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;
  const id = 'at' + Math.random().toString(36).slice(2, 9);
  const step = Math.max(1, Math.ceil(n / 7));
  const labelEls = labels.map((l, i) => {
    if (i % step !== 0 && i !== n - 1) return '';
    return `<text x="${(i * stepX).toFixed(2)}" y="${height + 14}" font-size="9" fill="var(--text-dim)" text-anchor="middle">${l}</text>`;
  }).join('');
  return `
    <svg class="area-trend" viewBox="0 0 ${width} ${height + 18}" preserveAspectRatio="none" style="width:100%;height:auto">
      <defs>
        <linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.4"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${areaPath}" fill="url(#${id})" stroke="none"/>
      <path d="${linePath}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      ${labelEls}
    </svg>
  `;
}
