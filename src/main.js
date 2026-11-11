import './style.css';
import { Capacitor } from '@capacitor/core';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import {
  PRAYERS, timesFor, endOf, nextPrayer, currentPrayer, classify,
  dateKey, fmtTime, fmtCountdown,
} from './prayer.js';
import { store } from './store.js';
import { ensurePermission, reschedule } from './notify.js';

// Pilihan lokasi manual jika GPS tidak dapat digunakan.
const CITIES = [
  ['Kuala Lumpur', 3.139, 101.6869], ['Shah Alam', 3.0733, 101.5185],
  ['Putrajaya', 2.9264, 101.6964], ['Seremban', 2.7297, 101.9381],
  ['Melaka', 2.1896, 102.2501], ['Johor Bahru', 1.4927, 103.7414],
  ['Kuantan', 3.8077, 103.326], ['Kuala Terengganu', 5.3302, 103.1408],
  ['Kota Bharu', 6.1254, 102.2381], ['Ipoh', 4.5975, 101.0901],
  ['Georgetown', 5.4141, 100.3288], ['Alor Setar', 6.1248, 100.3678],
  ['Kangar', 6.4414, 100.1986], ['Kota Kinabalu', 5.9804, 116.0735],
  ['Kuching', 1.5533, 110.3592], ['Labuan', 5.2831, 115.2308],
];

const STATUS_LABEL = { awal: 'Awal waktu', dalam: 'Dalam waktu', lewat: 'Lewat' };

const state = { loc: null, settings: null, log: {}, tab: 'home' };
const $ = (sel) => document.querySelector(sel);

// ---------- Lokasi ----------
async function detectLocation() {
  setMsg('Mengesan lokasi GPS…');
  try {
    if (Capacitor.isNativePlatform()) {
      const perm = await Geolocation.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') throw new Error('Kebenaran lokasi ditolak');
    }
    const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: false, timeout: 30000, maximumAge: 600000 });
    const { latitude: lat, longitude: lng } = pos.coords;
    await saveLocation({ lat, lng, label: `GPS ${lat.toFixed(3)}, ${lng.toFixed(3)}` });
    setMsg('');
  } catch (e) {
    setMsg(`GPS gagal (${e.message || e}). Pilih bandar di Tetapan.`);
    if (!state.loc) state.tab = 'settings';
  }
  render();
}

async function saveLocation(loc) {
  state.loc = { ...loc, at: new Date().toISOString() };
  await store.setLocation(state.loc);
  await refreshNotifications();
}

async function refreshNotifications() {
  try {
    if (state.settings.notify) await ensurePermission();
    await reschedule(state.loc, state.settings);
  } catch (e) {
    console.warn('notifikasi', e);
  }
}

function setMsg(text) {
  const el = $('#msg');
  if (el) { el.textContent = text; el.hidden = !text; }
}

// ---------- Rekod ----------
async function toggleDone(key, dayOffset = 0) {
  const now = new Date();
  const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset);
  const dk = dateKey(day);
  const entry = state.log[dk] || {};
  if (entry[key]) {
    if (!confirm(`Padam rekod ${key}?`)) return;
    delete entry[key];
  } else {
    const start = timesFor(state.loc.lat, state.loc.lng, day)[key];
    if (now < start) return;
    const end = endOf(key, state.loc.lat, state.loc.lng, day);
    entry[key] = { at: now.toISOString(), status: classify(now, start, end, state.settings.awalMin) };
  }
  state.log[dk] = entry;
  await store.setLog(state.log);
  render();
}

// ---------- Paparan ----------
function render() {
  document.querySelectorAll('nav button').forEach((b) => b.classList.toggle('on', b.dataset.tab === state.tab));
  const main = $('#main');
  if (state.tab === 'home') main.innerHTML = renderHome();
  else if (state.tab === 'rekod') main.innerHTML = renderRekod();
  else main.innerHTML = renderSettings();
  tick();
}

function renderHome() {
  if (!state.loc) {
    return `<div class="card center"><p>Lokasi belum ditetapkan.</p>
      <button class="primary" data-act="gps">Guna GPS</button></div>`;
  }
  const now = new Date();
  const t = timesFor(state.loc.lat, state.loc.lng, now);
  const todayLog = state.log[dateKey(now)] || {};
  const cur = currentPrayer(state.loc.lat, state.loc.lng, now);

  let yesterdayIsyak = '';
  if (cur && cur.dayOffset === -1) {
    const yk = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
    const rec = (state.log[yk] || {}).isyak;
    yesterdayIsyak = row({ key: 'isyak', name: 'Isyak (malam ini)' },
      timesFor(state.loc.lat, state.loc.lng, new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)).isyak,
      rec, true, -1);
  }

  const rows = PRAYERS.map((p) => {
    const html = row(p, t[p.key], todayLog[p.key], cur && cur.key === p.key && cur.dayOffset === 0, 0);
    return p.key === 'subuh'
      ? html + `<div class="row syuruk"><span>Syuruk</span><span>${fmtTime(t.syuruk)}</span></div>`
      : html;
  }).join('');

  const done = PRAYERS.filter((p) => todayLog[p.key]).length;
  const awal = PRAYERS.filter((p) => todayLog[p.key]?.status === 'awal').length;

  return `
    <div class="hero card">
      <div class="label">Seterusnya: <b id="next-name">–</b> <span id="next-time"></span></div>
      <div class="countdown" id="countdown">--:--:--</div>
      <div class="sub">${now.toLocaleDateString('ms-MY', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
      <div class="sub small">📍 ${esc(state.loc.label)}</div>
    </div>
    <div class="card">
      <div class="today">Hari ini: <b>${done}/5</b> solat · <b class="g">${awal}</b> awal waktu</div>
      ${yesterdayIsyak}${rows}
      <p class="hint">Tekan solat selepas selesai untuk rekod. Awal waktu = dalam ${state.settings.awalMin} minit.</p>
    </div>`;
}

function row(p, time, rec, isCurrent, dayOffset) {
  const started = new Date() >= time;
  const cls = ['row', 'prayer', isCurrent ? 'current' : '', rec ? `s-${rec.status}` : '', started ? '' : 'future'].join(' ');
  const badge = rec
    ? `<span class="badge ${rec.status}">${STATUS_LABEL[rec.status]} · ${fmtTime(new Date(rec.at))}</span>`
    : started ? `<span class="badge todo">Tandakan</span>` : '';
  return `<button class="${cls}" data-act="done" data-key="${p.key}" data-off="${dayOffset}" ${started ? '' : 'disabled'}>
      <span class="pname">${rec ? '✅' : started ? '⬜' : '🕒'} ${p.name}</span>
      <span class="ptime">${fmtTime(time)}</span>${badge}
    </button>`;
}

function renderRekod() {
  const now = new Date();
  const days = [];
  for (let i = 0; i < 7; i++) days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));

  let total = 0; let awal = 0;
  const rows = days.map((d) => {
    const e = state.log[dateKey(d)] || {};
    const cells = PRAYERS.map((p) => {
      const r = e[p.key];
      if (r) { total++; if (r.status === 'awal') awal++; }
      return `<td class="${r ? r.status : 'none'}" title="${r ? STATUS_LABEL[r.status] : 'Tiada rekod'}">${r ? '●' : '·'}</td>`;
    }).join('');
    return `<tr><th>${d.toLocaleDateString('ms-MY', { weekday: 'short', day: 'numeric', month: 'short' })}</th>${cells}</tr>`;
  }).join('');

  // Rentetan hari berturut-turut dengan 5 solat awal waktu (tidak termasuk hari ini jika belum lengkap).
  let streak = 0;
  for (let i = 0; ; i++) {
    const e = state.log[dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - i))] || {};
    const full = PRAYERS.every((p) => e[p.key]?.status === 'awal');
    if (full) streak++;
    else if (i > 0) break;
    if (i > 3650) break;
  }

  const pct = total ? Math.round((awal / total) * 100) : 0;
  return `
    <div class="stats">
      <div class="card stat"><div class="num">${pct}%</div><div>awal waktu (7 hari)</div></div>
      <div class="card stat"><div class="num">${awal}/35</div><div>solat awal waktu</div></div>
      <div class="card stat"><div class="num">🔥 ${streak}</div><div>hari penuh awal waktu</div></div>
    </div>
    <div class="card">
      <table class="grid">
        <tr><th></th>${PRAYERS.map((p) => `<th>${p.name.slice(0, 3)}</th>`).join('')}</tr>
        ${rows}
      </table>
      <div class="legend"><span class="awal">●</span> Awal <span class="dalam">●</span> Dalam waktu <span class="lewat">●</span> Lewat <span class="none">·</span> Tiada</div>
    </div>`;
}

function renderSettings() {
  const s = state.settings;
  const opt = (vals, cur, unit) => vals.map((v) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${v === 0 ? 'Tiada' : v + unit}</option>`).join('');
  return `
    <div class="card">
      <h3>Lokasi</h3>
      <p class="small">${state.loc ? '📍 ' + esc(state.loc.label) : 'Belum ditetapkan'}</p>
      <button class="primary" data-act="gps">Kesan semula dengan GPS</button>
      <label>Atau pilih bandar
        <select id="city"><option value="">— pilih —</option>${CITIES.map((c, i) => `<option value="${i}">${c[0]}</option>`).join('')}</select>
      </label>
    </div>
    <div class="card">
      <h3>Awal waktu</h3>
      <label>Dikira awal jika solat dalam
        <select id="awalMin">${opt([10, 15, 20, 30, 45, 60], s.awalMin, ' minit')}</select>
      </label>
    </div>
    <div class="card">
      <h3>Notifikasi</h3>
      <label class="check"><input type="checkbox" id="notify" ${s.notify ? 'checked' : ''}> Notifikasi masuk waktu</label>
      <label>Peringatan awal
        <select id="remindBefore">${opt([0, 5, 10, 15], s.remindBefore, ' minit sebelum')}</select>
      </label>
      <p class="small">Notifikasi dijadualkan 7 hari ke hadapan dan dikemas kini setiap kali app dibuka.</p>
    </div>
    <p class="small center">Kaedah kiraan: sudut Subuh 20°, Isyak 18°, mazhab Syafie (seperti JAKIM). Beza ±1–2 minit dengan takwim rasmi adalah biasa.</p>`;
}

function tick() {
  if (state.tab !== 'home' || !state.loc) return;
  const n = nextPrayer(state.loc.lat, state.loc.lng);
  if (!n) return;
  const name = $('#next-name'); const time = $('#next-time'); const cd = $('#countdown');
  if (!cd) return;
  name.textContent = n.name;
  time.textContent = `(${fmtTime(n.time)})`;
  cd.textContent = fmtCountdown(n.time - new Date());
  // Bila masuk waktu baru, lukis semula supaya senarai dikemas kini.
  if (n.time - new Date() < 1000) setTimeout(render, 1500);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// ---------- Acara ----------
document.addEventListener('click', (e) => {
  const tabBtn = e.target.closest('nav button');
  if (tabBtn) { state.tab = tabBtn.dataset.tab; render(); return; }
  const act = e.target.closest('[data-act]');
  if (!act) return;
  if (act.dataset.act === 'gps') detectLocation();
  if (act.dataset.act === 'done') toggleDone(act.dataset.key, Number(act.dataset.off));
});

document.addEventListener('change', async (e) => {
  const id = e.target.id;
  if (id === 'city' && e.target.value !== '') {
    const [label, lat, lng] = CITIES[Number(e.target.value)];
    await saveLocation({ lat, lng, label });
    state.tab = 'home';
    render();
    return;
  }
  if (['awalMin', 'remindBefore'].includes(id)) state.settings[id] = Number(e.target.value);
  else if (id === 'notify') state.settings.notify = e.target.checked;
  else return;
  await store.setSettings(state.settings);
  await refreshNotifications();
});

async function init() {
  state.settings = await store.getSettings();
  state.log = await store.getLog();
  state.loc = await store.getLocation();
  render();
  setInterval(tick, 1000);
  if (!state.loc) await detectLocation();
  else await refreshNotifications();

  // Bila app dibuka semula: lukis semula & jadual semula notifikasi.
  if (Capacitor.isNativePlatform()) {
    App.addListener('resume', async () => { render(); await refreshNotifications(); });
  }
}

init();
