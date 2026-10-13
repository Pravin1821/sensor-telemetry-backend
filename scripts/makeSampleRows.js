const fs = require('node:fs');
require('dotenv').config();
const { decodePacket } = require('../src/services/decoder.service');

const dec = JSON.parse(fs.readFileSync('./data/decrypted_packets.json', 'utf8'));
const step = Math.floor(dec.length / 10);
const rows = [];

for (let i = 0; i < 10; i++) {
  const d = dec[i * step];
  rows.push({
    id: d.id,
    data: d.plaintext.data,
    expected: decodePacket(d.plaintext.data),
  });
}

fs.writeFileSync('./tests/fixtures/sampleRows.json', JSON.stringify(rows));
console.log('wrote', rows.length, 'rows');