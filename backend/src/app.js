const express = require('express');
const ingestRoutes = require('./routes/ingest.routes');
const devicesRoutes = require('./routes/devices.routes');
const alertsRoutes = require('./routes/alerts.routes');
const authRoutes = require('./routes/auth.routes');
const { requireGatewayKey, requireUser } = require('./middleware/auth');
const { DecryptionError } = require('./services/crypto.service');
const { PacketError } = require('./services/decoder.service');
const cors = require('cors');

const open = (req, res, next) => next();

function createApp(db, auth = null) {
    const app = express();
    app.use(cors());
    app.use(express.json({limit:'100kb'}));

    const gateway = auth ? requireGatewayKey(auth.gatewayApiKey) : open;
    const user = auth ? requireUser(auth.jwtSecret) : open;

    app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
    if (auth) app.use('/api/auth', authRoutes(auth));
    app.use('/api/ingest', gateway, ingestRoutes(db));
    app.use('/api/devices', user, devicesRoutes(db));
    app.use('/api/alerts', user, alertsRoutes(db));

    app.use((req, res) => res.status(404).json({ error: 'Not found' }));

    app.use((err, req, res, next) => {
        if (err instanceof DecryptionError || err instanceof PacketError) {
        return res.status(400).json({ error: err.message });
        }
        if (err.type === 'entity.parse.failed') {
        return res.status(400).json({ error: 'Invalid JSON body' });
        }
        console.error('Unexpected error:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    });

  return app;
}

module.exports = { createApp };