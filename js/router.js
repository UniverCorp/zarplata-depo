const routes = [];

export function route(pattern, handler) {
  // pattern like '/dni/:date'
  const paramNames = [];
  const regexStr = '^' + pattern.replace(/:[^/]+/g, (m) => {
    paramNames.push(m.slice(1));
    return '([^/]+)';
  }) + '$';
  routes.push({ regex: new RegExp(regexStr), paramNames, handler });
}

export function navigate(path) {
  window.location.hash = '#' + path;
}

function currentPath() {
  const hash = window.location.hash || '#/';
  return hash.slice(1) || '/';
}

async function resolve() {
  const path = currentPath();
  for (const r of routes) {
    const m = path.match(r.regex);
    if (m) {
      const params = {};
      r.paramNames.forEach((name, i) => { params[name] = decodeURIComponent(m[i + 1]); });
      await r.handler(params);
      highlightNav(path);
      return;
    }
  }
  console.warn('Нет маршрута для', path);
}

function highlightNav(path) {
  document.querySelectorAll('[data-nav-link]').forEach(el => {
    const target = el.getAttribute('data-nav-link');
    el.classList.toggle('active', path === target || (target !== '/' && path.startsWith(target)));
  });
}

export function startRouter() {
  window.addEventListener('hashchange', resolve);
  resolve();
}
