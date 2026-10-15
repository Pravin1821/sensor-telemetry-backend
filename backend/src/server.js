const config = require('./config');
const { createDb } = require('./db/database');
const { createApp } = require('./app');
const { checkOffline } = require('./services/alert.service');

config.getKey(); 

const db = createDb();
const auth = config.getAuth()
const app = createApp(db, auth);

const OFFLINE_CHECK_INTERVAL_MS = Number(process.env.OFFLINE_CHECK_MS) || 5000;

const timer = setInterval(() => {
  try {
    const raised = checkOffline(db);
    if (raised.length) console.log('Offline alerts raised for devices:', raised.join(', '));
  } catch (err) {
    console.error('Offline check failed:', err.message);
  }
}, OFFLINE_CHECK_INTERVAL_MS);

const server = app.listen(config.port, () => {
  console.log(`Server listening on port ${config.port}`);
});

function shutdown() {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);