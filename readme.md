# Sensor Telemetry Backend

Receives AES-256-GCM encrypted packets from field devices, decrypts and decodes them,
stores them in SQLite, detects duplicates, raises alerts, and serves the data to a
React Native (Expo) app. Backend: Node.js, Express, SQLite.

> This repository must stay private. The test fixtures come from a confidential assignment.

## Repository layout

```
backend/   Express API, services, SQLite schema, tests, scripts, Dockerfile
mobile/    React Native (Expo) app
```

## Backend setup

Requirements: Node.js 20 or newer (developed on Node 22), npm.

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values below
npm start                 # http://localhost:3000
```

Environment variables (`backend/.env`, never committed):

| Name | Purpose |
|---|---|
| `AES_KEY` | 32-byte AES key as 64 hex characters (read from the environment, never hard-coded) |
| `JWT_SECRET` | signs login tokens |
| `GATEWAY_API_KEY` | key the gateway sends in the `x-api-key` header |
| `APP_USER`, `APP_PASSWORD` | demo login for the mobile app |
| `PORT`, `DB_PATH` | optional, default `3000` and `./data/app.db` |

The server refuses to start if `AES_KEY` or the auth variables are missing or malformed.

## Run the tests

```bash
cd backend
npm test
```

46 tests (Node's built-in test runner plus supertest):

- decoder: the PDF sample packet, 10 rows from the sample dataset, and bad packets
  (length, non-byte values, header, footer, version, checksum)
- decryption: valid packet, tampered ciphertext, wrong key, missing fields
- database rules: foreign keys and the one-open-alert-per-type index
- ingest: duplicates, sequence wrap-around (255 to 0), activity score, tampered packet
- alerts: over-temperature boundary, offline, inactive, no repeated open alerts
- API: status codes, validation, pagination, time filter, acknowledge
- auth: API key on ingest, login, token required on the app endpoints

## Replay the dataset

Put `encrypted_packets.json` in `backend/data/` (git-ignored), start the server, then:

```bash
cd backend
node scripts/replay.js --speed 60     # one recorded hour in about one minute
node scripts/analyze.js               # per-device summary and alerts
```

`replay.js` sends packets to `/api/ingest` in `sentAt` order. `--speed N` compresses time
by N. It reads `GATEWAY_API_KEY` from `.env` (or `--key`) and prints each alert the server
raises.

`analyze.js` reads the local file `backend/data/app.db`. It does not see the database
inside a Docker volume.

To start from a clean database, stop the server, delete `backend/data/app.db*`, and
start it again.

## Mobile app

```bash
cd mobile
npm install
npx expo start
```

The server address is set in **one place**: `mobile/src/config.js`

| Where the app runs | Value |
|---|---|
| Browser (Expo web) | `http://localhost:3000` |
| Android emulator | `http://10.0.2.2:3000` |
| Real phone with Expo Go | `http://<PC-IP>:3000` (same Wi-Fi) |

Log in with `APP_USER` / `APP_PASSWORD` from the backend `.env`.

Screens:

1. **Device list**: label, latest temperature, last-seen time ("5 min ago"), a red badge
   for devices with an open alert, pull-to-refresh, and an automatic refresh every 5 seconds.
2. **Device detail**: device info, latest reading, a temperature chart for the last hour with
   the most recent values listed, and the open alerts with an **Acknowledge** button.

The app shows a loading spinner, and a clear error message with a Retry button when the
API cannot be reached. If the connection drops while data is already shown, the old data
stays with a "Connection lost" banner. The login token is kept in the phone's secure
storage (not available in the browser).

## Docker

```bash
cd backend
docker compose up --build        # backend on http://localhost:3000
docker compose down              # stop, keep the database
docker compose down -v           # stop and delete the database (fresh start)
```

The compose file builds the backend image, passes `backend/.env` into the container at
run time (secrets are not baked into the image), and keeps the SQLite file on a named
volume so data survives restarts. A healthcheck calls `/api/health`.

SQLite is embedded in the backend, so there is no separate database container. Stop `npm start`
before using Docker, because both use port 3000.

## API

| Method | Path | Auth |
|---|---|---|
| POST | `/api/ingest` | `x-api-key` header |
| POST | `/api/auth/login` | none |
| POST | `/api/devices` | Bearer token |
| GET | `/api/devices` | Bearer token |
| GET | `/api/devices/:id` | Bearer token |
| GET | `/api/devices/:id/readings?from=&to=&page=&limit=` | Bearer token |
| GET | `/api/alerts?status=open` | Bearer token |
| PATCH | `/api/alerts/:id` | Bearer token |
| GET | `/api/health` | none |

`from` and `to` are unix seconds (the same unit as the packet timestamp). `limit` is at most 200.
Readings are newest first.

Status codes: 201 new reading, 200 duplicate (accepted, nothing new stored), 400 bad packet
or input, 401 not authorised, 404 not found, 409 device already registered.

## Design decisions

**Layers.** Routes handle HTTP only, services hold the logic (decrypt, decode, ingest,
alerts), and the database layer holds the schema and connection. Configuration comes from
environment variables.

**Decryption.** `decryptPacket` uses AES-256-GCM and verifies the authentication tag. Any
tampering or wrong key gives HTTP 400, and the plaintext is not parsed. The key and plaintext
are never logged.

**Decoding.** `decodePacket` reads little-endian values and two's-complement signed values
(temperature can be negative). It rejects a packet that is not exactly 256 integers from 0 to
255, or has a wrong header, footer, version, sample count, battery value or checksum.

**Storing the 16 samples.** Stored as a JSON text column on the `readings` row. The samples are
always read together and nothing queries a single sample, so one row per packet is simpler and
faster than a separate table with 16 rows per reading. The cost is that SQL cannot filter on an
individual sample. The full 256 bytes are also kept in `decrypted_packets`, so no information is
lost.

**Raw storage.** The envelope is saved in `encrypted_packets` before decryption, so even
tampered or corrupted packets leave an audit record. `decrypted_packets` links to it.

**Indexes.** `readings (device_id, timestamp)` serves the latest-reading, time-range and
duplicate lookups.

**Unregistered devices.** A packet from an unknown device ID is still stored. A device row is
created automatically with `is_registered = 0` and the label from the packet. `POST /api/devices`
later upgrades it (location, install date, `is_registered = 1`). Registering a device that is
already registered returns 409.

**Duplicates.** Same device and same sequence within 120 seconds of the packet's own timestamp is
a duplicate: the envelope is stored, the reading is not. The sequence is one byte, so it repeats
every 256 packets (about 64 minutes at one packet per 15 s), far outside the 2-minute window, so a
wrapped sequence is treated as a new packet. 255 followed by 0 needs no special code.

**Time.** All rules use the packet timestamp, never the server clock, so replaying an old hour
works. For the offline check, "now" is the newest packet time in the database.

**Activity score.** Average of `|sqrt(x² + y² + z²) - 1000|` over the 16 samples, stored with the
reading.

**Alerts.**
- Over-temperature: above 40.00 °C (exactly 40.00 does not alert).
- Offline: no packet for 30 minutes, checked on a timer every 5 seconds.
- Inactive: average activity over the last hour is below **10**, evaluated once at least 120
  readings (about 30 minutes) exist, so a new device is not flagged immediately.
- A partial unique index on `(device_id, type) WHERE acknowledged = 0` makes a second open alert
  of the same type impossible. After acknowledging, a new one can be raised. Alerts are checked
  only for new readings, not duplicates.

**Inactive threshold.** Chosen from the data: the stopped device averages about 1.7, healthy
devices average about 45, and their lowest single reading is about 27. A threshold of 10 sits
inside that gap.

**Authentication.** The gateway sends `x-api-key` on `/api/ingest`. The app user logs in and
receives a JWT (12 hours), sent as `Authorization: Bearer`. Secrets are compared in constant time.
There is a single demo user taken from environment variables.

**Mobile time display.** "5 min ago" is measured against the newest packet time on the server,
not the phone clock, for the same reason as above (the replayed data is from 5 Oct 2026).

## Findings in the sample dataset

| Device | What the data shows | Result |
|---|---|---|
| 70003 | reaches 43.47 °C | OVER_TEMPERATURE alert |
| 70005 | last packet at 06:19:54 | OFFLINE alert |
| 70004 | average activity about 1.7 | INACTIVE alert |
| 70002 | about -6.8 to -6.2 °C | decoded correctly as negative |
| all | 1,574 sends, 1,041 unique readings, 533 duplicates | sequence wrap handled |

## Assumptions

- The gateway ID is a free string (the dataset uses `GW-01`, the PDF shows `GW01`).
- `from` and `to` are unix seconds.
- One demo user is enough for the app.
- A duplicate is answered with 200 so the gateway does not retry.

## Known gaps and limitations

- Push notifications are not implemented.
- [Fill in honestly, for example: the app was tested in a browser / on a physical Android phone
  with Expo Go. Pull-to-refresh was tested on ___.]
- The offline check runs every 5 s, so during a 60x replay an alert can lag by a few
  data-minutes. Live, the lag is at most 5 s.
- CORS is open for development. Production should allow only specific origins.
- One hard-coded demo user, no password hashing or users table.
- SQLite with a polling app. The Docker image keeps the build tools, so it is larger than
  needed (a multi-stage build would shrink it).

## What I would improve with more time

- PostgreSQL (or TimescaleDB) instead of SQLite, with a queue in front of ingestion.
- Users table with hashed passwords, token refresh, rate limiting on login.
- Push notifications for over-temperature alerts.
- Show the alert type on the device list badge.

## Scaling to 50,000 devices (note)

50,000 devices every 15 s is about 3,300 packets per second, more than SQLite's single writer can
handle. I would put the gateway behind a queue (Kafka or SQS), run stateless ingest workers that
decrypt and decode in parallel, write batches to PostgreSQL with TimescaleDB partitioned by time,
keep the latest value per device in Redis for the device list, and run offline detection as a
scheduled query instead of a per-device timer.