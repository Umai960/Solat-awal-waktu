// Simpanan data dalam telefon (offline).
import { Preferences } from '@capacitor/preferences';

async function get(key, fallback) {
  try {
    const { value } = await Preferences.get({ key });
    return value == null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function set(key, value) {
  await Preferences.set({ key, value: JSON.stringify(value) });
}

export const DEFAULT_SETTINGS = {
  awalMin: 30,        // tempoh "awal waktu" dalam minit
  notify: true,       // notifikasi masuk waktu
  remindBefore: 0,    // peringatan X minit sebelum masuk waktu (0 = tiada)
};

export const store = {
  getLocation: () => get('location', null),          // { lat, lng, label, at }
  setLocation: (loc) => set('location', loc),
  getSettings: async () => ({ ...DEFAULT_SETTINGS, ...(await get('settings', {})) }),
  setSettings: (s) => set('settings', s),
  // log: { 'YYYY-MM-DD': { subuh: { at: ISO, status: 'awal'|'dalam'|'lewat' }, ... } }
  getLog: () => get('log', {}),
  setLog: (log) => set('log', log),
};
