// Jadualkan notifikasi masuk waktu untuk 7 hari akan datang (berfungsi tanpa internet).
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { PRAYERS, timesFor, fmtTime } from './prayer.js';

const DAYS_AHEAD = 7;
const CHANNEL = 'waktu-solat';

export async function ensurePermission() {
  if (!Capacitor.isNativePlatform()) return false;
  let p = await LocalNotifications.checkPermissions();
  if (p.display !== 'granted') p = await LocalNotifications.requestPermissions();
  if (p.display !== 'granted') return false;
  try {
    // Android 12+: perlukan kebenaran "alarm tepat" supaya notifikasi tepat pada waktunya.
    const exact = await LocalNotifications.checkExactNotificationSetting();
    if (exact.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
  } catch { /* versi Android lama — tak perlu */ }
  return true;
}

export async function reschedule(loc, settings) {
  if (!Capacitor.isNativePlatform()) return 0;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) {
    await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  }
  if (!settings.notify || !loc) return 0;

  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Waktu Solat',
    description: 'Notifikasi masuk waktu solat',
    importance: 5,
    visibility: 1,
    vibration: true,
  }).catch(() => {});

  const now = new Date();
  const list = [];
  for (let d = 0; d < DAYS_AHEAD; d++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
    const t = timesFor(loc.lat, loc.lng, day);
    PRAYERS.forEach((p, i) => {
      const at = t[p.key];
      const baseId = (d + 1) * 100 + i * 10;
      if (at > now) {
        list.push({
          id: baseId + 1,
          title: `Masuk waktu ${p.name}`,
          body: `${fmtTime(at)} — jom solat awal waktu! 🤲`,
          schedule: { at, allowWhileIdle: true },
          channelId: CHANNEL,
          extra: { prayer: p.key },
        });
      }
      if (settings.remindBefore > 0) {
        const pre = new Date(at.getTime() - settings.remindBefore * 60000);
        if (pre > now) {
          list.push({
            id: baseId + 2,
            title: `${settings.remindBefore} minit lagi waktu ${p.name}`,
            body: `Bersedia — ambil wuduk sekarang.`,
            schedule: { at: pre, allowWhileIdle: true },
            channelId: CHANNEL,
          });
        }
      }
    });
  }
  if (list.length) await LocalNotifications.schedule({ notifications: list });
  return list.length;
}
