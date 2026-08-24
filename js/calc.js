// Чистые функции расчёта. Ничего не читают из БД напрямую — работают с уже загруженными данными.

export function findRemont(lokomotiv, remontId) {
  return (lokomotiv.remonty || []).find(r => r.id === remontId) || null;
}

// naryad.dopRaboty — массив записей { entryId, dopRabotaId, sektsiya, kolichestvo }.
// Одна и та же доп. работа может быть добавлена несколько раз (разные секции / количество).
export function naryadCostBase(naryad, lokomotiv, dopRabotyMap) {
  const remont = findRemont(lokomotiv, naryad.remontId);
  if (!remont) return 0;
  let cost = remont.stoimostZaSektsiyu * (naryad.sektsii || []).length;
  for (const entry of naryad.dopRaboty || []) {
    const d = dopRabotyMap.get(entry.dopRabotaId);
    if (d) cost += d.stoimost * (entry.kolichestvo || 1);
  }
  return cost;
}

export function naryadNormHours(naryad, lokomotiv, dopRabotyMap) {
  const remont = findRemont(lokomotiv, naryad.remontId);
  if (!remont) return 0;
  let hours = remont.normaChasov * (naryad.sektsii || []).length;
  for (const entry of naryad.dopRaboty || []) {
    const d = dopRabotyMap.get(entry.dopRabotaId);
    if (d) hours += d.normaChasov * (entry.kolichestvo || 1);
  }
  return hours;
}

export function naryadCost(naryad, lokomotiv, dopRabotyMap, dvoinaya) {
  const base = naryadCostBase(naryad, lokomotiv, dopRabotyMap);
  return dvoinaya ? base * 2 : base;
}

export function naryadShares(naryad, lokomotiv, dopRabotyMap, dvoinaya, razryadyMap, slesariMap) {
  const total = naryadCost(naryad, lokomotiv, dopRabotyMap, dvoinaya);
  const participants = (naryad.slesariIds || []).filter(id => slesariMap.has(id));
  const weights = participants.map(id => {
    const s = slesariMap.get(id);
    const r = razryadyMap.get(s.razryad);
    return r ? (r.koef || 0) : 0;
  });
  const sumWeights = weights.reduce((a, b) => a + b, 0);
  const shares = new Map();
  if (sumWeights <= 0) return shares;
  participants.forEach((id, i) => {
    shares.set(id, total * weights[i] / sumWeights);
  });
  return shares;
}

// Итог дня. Нормо-часы каждому участнику наряда начисляются полностью (не делятся
// на число человек в бригаде) — так принято считать выработку в бригаде.
//
// Явка (den.prisutstvuyut) — отдельный список "кто сегодня на смене", никак не связанный
// с тем, кого вписали в наряды. Сдельщина (деньги, нормо-часы) считается только по нарядам
// и никак не влияет на аванс; аванс считается только по явке и часам смены.
export function dayTotals(den, maps) {
  const { lokomotivyMap, dopRabotyMap, razryadyMap, slesariMap } = maps;
  let total = 0;
  const perSlesarMoney = new Map();
  const perSlesarNormHours = new Map();
  const naryadParticipants = new Set();
  const naryadRows = [];
  for (const naryad of den.naryady || []) {
    const lokomotiv = lokomotivyMap.get(naryad.lokomotivId);
    if (!lokomotiv) continue;
    const cost = naryadCost(naryad, lokomotiv, dopRabotyMap, den.dvoinaya);
    const hours = naryadNormHours(naryad, lokomotiv, dopRabotyMap);
    const shares = naryadShares(naryad, lokomotiv, dopRabotyMap, den.dvoinaya, razryadyMap, slesariMap);
    total += cost;
    for (const [id, share] of shares) {
      perSlesarMoney.set(id, (perSlesarMoney.get(id) || 0) + share);
    }
    for (const id of naryad.slesariIds || []) {
      if (!slesariMap.has(id)) continue;
      naryadParticipants.add(id);
      perSlesarNormHours.set(id, (perSlesarNormHours.get(id) || 0) + hours);
    }
    naryadRows.push({ naryad, lokomotiv, cost, hours, shares });
  }
  const prisutstvuyut = new Set((den.prisutstvuyut || []).filter(id => slesariMap.has(id)));
  const displayed = new Set([...prisutstvuyut, ...naryadParticipants]);
  return { total, perSlesarMoney, perSlesarNormHours, naryadParticipants, prisutstvuyut, displayed, naryadRows };
}

// % выработки = нормо-часы, сделанные слесарем за день, от часов его смены в этот день.
// Может быть больше 100%, если бригада уложилась в смену быстрее нормы.
export function slesarPercent(normHours, smenaChasov) {
  if (!smenaChasov) return 0;
  return (normHours / smenaChasov) * 100;
}

// Деньги и нормо-часы (сдельщина) считаются по нарядам. Часы для аванса — только по явке
// (den.prisutstvuyut), независимо от того, был ли слесарь в этот день в каком-то наряде.
export function periodStats(dniList, maps, dateFrom, dateTo) {
  const perSlesarMoney = new Map();
  const perSlesarNormHours = new Map();
  const perSlesarAttendanceHours = new Map();
  const perSlesarDays = new Map();
  for (const den of dniList) {
    if (den.date < dateFrom || den.date > dateTo) continue;
    const { perSlesarMoney: dayMoney, perSlesarNormHours: dayHours, prisutstvuyut } = dayTotals(den, maps);
    for (const [id, v] of dayMoney) perSlesarMoney.set(id, (perSlesarMoney.get(id) || 0) + v);
    for (const [id, v] of dayHours) perSlesarNormHours.set(id, (perSlesarNormHours.get(id) || 0) + v);
    const smena = den.smenaChasov || 0;
    for (const id of prisutstvuyut) {
      perSlesarAttendanceHours.set(id, (perSlesarAttendanceHours.get(id) || 0) + smena);
      perSlesarDays.set(id, (perSlesarDays.get(id) || 0) + 1);
    }
  }
  return { perSlesarMoney, perSlesarNormHours, perSlesarAttendanceHours, perSlesarDays };
}

export function periodPercent(normHours, attendanceHours) {
  if (!attendanceHours) return 0;
  return (normHours / attendanceHours) * 100;
}

// Аванс считается от часов смены (табельных), а не от нормо-часов выработки —
// иначе он менялся бы в зависимости от того, насколько быстро бригада справилась с работой.
export function avansForSlesar(attendanceHours, slesar, razryadyMap, settings) {
  const r = razryadyMap.get(slesar.razryad);
  const stavka = r ? (r.stavka || 0) : 0;
  return stavka * attendanceHours * (1 + settings.zonalnaya) * (1 - settings.ndfl);
}

// Зональная надбавка (для зарплаты) = часы явки за месяц × тарифная ставка × 50% —
// та же идея, что и внутри аванса, но по часам за весь месяц, а не только за 1–15 число.
export function zonalNadbavka(attendanceHours, stavka, settings) {
  return attendanceHours * stavka * settings.zonalnaya;
}

// Аванс — отдельная, самостоятельная выплата (обычно ближе к концу месяца), она НЕ вычитается
// из зарплаты. Зарплата (сдельщина, обычно выплачивается в середине следующего месяца) и аванс —
// это два разных прихода денег, "итого доход" — просто их сумма, а не разница.
export function monthSettlement(gross, attendanceHours, stavka, settings, avansPaid) {
  const zonal = zonalNadbavka(attendanceHours, stavka, settings);
  const zarplata = gross + zonal;
  return { gross, zonal, zarplata, avansPaid, itogo: zarplata + avansPaid };
}

// Ряд значений по дням месяца — для графиков. slesarIds=null → по всей бригаде,
// иначе только по перечисленным слесарям (например, только по тем, кто отмечен "это я").
export function dailySeries(dniList, maps, year, month, slesarIds = null) {
  const { lastDay } = monthRange(year, month);
  const pad = n => String(n).padStart(2, '0');
  const byDate = new Map(dniList.map(d => [d.date, d]));
  const gross = [], attendanceHours = [], normHours = [], labels = [];
  for (let day = 1; day <= lastDay; day++) {
    const date = `${year}-${pad(month)}-${pad(day)}`;
    const den = byDate.get(date);
    labels.push(String(day));
    if (!den) { gross.push(0); attendanceHours.push(0); normHours.push(0); continue; }
    const totals = dayTotals(den, maps);
    let g = 0, h = 0, n = 0;
    if (slesarIds) {
      for (const id of slesarIds) {
        g += totals.perSlesarMoney.get(id) || 0;
        n += totals.perSlesarNormHours.get(id) || 0;
        if (totals.prisutstvuyut.has(id)) h += den.smenaChasov || 0;
      }
    } else {
      g = totals.total;
      n = Array.from(totals.perSlesarNormHours.values()).reduce((a, b) => a + b, 0);
      h = totals.prisutstvuyut.size * (den.smenaChasov || 0);
    }
    gross.push(g); attendanceHours.push(h); normHours.push(n);
  }
  return { labels, gross, attendanceHours, normHours };
}

export function monthRange(year, month) {
  // month: 1-12
  const pad = n => String(n).padStart(2, '0');
  const last = new Date(year, month, 0).getDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
    lastDay: last,
  };
}
