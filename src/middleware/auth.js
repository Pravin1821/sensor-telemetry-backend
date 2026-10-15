const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function requireGatewayKey(apiKey) {
  return (req, res, next) => {
    const sent = req.get('x-api-key') || '';
    if (!safeEqual(sent, apiKey)) {
      return res.status(401).json({ error: 'Invalid or missing API key' });
    }
    next();
  };
}

function requireUser(secret) {
  return (req, res, next) => {
    const header = req.get('authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    let payload;
    try {
      payload = jwt.verify(token, secret);
    } catch {
      return res.status(401).json({ error: 'Login required' });
    }
    req.user = payload;
    next();
  };
}

module.exports = { safeEqual, requireGatewayKey, requireUser };