const express = require('express');
const ingestRoutes = require('./routes/ingest.routes');
const devicesRoutes = require('./routes/devices.routes');
const alertsRoutes = require('./routes/alerts.routes');
const { DecryptionError } = require('./services/crypto.service');
const { PacketError } = require('./services/decoder.service');

function createApp(db) {
    const app = express();
    app.use(express.json({limit:'100kb'}));
    app.use('/api/ingest', ingestRoutes(db));
    app.use('/api/devices', devicesRoutes(db));
    app.use('/api/alerts', alertsRoutes(db));

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