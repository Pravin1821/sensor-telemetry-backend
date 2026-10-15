const OVER_TEMP_C = 40.0;
const OFFLINE_SECONDS = 30 * 60;
const INACTIVE_WINDOW_SECONDS = 60 * 60;
const INACTIVE_THRESHOLD = 10; 
const MIN_READINGS_FOR_INACTIVE = 120;; 

function raiseAlert(db, deviceId, type, raisedAt, message) {
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO alerts (device_id, type, raised_at, message)
       VALUES (?, ?, ?, ?)`
    )
    .run(deviceId, type, raisedAt, message);
  return result.changes === 1;
}

function checkOverTemperature(db, packet) {
  if (packet.temperature > OVER_TEMP_C) {
    return raiseAlert(
      db,
      packet.deviceId,
      'OVER_TEMPERATURE',
      packet.timestamp,
      `Temperature ${packet.temperature} C is above ${OVER_TEMP_C} C`
    );
  }
  return false;
}

function checkInactive(db, packet) {
  const row = db
    .prepare(
      `SELECT AVG(activity_score) AS avg_score, COUNT(*) AS n
       FROM readings
       WHERE device_id = ? AND timestamp > ? AND timestamp <= ?`
    )
    .get(packet.deviceId, packet.timestamp - INACTIVE_WINDOW_SECONDS, packet.timestamp);

  if (row.n < MIN_READINGS_FOR_INACTIVE) return false;

  if (row.avg_score < INACTIVE_THRESHOLD) {
    return raiseAlert(
      db,
      packet.deviceId,
      'INACTIVE',
      packet.timestamp,
      `Average activity ${row.avg_score.toFixed(1)} over the last hour is below ${INACTIVE_THRESHOLD}`
    );
  }
  return false;
}

function checkOffline(db) {
  const latest = db.prepare('SELECT MAX(timestamp) AS t FROM readings').get().t;
  if (latest === null) return [];

  const stale = db
    .prepare(
      `SELECT device_id, MAX(timestamp) AS last_ts
       FROM readings
       GROUP BY device_id
       HAVING MAX(timestamp) < ?`
    )
    .all(latest - OFFLINE_SECONDS);

  const raised = [];
  for (const d of stale) {
    const minutes = Math.round((latest - d.last_ts) / 60);
    if (raiseAlert(db, d.device_id, 'OFFLINE', latest, `No data for ${minutes} minutes`)) {
      raised.push(d.device_id);
    }
  }
  return raised;
}

module.exports = {
  checkOverTemperature,
  checkInactive,
  checkOffline,
  raiseAlert,
  OVER_TEMP_C,
  OFFLINE_SECONDS,
  INACTIVE_THRESHOLD,
};