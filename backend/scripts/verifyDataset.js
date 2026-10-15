const fs = require('node:fs');
require('dotenv').config();
const { decryptPacket } = require('../src/services/crypto.service');
const { decodePacket } = require('../src/services/decoder.service');

const enc = JSON.parse(fs.readFileSync('./data/encrypted_packets.json', 'utf8'));
const dec = JSON.parse(fs.readFileSync('./data/decrypted_packets.json', 'utf8'));

let ok = 0;
let decodeFail = 0;
const reasons = {};

enc.forEach((row, i) => {
  const plain = decryptPacket(row.body);
  if (plain !== JSON.stringify(dec[i].plaintext)) {
    console.log('plaintext mismatch at id', row.id);
    return;
  }
  try {
    decodePacket(JSON.parse(plain).data);
    ok++;
  } catch (e) {
    decodeFail++;
    reasons[e.message] = (reasons[e.message] || 0) + 1;
  }
});

console.log({ total: enc.length, decodedOk: ok, decodeFail, reasons });