process.env.AES_KEY = '04f4848ce46f9384da9b2f915dcb3bd5e9ea218e7e415776d85393391dcbe775';

const test = require('node:test');
const assert = require('node:assert');
const { createDb } = require('../src/db/database');
const { ingestPacket, DecryptionError } = require('../src/services/ingest.service');
const { buildPacket, encryptBody } = require('./helpers');

const KEY = process.env.AES_KEY;

function send(db, overrides) {
  const plaintext = JSON.stringify({ data: buildPacket(overrides) });
  return ingestPacket(db, encryptBody(plaintext, KEY));
}

const count = (db, table) => db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c;

test('stores raw, plaintext, device and reading for a new packet', () => {
  const db = createDb(':memory:');
  const r = send(db, { seq: 1, deviceId: 70003, label: 'SN-70003', tempCenti: 3172 });

  assert.strictEqual(r.duplicate, false);
  assert.strictEqual(count(db, 'encrypted_packets'), 1);
  assert.strictEqual(count(db, 'decrypted_packets'), 1);
  assert.strictEqual(count(db, 'readings'), 1);

  const device = db.prepare('SELECT * FROM devices WHERE device_id = 70003').get();
  assert.strictEqual(device.is_registered, 0);
  assert.strictEqual(device.label, 'SN-70003');
});

test('same device + same sequence within 2 minutes is a duplicate', () => {
  const db = createDb(':memory:');
  send(db, { seq: 7, timestamp: 1791180000 });
  const r = send(db, { seq: 7, timestamp: 1791180000 });

  assert.strictEqual(r.duplicate, true);
  assert.strictEqual(count(db, 'readings'), 1);
  assert.strictEqual(count(db, 'encrypted_packets'), 2); // both envelopes kept
});

test('same sequence after the wrap-around (64 min later) is NOT a duplicate', () => {
  const db = createDb(':memory:');
  send(db, { seq: 7, timestamp: 1791180000 });
  const r = send(db, { seq: 7, timestamp: 1791180000 + 3840 });

  assert.strictEqual(r.duplicate, false);
  assert.strictEqual(count(db, 'readings'), 2);
});

test('sequence 255 followed by 0 stores both readings', () => {
  const db = createDb(':memory:');
  send(db, { seq: 255, timestamp: 1791180000 });
  const r = send(db, { seq: 0, timestamp: 1791180015 });

  assert.strictEqual(r.duplicate, false);
  assert.strictEqual(count(db, 'readings'), 2);
});

test('a resting device scores about 0, a shaking one scores high', () => {
  const db = createDb(':memory:');
  send(db, { deviceId: 70010, seq: 1, sample: { x: 0, y: 0, z: 1000 } });
  send(db, { deviceId: 70011, seq: 1, sample: { x: 0, y: 0, z: 1400 } });

  const score = (id) =>
    db.prepare('SELECT activity_score s FROM readings WHERE device_id = ?').get(id).s;
  assert.strictEqual(score(70010), 0);
  assert.strictEqual(score(70011), 400);
});

test('a tampered packet is rejected but its envelope is still stored', () => {
  const db = createDb(':memory:');
  const body = encryptBody(JSON.stringify({ data: buildPacket() }), KEY);
  const ct = Buffer.from(body.ciphertext, 'base64');
  ct[0] ^= 1;
  body.ciphertext = ct.toString('base64');

  assert.throws(() => ingestPacket(db, body), DecryptionError);
  assert.strictEqual(count(db, 'encrypted_packets'), 1);
  assert.strictEqual(count(db, 'decrypted_packets'), 0);
  assert.strictEqual(count(db, 'readings'), 0);
});