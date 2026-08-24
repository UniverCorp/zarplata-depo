export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function money(n) {
  return (Math.round((n || 0) * 100) / 100).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ₽';
}

export function hours(n) {
  return (Math.round((n || 0) * 100) / 100).toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ч';
}

export function toast(text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

export function confirmAction(message) {
  return window.confirm(message);
}

export const RAZRYAD_OPTIONS = [3, 4, 5, 6];

export const MONTHS_RU = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
];

export const WEEKDAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
