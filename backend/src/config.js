require('dotenv').config();

function getKey() {
  const hex = process.env.AES_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('AES_KEY must be set as 64 hex characters (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

function getAuth() {
  const { JWT_SECRET, GATEWAY_API_KEY, APP_USER, APP_PASSWORD } = process.env;
  if (!JWT_SECRET || !GATEWAY_API_KEY || !APP_USER || !APP_PASSWORD) {
    throw new Error('JWT_SECRET, GATEWAY_API_KEY, APP_USER and APP_PASSWORD must be set');
  }
  return {
    jwtSecret: JWT_SECRET,
    gatewayApiKey: GATEWAY_API_KEY,
    appUser: APP_USER,
    appPassword: APP_PASSWORD,
  };
}

module.exports = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './data/app.db',
  getKey,
  getAuth,
};