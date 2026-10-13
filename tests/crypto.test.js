process.env.AES_KEY = '04f4848ce46f9384da9b2f915dcb3bd5e9ea218e7e415776d85393391dcbe775';

const test = require('node:test');
const assert = require('node:assert');
const { decryptPacket, DecryptionError } = require('../src/services/crypto.service');
const { buildPacket, encryptBody } = require('./helpers');

const KEY = process.env.AES_KEY;

test('decrypts a valid body back to the original JSON', () => {
  const plaintext = JSON.stringify({ data: buildPacket() });
  const body = encryptBody(plaintext, KEY);
  assert.strictEqual(decryptPacket(body), plaintext);
});

test('rejects a tampered ciphertext', () => {
  const body = encryptBody(JSON.stringify({ data: buildPacket() }), KEY);
  const ct = Buffer.from(body.ciphertext, 'base64');
  ct[0] ^= 1; // flip one bit
  body.ciphertext = ct.toString('base64');
  assert.throws(() => decryptPacket(body), DecryptionError);
});

test('rejects a wrong key', () => {
  const wrongKey = 'ff'.repeat(32);
  const body = encryptBody('{"data":[]}', wrongKey);
  assert.throws(() => decryptPacket(body), DecryptionError);
});

test('rejects missing fields', () => {
  assert.throws(() => decryptPacket({ iv: 'abc' }), DecryptionError);
});