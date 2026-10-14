process.env.AES_KEY = '04f4848ce46f9384da9b2f915dcb3bd5e9ea218e7e415776d85393391dcbe775';

const test = require('node:test');
const assert = require('node:assert');
const { createDb } = require('../src/db/database');
const { ingestPacket } = require('../src/services/ingest.service');
const { checkOffline } = require('../src/services/alert.service');
const { buildPacket, encryptBody } = require('./helpers');

const KEY = process.env.AES_KEY;
const T0 = 1791180000;

function send(db, overrides) {
  const body = encryptBody(JSON.stringify({ data: buildPacket(overrides) }), KEY);
  return ingestPacket(db, body);
}

const openAlerts = (db, type) =>
  db.prepare('SELECT * FROM alerts WHERE type = ? AND acknowledged = 0').all(type);

test('40.00 C does not alert, 40.01 C does', () => {
  const db = createDb(':memory:');
  send(db, { seq: 1, timestamp: T0, tempCenti: 4000 });
  assert.strictEqual(openAlerts(db, 'OVER_TEMPERATURE').length, 0);
  send(db, { seq: 2, timestamp: T0 + 15, tempCenti: 4001 });
  assert.strictEqual(openAlerts(db, 'OVER_TEMPERATURE').length, 1);
});

test('repeated hot packets raise only one open alert', () => {
  const db = createDb(':memory:');
  for (let i = 0; i < 5; i++) {
    send(db, { seq: i, timestamp: T0 + i * 15, tempCenti: 5000 });
  }
  assert.strictEqual(openAlerts(db, 'OVER_TEMPERATURE').length, 1);
});

test('after acknowledging, a new hot packet raises a fresh alert', () => {
  const db = createDb(':memory:');
  send(db, { seq: 1, timestamp: T0, tempCenti: 5000 });
  db.prepare('UPDATE alerts SET acknowledged = 1').run();
  send(db, { seq: 2, timestamp: T0 + 15, tempCenti: 5000 });
  assert.strictEqual(openAlerts(db, 'OVER_TEMPERATURE').length, 1);
});

test('a device silent for 31 minutes is OFFLINE, using packet time', () => {
  const db = createDb(':memory:');
  send(db, { deviceId: 70004, label: 'SN-70004', seq: 1, timestamp: T0 });
  send(db, { deviceId: 70005, label: 'SN-70005', seq: 1, timestamp: T0 + 31 * 60 });

  const raised = checkOffline(db);
  assert.deepStrictEqual(raised, [70004]);
  assert.strictEqual(openAlerts(db, 'OFFLINE').length, 1);

  assert.deepStrictEqual(checkOffline(db), []);
});

test('a device silent for only 10 minutes is not offline', () => {
  const db = createDb(':memory:');
  send(db, { deviceId: 70004, seq: 1, timestamp: T0 });
  send(db, { deviceId: 70005, seq: 1, timestamp: T0 + 10 * 60 });
  assert.deepStrictEqual(checkOffline(db), []);
});

test('a device resting for a full hour raises INACTIVE', () => {
  const db = createDb(':memory:');
  for (let i = 0; i < 240; i++) {
    send(db, { seq: i % 256, timestamp: T0 + i * 15, sample: { x: 0, y: 0, z: 1000 } });
  }
  assert.strictEqual(openAlerts(db, 'INACTIVE').length, 1);
});

test('a moving device never raises INACTIVE', () => {
  const db = createDb(':memory:');
  for (let i = 0; i < 240; i++) {
    send(db, { seq: i % 256, timestamp: T0 + i * 15, sample: { x: 0, y: 0, z: 1400 } });
  }
  assert.strictEqual(openAlerts(db, 'INACTIVE').length, 0);
});