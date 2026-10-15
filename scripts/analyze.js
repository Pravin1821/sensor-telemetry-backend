const Database = require('better-sqlite3');
const db = new Database(process.argv[2] || './data/app.db', { readonly: true });

const iso = (s) => new Date(s * 1000).toISOString().slice(11, 19);

console.log('\n== Per device ==');
console.table(
  db.prepare(
    `SELECT device_id,
            COUNT(*) AS readings,
            ROUND(AVG(activity_score), 1) AS avg_activity,
            ROUND(MIN(activity_score), 1) AS min_activity,
            ROUND(MAX(temperature), 2) AS max_temp,
            ROUND(MIN(temperature), 2) AS min_temp,
            MIN(battery) AS min_battery,
            MIN(timestamp) AS first_ts,
            MAX(timestamp) AS last_ts
     FROM readings GROUP BY device_id ORDER BY device_id`
  ).all().map((r) => ({ ...r, first_ts: iso(r.first_ts), last_ts: iso(r.last_ts) }))
);

console.log('\n== Counts ==');
console.log({
  envelopes: db.prepare('SELECT COUNT(*) c FROM encrypted_packets').get().c,
  readings: db.prepare('SELECT COUNT(*) c FROM readings').get().c,
});

console.log('\n== Alerts ==');
console.table(
  db.prepare('SELECT id, device_id, type, raised_at, message, acknowledged FROM alerts ORDER BY id')
    .all()
    .map((a) => ({ ...a, raised_at: iso(a.raised_at) }))
);