// Kiraan waktu solat (offline) dan logik "awal waktu".
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from 'adhan';

export const PRAYERS = [
  { key: 'subuh', name: 'Subuh', adhan: 'fajr' },
  { key: 'zohor', name: 'Zohor', adhan: 'dhuhr' },
  { key: 'asar', name: 'Asar', adhan: 'asr' },
  { key: 'maghrib', name: 'Maghrib', adhan: 'maghrib' },
  { key: 'isyak', name: 'Isyak', adhan: 'isha' },
];

// Kaedah Singapura/JAKIM: Subuh 20°, Isyak 18°, mazhab Syafie.
function params() {
  const p = CalculationMethod.Singapore();
  p.madhab = Madhab.Shafi;
  return p;
}

/** Waktu solat untuk satu tarikh (tarikh tempatan). */
export function timesFor(lat, lng, date) {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const t = new PrayerTimes(new Coordinates(lat, lng), day, params());
  return {
    subuh: t.fajr,
    syuruk: t.sunrise,
    zohor: t.dhuhr,
    asar: t.asr,
    maghrib: t.maghrib,
    isyak: t.isha,
  };
}

/** Bila tamat waktu solat tersebut. */
export function endOf(key, lat, lng, date) {
  const t = timesFor(lat, lng, date);
  switch (key) {
    case 'subuh': return t.syuruk;
    case 'zohor': return t.asar;
    case 'asar': return t.maghrib;
    case 'maghrib': return t.isyak;
    case 'isyak': {
      const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
      return timesFor(lat, lng, next).subuh;
    }
  }
  return null;
}

/** Solat seterusnya selepas `now` (boleh jadi Subuh esok). */
export function nextPrayer(lat, lng, now = new Date()) {
  for (let d = 0; d < 2; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const t = timesFor(lat, lng, day);
    for (const p of PRAYERS) {
      if (t[p.key] > now) return { ...p, time: t[p.key] };
    }
  }
  return null;
}

/** Solat yang sedang dalam waktu sekarang (atau null, cth. antara Syuruk dan Zohor). */
export function currentPrayer(lat, lng, now = new Date()) {
  const today = timesFor(lat, lng, now);
  if (now < today.subuh) return { key: 'isyak', dayOffset: -1 };
  for (let i = PRAYERS.length - 1; i >= 0; i--) {
    const k = PRAYERS[i].key;
    if (now >= today[k]) {
      if (k === 'subuh' && now >= today.syuruk) return null;
      return { key: k, dayOffset: 0 };
    }
  }
  return null;
}

/**
 * Status rekod solat:
 *  'awal'  — dalam `awalMin` minit selepas masuk waktu
 *  'dalam' — masih dalam waktu tetapi selepas tempoh awal
 *  'lewat' — selepas tamat waktu
 */
export function classify(doneAt, start, end, awalMin) {
  const diffMin = (doneAt - start) / 60000;
  if (diffMin <= awalMin) return 'awal';
  if (doneAt < end) return 'dalam';
  return 'lewat';
}

export function dateKey(d) {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function fmtTime(d) {
  return d.toLocaleTimeString('ms-MY', { hour: 'numeric', minute: '2-digit', hour12: true });
}

export function fmtCountdown(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(sec)}`;
}
