const test = require('node:test');
const assert = require('node:assert');
const { decodePacket, PacketError } = require('../src/services/decoder.service');
const { buildPacket } = require('./helpers');
const sample = require('./fixtures/samplePacket.json');

test('decodes the assignment sample packet', () => {
  const r = decodePacket(sample.data);
  assert.strictEqual(r.sequence, 5);
  assert.strictEqual(r.deviceId, 70002);
  assert.strictEqual(r.timestamp, 1791180014);
  assert.strictEqual(r.temperature, -6.78);
  assert.strictEqual(r.battery, 88);
  assert.strictEqual(r.label, 'SN-70002');
  assert.strictEqual(r.samples.length, 16);
  assert.deepStrictEqual(r.samples[0], { x: 177, y: -68, z: 918 });
});

test('decodes a positive temperature', () => {
  const r = decodePacket(buildPacket({ tempCenti: 4123 }));
  assert.strictEqual(r.temperature, 41.23);
});

test('rejects wrong length', () => {
  assert.throws(() => decodePacket([1, 2, 3]), PacketError);
});

test('rejects non-byte values', () => {
  const p = buildPacket();
  p[20] = 300;
  assert.throws(() => decodePacket(p), PacketError);
});

test('rejects bad header', () => {
  const p = buildPacket();
  p[0] = 0;
  assert.throws(() => decodePacket(p), /header/);
});

test('rejects bad footer', () => {
  const p = buildPacket();
  p[255] = 0;
  assert.throws(() => decodePacket(p), /footer/);
});

test('rejects wrong version', () => {
  const p = buildPacket();
  p[2] = 3;
  assert.throws(() => decodePacket(p), /version/);
});

test('rejects checksum mismatch', () => {
  const p = buildPacket();
  p[14] = 50; // change battery without fixing checksum
  assert.throws(() => decodePacket(p), /checksum/);
});