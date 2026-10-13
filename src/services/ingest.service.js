const { decryptPacket, DecryptionError } = require('./crypto.service');
const { decodePacket, PacketError } = require('./decoder.service');
const { activityScore } = require('./activity.service');

const DUPLICATE_WINDOW_SECONDS = 120;

function ingestPacket(db, body, now = () => new Date().toISOString()){
    const gatewayId = body && typeof body.gatewayId === 'string' ? body.gatewayId : '' ;
    if(!gatewayId)
        throw new PacketError('gatewayId is required');

    const encryptedId = db.prepare(`INSERT INTO encrypted_packets (gateway_id, received_at, iv, ciphertext, tag)
        VALUES (?, ?, ?, ?, ?)`).run(gatewayId, now(), String(body.iv), String(body.ciphertext), String(body.tag))
        .lastInsertRowid;
    
    const plaintext = decryptPacket(body);
    db.prepare(`INSERT INTO decrypted_packets (encrypted_packet_id, plaintext) 
        VALUES (?, ?)`).run(encryptedId, plaintext);

    let parsed;
    try{
        parsed = JSON.parse(plaintext);
    } catch{
        throw new PacketError('plaintext is not valid JSON');
    }

    const packet = decodePacket(parsed.data);

    const save = db.transaction( () => {
        db.prepare(
            `INSERT OR IGNORE INTO devices (device_id, label, is_registered)
            VALUES (?, ?, 0)`).run(packet.deviceId, packet.label);
        const duplicate = db.prepare(
            `SELECT id FROM readings WHERE device_id = ? AND sequence = ? AND
            timestamp BETWEEN ? AND ?`
        )
        .get(packet.deviceId, packet.sequence, 
            packet.timestamp - DUPLICATE_WINDOW_SECONDS,
            packet.timestamp + DUPLICATE_WINDOW_SECONDS
        );

        if(duplicate){
            return { duplicate: true, readingId: duplicate.id, packet };
        }

        const score = activityScore(packet.samples);
        const readingId = db.prepare(
            `INSERT INTO readings (device_id, encrypted_packet_id, sequence, timestamp, temperature,
            battery, activity_score, samples)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(packet.deviceId, encryptedId, packet.sequence, packet.timestamp,
                packet.temperature, packet.battery, score, JSON.stringify(packet.samples)
            ).lastInsertRowid;
        
        return { duplicate: false, readingId, packet };
    });

    return save();
}

module.exports = { ingestPacket, DecryptionError, PacketError };