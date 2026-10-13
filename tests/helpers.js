const crypto = require('node:crypto');

function buildPacket({
  seq = 1,
  deviceId = 70002,
  timestamp = 1791180014,
  tempCenti = 2500,
  battery = 90,
  label = 'SN-70002',
  sample = { x: 0, y: 0, z: 1000 },
} = {}) {
  const buf = Buffer.alloc(256);
  buf[0] = 0xa5;
  buf[1] = 0x5a;
  buf[2] = 2;
  buf[3] = seq;
  buf.writeUInt32LE(deviceId, 4);
  buf.writeUInt32LE(timestamp, 8);
  buf.writeInt16LE(tempCenti, 12);
  buf[14] = battery;
  buf[15] = 16;
  for (let n = 0; n < 16; n++) {
    const o = 16 + n * 6;
    buf.writeInt16LE(sample.x, o);
    buf.writeInt16LE(sample.y, o + 2);
    buf.writeInt16LE(sample.z, o + 4);
  }
  buf.write(label, 112, 'ascii');
  let sum = 0;
  for (let i = 0; i < 252; i++) sum += buf[i];
  buf.writeUInt16LE(sum % 65536, 252);
  buf[254] = 0x5a;
  buf[255] = 0xa5;
  return Array.from(buf);
}

function encryptBody(plaintext, keyHex, gatewayId = 'GW01') {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(keyHex, 'hex'), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return {
    gatewayId,
    iv: iv.toString('base64'),
    ciphertext: ct.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

module.exports = { buildPacket, encryptBody };