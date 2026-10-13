require('dotenv').config();

function getKey(){
    const hex = process.env.AES_KEY;
    if(!hex || !/^[0-9a-fA-F]{64}$/.test(hex)){
        throw new Error('AES_KEY must set as 64 hex characters (32 bytes)');
    }
    return Buffer.from(hex, 'hex');
}

module.exports = {
    port: process.env.PORT || 3000,
    dbPath: process.env.DB_PATH || './data/app.db',
    getKey,
};