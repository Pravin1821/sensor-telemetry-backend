process.env.AES_KEY = '04f4848ce46f9384da9b2f915dcb3bd5e9ea218e7e415776d85393391dcbe775';

const test = require('node:test');
const assert = require('node:assert');
const request = require('supertest');
const { createDb } = require('../src/db/database');
const { createApp } = require('../src/app');
const { buildPacket, encryptBody } = require('./helpers');

const auth = {
  jwtSecret: 'test-secret',
  gatewayApiKey: 'gw-key',
  appUser: 'admin',
  appPassword: 'pass123',
};

const setup = () => createApp(createDb(':memory:'), auth);
const envelope = () =>
  encryptBody(
    JSON.stringify({ data: buildPacket({ seq: 1, timestamp: 1791180000 }) }),
    process.env.AES_KEY
  );

test('ingest without an API key is rejected with 401', async () => {
  const res = await request(setup()).post('/api/ingest').send(envelope());
  assert.strictEqual(res.status, 401);
});

test('ingest with a wrong API key is rejected with 401', async () => {
  const res = await request(setup()).post('/api/ingest').set('x-api-key', 'nope').send(envelope());
  assert.strictEqual(res.status, 401);
});

test('ingest with the right API key works', async () => {
  const res = await request(setup()).post('/api/ingest').set('x-api-key', 'gw-key').send(envelope());
  assert.strictEqual(res.status, 201);
});

test('devices without a token is rejected with 401', async () => {
  const res = await request(setup()).get('/api/devices');
  assert.strictEqual(res.status, 401);
});

test('login with a wrong password returns 401', async () => {
  const res = await request(setup()).post('/api/auth/login').send({ username: 'admin', password: 'bad' });
  assert.strictEqual(res.status, 401);
});

test('login with missing fields returns 400', async () => {
  const res = await request(setup()).post('/api/auth/login').send({ username: 'admin' });
  assert.strictEqual(res.status, 400);
});

test('a token from login opens the API, a garbage token does not', async () => {
  const app = setup();
  const login = await request(app).post('/api/auth/login').send({ username: 'admin', password: 'pass123' });
  assert.strictEqual(login.status, 200);

  const ok = await request(app).get('/api/devices').set('Authorization', `Bearer ${login.body.token}`);
  assert.strictEqual(ok.status, 200);

  const bad = await request(app).get('/api/devices').set('Authorization', 'Bearer garbage');
  assert.strictEqual(bad.status, 401);
});