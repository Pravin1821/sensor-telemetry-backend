process.env.AES_KEY = '04f4848ce46f9384da9b2f915dcb3bd5e9ea218e7e415776d85393391dcbe775';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const { buildPacket, encryptBody } = require('./helpers');

const KEY = process.env.AES_KEY;
const T0 = 1791180000;

function setup() {
  const db = createDb(':memory:');
  return { db, app: createApp(db) };
}

const body = (overrides) =>
  encryptBody(JSON.stringify({ data: buildPacket(overrides) }), KEY);

test('POST /api/ingest returns 201 for a new packet and 200 for a duplicate', async () => {
  const { app } = setup();
  const b = body({ seq: 1, timestamp: T0 });
  const first = await request(app).post('/api/ingest').send(b);
  assert.strictEqual(first.status, 201);
  assert.strictEqual(first.body.duplicate, false);

  const second = await request(app).post('/api/ingest').send(body({ seq: 1, timestamp: T0 }));
  assert.strictEqual(second.status, 200);
  assert.strictEqual(second.body.duplicate, true);
});

test('POST /api/ingest returns 400 for a tampered packet', async () => {
  const { app } = setup();
  const b = body({ seq: 1 });
  const ct = Buffer.from(b.ciphertext, 'base64');
  ct[0] ^= 1;
  b.ciphertext = ct.toString('base64');
  const res = await request(app).post('/api/ingest').send(b);
  assert.strictEqual(res.status, 400);
});

test('POST /api/ingest returns 400 for a missing body', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/ingest').send({});
  assert.strictEqual(res.status, 400);
});

test('unknown device is stored as unregistered, then can be registered', async () => {
  const { app } = setup();
  await request(app).post('/api/ingest').send(body({ deviceId: 70099, label: 'SN-70099', seq: 1, timestamp: T0 }));

  const list = await request(app).get('/api/devices');
  assert.strictEqual(list.status, 200);
  assert.strictEqual(list.body[0].is_registered, 0);

  const reg = await request(app)
    .post('/api/devices')
    .send({ deviceId: 70099, location: 'Warehouse 3', installDate: '2026-09-01' });
  assert.strictEqual(reg.status, 201);
  assert.strictEqual(reg.body.is_registered, 1);

  const again = await request(app).post('/api/devices').send({ deviceId: 70099 });
  assert.strictEqual(again.status, 409);
});

test('POST /api/devices validates input', async () => {
  const { app } = setup();
  const res = await request(app).post('/api/devices').send({ deviceId: 'abc' });
  assert.strictEqual(res.status, 400);
});

test('GET /api/devices/:id returns 404 for an unknown device', async () => {
  const { app } = setup();
  const res = await request(app).get('/api/devices/12345');
  assert.strictEqual(res.status, 404);
});

test('readings are newest first and paginated, with a time filter', async () => {
  const { app } = setup();
  for (let i = 0; i < 5; i++) {
    await request(app).post('/api/ingest').send(body({ seq: i, timestamp: T0 + i * 15 }));
  }

  const page1 = await request(app).get('/api/devices/70002/readings?limit=2&page=1');
  assert.strictEqual(page1.status, 200);
  assert.strictEqual(page1.body.total, 5);
  assert.strictEqual(page1.body.data.length, 2);
  assert.strictEqual(page1.body.data[0].timestamp, T0 + 60); // newest first

  const filtered = await request(app).get(`/api/devices/70002/readings?from=${T0 + 15}&to=${T0 + 30}`);
  assert.strictEqual(filtered.body.total, 2);

  const bad = await request(app).get('/api/devices/70002/readings?from=100&to=50');
  assert.strictEqual(bad.status, 400);
});

test('over-temperature creates an alert that can be acknowledged', async () => {
  const { app } = setup();
  const ingest = await request(app)
    .post('/api/ingest')
    .send(body({ seq: 1, timestamp: T0, tempCenti: 5500 }));
  assert.deepStrictEqual(ingest.body.alerts, ['OVER_TEMPERATURE']);

  const open = await request(app).get('/api/alerts?status=open');
  assert.strictEqual(open.body.length, 1);

  const id = open.body[0].id;
  const ack = await request(app).patch(`/api/alerts/${id}`);
  assert.strictEqual(ack.status, 200);
  assert.strictEqual(ack.body.acknowledged, 1);

  const openAfter = await request(app).get('/api/alerts?status=open');
  assert.strictEqual(openAfter.body.length, 0);

  const missing = await request(app).patch('/api/alerts/9999');
  assert.strictEqual(missing.status, 404);

  const badStatus = await request(app).get('/api/alerts?status=banana');
  assert.strictEqual(badStatus.status, 400);
});