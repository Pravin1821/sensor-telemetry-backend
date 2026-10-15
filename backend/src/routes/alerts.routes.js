const express = require('express');

module.exports = function alertsRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const { status } = req.query;
    if (status !== undefined && !['open', 'acknowledged'].includes(status)) {
      return res.status(400).json({ error: "status must be 'open' or 'acknowledged'" });
    }

    let sql = 'SELECT * FROM alerts';
    const params = [];
    if (status === 'open') sql += ' WHERE acknowledged = 0';
    if (status === 'acknowledged') sql += ' WHERE acknowledged = 1';
    sql += ' ORDER BY raised_at DESC, id DESC';

    res.json(db.prepare(sql).all(...params));
  });

  router.patch('/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'Invalid alert id' });
    }

    const alert = db.prepare('SELECT * FROM alerts WHERE id = ?').get(id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });

    if (alert.acknowledged === 0) {
      db.prepare(
        "UPDATE alerts SET acknowledged = 1, acknowledged_at = datetime('now') WHERE id = ?"
      ).run(id);
    }
    
    res.json(db.prepare('SELECT * FROM alerts WHERE id = ?').get(id));
  });

  return router;
};