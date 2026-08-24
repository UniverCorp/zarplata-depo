import { ensureDefaults } from './models.js';
import { route, startRouter } from './router.js';
import * as home from './views/home.js';
import * as slesari from './views/slesari.js';
import * as lokomotivy from './views/lokomotivy.js';
import * as dopRaboty from './views/dopRaboty.js';
import * as dni from './views/dni.js';
import * as den from './views/den.js';
import * as avans from './views/avans.js';
import * as itog from './views/itog.js';
import * as nastroiki from './views/nastroiki.js';

const app = document.getElementById('app');
const drawer = document.getElementById('drawer');
const drawerOverlay = document.getElementById('drawer-overlay');
const menuBtn = document.getElementById('menu-btn');

function openDrawer() { drawer.classList.add('open'); drawerOverlay.classList.add('open'); }
function closeDrawer() { drawer.classList.remove('open'); drawerOverlay.classList.remove('open'); }

menuBtn.addEventListener('click', openDrawer);
drawerOverlay.addEventListener('click', closeDrawer);
drawer.querySelectorAll('.drawer-link').forEach(el => el.addEventListener('click', closeDrawer));

route('/', (params) => home.render(app, params));
route('/slesari', (params) => slesari.render(app, params));
route('/lokomotivy', (params) => lokomotivy.render(app, params));
route('/dop-raboty', (params) => dopRaboty.render(app, params));
route('/dni', (params) => dni.render(app, params));
route('/dni/:date', (params) => den.render(app, params));
route('/avans', (params) => avans.render(app, params));
route('/itog', (params) => itog.render(app, params));
route('/nastroiki', (params) => nastroiki.render(app, params));

async function main() {
  await ensureDefaults();
  startRouter();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* офлайн-кэш недоступен, не критично */ });
  }
}

main();
