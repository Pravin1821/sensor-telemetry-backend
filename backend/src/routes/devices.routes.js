const express = require('express');

function parseId(value){
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : null;
}

module.exports = function devicesRoutes(db) {
    const router = express.Router();
    router.post('/', (req, res) => {
    const { deviceId, label, location, installDate } = req.body || {};
    const id = parseId(deviceId);
    if (id === null) return res.status(400).json({ error: 'deviceId must be a positive integer' });
    if (installDate !== undefined && Number.isNaN(Date.parse(installDate))) {
      return res.status(400).json({ error: 'installDate must be a valid date' });
    }

    const existing = db.prepare('SELECT is_registered FROM devices WHERE device_id = ?').get(id);
    if (existing && existing.is_registered === 1) {
      return res.status(409).json({ error: 'Device is already registered' });
    }

    if (existing) {
      // it was auto-created from a packet: upgrade it
      db.prepare(
        `UPDATE devices SET label = COALESCE(?, label), location = ?, install_date = ?, is_registered = 1
         WHERE device_id = ?`
      ).run(label ?? null, location ?? null, installDate ?? null, id);
    } else {
      db.prepare(
        `INSERT INTO devices (device_id, label, location, install_date, is_registered)
         VALUES (?, ?, ?, ?, 1)`
      ).run(id, label ?? null, location ?? null, installDate ?? null);
    }

    const device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(id);
    res.status(201).json(device);
  });

  router.get('/', (req, res) => {
    const rows = db
      .prepare(
        `SELECT d.device_id, d.label, d.location, d.is_registered,
                r.temperature AS latest_temperature,
                r.activity_score AS latest_activity_score,
                r.battery AS latest_battery,
                r.timestamp AS last_seen,
                (SELECT COUNT(*) FROM alerts a
                  WHERE a.device_id = d.device_id AND a.acknowledged = 0) AS open_alerts
         FROM devices d
         LEFT JOIN readings r ON r.id = (
           SELECT id FROM readings WHERE device_id = d.device_id
           ORDER BY timestamp DESC, id DESC LIMIT 1
         )
         ORDER BY d.device_id`
      )
      .all();
    res.json(rows);
  });

  router.get('/:id', (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid device id' });

    const device = db.prepare('SELECT * FROM devices WHERE device_id = ?').get(id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const latest = db
      .prepare(
        `SELECT sequence, timestamp, temperature, battery, activity_score
         FROM readings WHERE device_id = ? ORDER BY timestamp DESC, id DESC LIMIT 1`
      )
      .get(id);
    const openAlerts = db
      .prepare('SELECT * FROM alerts WHERE device_id = ? AND acknowledged = 0 ORDER BY raised_at DESC')
      .all(id);

    res.json({ ...device, latestReading: latest || null, openAlerts });
  });

  router.get('/:id/readings', (req, res) => {
    const id = parseId(req.params.id);
    if (id === null) return res.status(400).json({ error: 'Invalid device id' });

    const device = db.prepare('SELECT 1 FROM devices WHERE device_id = ?').get(id);
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const from = req.query.from === undefined ? 0 : Number(req.query.from);
    const to = req.query.to === undefined ? Number.MAX_SAFE_INTEGER : Number(req.query.to);
    const page = req.query.page === undefined ? 1 : Number(req.query.page);
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);

    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from) {
      return res.status(400).json({ error: 'from and to must be unix seconds, with from <= to' });
    }
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 200) {
      return res.status(400).json({ error: 'page must be >= 1 and limit between 1 and 200' });
    }

    const total = db
      .prepare('SELECT COUNT(*) AS c FROM readings WHERE device_id = ? AND timestamp BETWEEN ? AND ?')
      .get(id, from, to).c;

    const rows = db
      .prepare(
        `SELECT id, sequence, timestamp, temperature, battery, activity_score, samples
         FROM readings
         WHERE device_id = ? AND timestamp BETWEEN ? AND ?
         ORDER BY timestamp DESC, id DESC
         LIMIT ? OFFSET ?`
      )
      .all(id, from, to, limit, (page - 1) * limit)
      .map((r) => ({ ...r, samples: JSON.parse(r.samples) }));

    res.json({ page, limit, total, data: rows });
  });

  return router;
};