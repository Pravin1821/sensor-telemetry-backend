class PacketError extends Error{
    constructor(message){
        super(message);
        this.name = 'PacketError';
    }
}

function decodePacket(data){
    if(!Array.isArray(data) || data.length !== 256){
        throw new PacketError('data must be an array of exactly 256 numbers');
    }
    if(!data.every((b) => Number.isInteger(b) && b >= 0 && b <= 255)){
        throw new PacketError('every value must be an integer from 0 to 255');
    }
    const buf = Buffer.from(data);

    if(buf[0] !== 0xa5 || buf[1] !== 0x5a)
        throw new PacketError('invalid header');
    if(buf[254] !== 0x5a || buf[255] !== 0xa5)
        throw new PacketError('invalid footer');
    if(buf[2] !== 2)
        throw new PacketError(`unsupported format version ${buf[2]}`);

    let sum = 0;
    for(let i = 0; i < 252; i++)
        sum += buf[i];
    const expected = sum % 65536;
    const actual = buf.readUInt16LE(252);
    if(expected !== actual)
        throw new PacketError(`checksum mismatch (expected: ${expected}, actual: ${actual})`);

    const sampleCount = buf[15];
    if(sampleCount !== 16)
        throw new PacketError('sample count must be 16');

    const battery = buf[14];
    if(battery > 100)
        throw new PacketError('battery must be a number from 0 to 100');

    const samples = [];
    for(let n = 0; n < 16; n++){
        const o = 16 + n * 6;
        samples.push({
            x: buf.readInt16LE(o),
            y: buf.readInt16LE(o + 2),
            z: buf.readInt16LE(o + 4),
        });
    }

    const label = buf.toString('ascii', 112, 128).replace(/\0+$/, '');
    return {
        sequence: buf[3],
        deviceId: buf.readUInt32LE(4),
        timestamp: buf.readUInt32LE(8),
        temperature: buf.readInt16LE(12) / 100,
        battery,
        label,
        samples,
    };
}

module.exports = {decodePacket, PacketError};