const Database = require('better-sqlite3');
const db = new Database('./data/sample_data.db', { readonly: true });

const tables = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table'")
  .all();

for (const t of tables) {
  console.log(t.sql);
  console.log('rows:', db.prepare(`SELECT COUNT(*) AS c FROM ${t.name}`).get().c);
  console.log('first row:', JSON.stringify(db.prepare(`SELECT * FROM ${t.name} LIMIT 1`).get()).slice(0, 400));
  console.log('');
}