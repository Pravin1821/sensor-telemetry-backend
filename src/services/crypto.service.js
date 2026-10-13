const crypto = require('node:crypto');
const { getKey } = require('../config');

class DecryptionError extends Error{
    constructor(message){
        super(message);
        this.name = 'Decryption Error';
    }
}

function decryptPacket(body){
    const {iv, ciphertext, tag} = body || {};
    if([iv, ciphertext, tag].some((v) => typeof v !== 'string' || v === '')){
        throw new DecryptionError('iv, ciphertext and tag are reqired strings');
    }

    const ivBuf = Buffer.from(iv, 'base64');
    const tagBuf = Buffer.from(tag, 'base64');
    const ctBuf = Buffer.from(ciphertext, 'base64');

    if(ivBuf.length !== 12) 
        throw new DecryptionError('iv must be 12 bytes');
    if(tagBuf.length !== 16)
        throw new DecryptionError('tag must be 16 bytes');

    try{
        const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), ivBuf);
        decipher.setAuthTag(tagBuf);
        const plaintext = Buffer.concat([decipher.update(ctBuf), decipher.final()]);
        return plaintext.toString('utf8');
    }catch(err){
        throw new DecryptionError('Decryption failed or authentication tag mismatch');
    }
}

module.exports = {decryptPacket, DecryptionError};