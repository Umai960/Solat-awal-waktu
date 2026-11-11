import { test } from 'node:test';
import assert from 'node:assert/strict';
import { timesFor, endOf, nextPrayer, currentPrayer, classify } from '../src/prayer.js';

process.env.TZ = 'Asia/Kuala_Lumpur';
const KL = [3.139, 101.6869];
const hm = (d) => d.toTimeString().slice(0, 5);

test('waktu KL 11 Nov 2026 hampir dengan takwim JAKIM', () => {
  const t = timesFor(...KL, new Date(2026, 10, 11));
  assert.equal(hm(t.subuh), '05:38');
  assert.equal(hm(t.zohor), '12:59');
  assert.equal(hm(t.asar), '16:20');
  assert.equal(hm(t.maghrib), '18:57');
  assert.equal(hm(t.isyak), '20:09');
});

test('solat seterusnya selepas Isyak ialah Subuh esok', () => {
  const n = nextPrayer(...KL, new Date(2026, 10, 11, 22, 0));
  assert.equal(n.key, 'subuh');
  assert.equal(n.time.getDate(), 12);
});

test('waktu semasa', () => {
  assert.deepEqual(currentPrayer(...KL, new Date(2026, 10, 11, 3, 0)), { key: 'isyak', dayOffset: -1 });
  assert.equal(currentPrayer(...KL, new Date(2026, 10, 11, 9, 0)), null);
  assert.equal(currentPrayer(...KL, new Date(2026, 10, 11, 13, 30)).key, 'zohor');
});

test('klasifikasi awal / dalam / lewat', () => {
  const d = new Date(2026, 10, 11);
  const start = timesFor(...KL, d).zohor;
  const end = endOf('zohor', ...KL, d);
  const at = (min) => new Date(start.getTime() + min * 60000);
  assert.equal(classify(at(10), start, end, 30), 'awal');
  assert.equal(classify(at(90), start, end, 30), 'dalam');
  assert.equal(classify(at(300), start, end, 30), 'lewat');
  assert.equal(endOf('isyak', ...KL, d).getDate(), 12);
});
