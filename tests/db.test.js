const test = require('node:test');
const assert = require('node:assert');
const { createDb } = require('../src/db/database');

function freshDb() {
  const db = createDb(':memory:');
  db.prepare('INSERT INTO devices (device_id, label) VALUES (?, ?)').run(70002, 'SN-70002');
  return db;
}

function insertEncrypted(db) {
  return db
    .prepare(
      `INSERT INTO encrypted_packets (gateway_id, received_at, iv, ciphertext, tag)
       VALUES ('GW-01', '2026-10-05T06:00:00Z', 'iv', 'ct', 'tag')`
    )
    .run().lastInsertRowid;
}

test('creates all five tables', () => {
  const db = freshDb();
  const names = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
    .all()
    .map((r) => r.name)
    .sort();
  assert.deepStrictEqual(names, [
    'alerts',
    'decrypted_packets',
    'devices',
    'encrypted_packets',
    'readings',
  ]);
});

test('blocks a second open alert of the same type for the same device', () => {
  const db = freshDb();
  const add = db.prepare(
    "INSERT INTO alerts (device_id, type, raised_at) VALUES (70002, 'OVER_TEMPERATURE', 1791180000)"
  );
  add.run();
  assert.throws(() => add.run(), /UNIQUE/);
});

test('allows a new alert after the old one is acknowledged', () => {
  const db = freshDb();
  const add = db.prepare(
    "INSERT INTO alerts (device_id, type, raised_at) VALUES (70002, 'OFFLINE', 1791180000)"
  );
  const id = add.run().lastInsertRowid;
  db.prepare('UPDATE alerts SET acknowledged = 1 WHERE id = ?').run(id);
  assert.doesNotThrow(() => add.run());
});

test('rejects a reading for a device that does not exist', () => {
  const db = freshDb();
  const packetId = insertEncrypted(db);
  assert.throws(
    () =>
      db
        .prepare(
          `INSERT INTO readings
           (device_id, encrypted_packet_id, sequence, timestamp, temperature, battery, activity_score, samples)
           VALUES (99999, ?, 1, 1791180000, 25, 90, 10, '[]')`
        )
        .run(packetId),
    /FOREIGN KEY/
  );
});