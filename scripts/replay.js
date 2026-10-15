const fs = require('node:fs');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const speed = Number(arg('speed', '1'));
const baseUrl = arg('url', 'http://localhost:3000');
const file = arg('file', './data/encrypted_packets.json');

if (!(speed > 0)) {
  console.error('--speed must be a positive number');
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const packets = JSON.parse(fs.readFileSync(file, 'utf8'));
  packets.sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt));

  const startData = new Date(packets[0].sentAt).getTime();
  const startReal = Date.now();
  const stats = { created: 0, duplicate: 0, rejected: 0, failed: 0 };

  console.log(`Replaying ${packets.length} packets at ${speed}x to ${baseUrl}`);

  for (let i = 0; i < packets.length; i++) {
    const p = packets[i];
    const dueReal = startReal + (new Date(p.sentAt).getTime() - startData) / speed;
    const wait = dueReal - Date.now();
    if (wait > 0) await sleep(wait);

    try {
      const res = await fetch(`${baseUrl}/api/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
        body: JSON.stringify(p.body),
      });
      const json = await res.json().catch(() => ({}));

      if (res.status === 201) stats.created++;
      else if (res.status === 200) stats.duplicate++;
      else {
        stats.rejected++;
        console.log(`id ${p.id}: HTTP ${res.status} ${json.error || ''}`);
      }
      if (json.alerts && json.alerts.length) {
        console.log(`id ${p.id} (${p.sentAt}): ALERT ${json.alerts.join(', ')} for device ${json.deviceId}`);
      }
    } catch (err) {
      stats.failed++;
      console.log(`id ${p.id}: could not reach server (${err.message})`);
    }

    if ((i + 1) % 200 === 0) console.log(`...sent ${i + 1}/${packets.length}`);
  }

  console.log('Done:', stats);
}

main();