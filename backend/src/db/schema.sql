
CREATE TABLE IF NOT EXISTS encrypted_packets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  gateway_id  TEXT NOT NULL,
  received_at TEXT NOT NULL,          
  iv          TEXT NOT NULL,          
  ciphertext  TEXT NOT NULL,          
  tag         TEXT NOT NULL           
);

CREATE TABLE IF NOT EXISTS decrypted_packets (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  encrypted_packet_id INTEGER NOT NULL UNIQUE REFERENCES encrypted_packets(id),
  plaintext           TEXT NOT NULL   
);

CREATE TABLE IF NOT EXISTS devices (
  device_id     INTEGER PRIMARY KEY,  
  label         TEXT,
  location      TEXT,
  install_date  TEXT,
  is_registered INTEGER NOT NULL DEFAULT 0 CHECK (is_registered IN (0, 1)),
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS readings (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id           INTEGER NOT NULL REFERENCES devices(device_id),
  encrypted_packet_id INTEGER NOT NULL REFERENCES encrypted_packets(id),
  sequence            INTEGER NOT NULL CHECK (sequence BETWEEN 0 AND 255),
  timestamp           INTEGER NOT NULL,   
  temperature         REAL NOT NULL,      
  battery             INTEGER NOT NULL CHECK (battery BETWEEN 0 AND 100),
  activity_score      REAL NOT NULL,
  samples             TEXT NOT NULL,      
  created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_readings_device_time
  ON readings (device_id, timestamp);


CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  device_id       INTEGER NOT NULL REFERENCES devices(device_id),
  type            TEXT NOT NULL
                  CHECK (type IN ('OVER_TEMPERATURE', 'OFFLINE', 'INACTIVE')),
  raised_at       INTEGER NOT NULL,       
  message         TEXT,
  acknowledged    INTEGER NOT NULL DEFAULT 0 CHECK (acknowledged IN (0, 1)),
  acknowledged_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_alerts_one_open
  ON alerts (device_id, type) WHERE acknowledged = 0;

CREATE INDEX IF NOT EXISTS idx_alerts_device
  ON alerts (device_id, acknowledged);