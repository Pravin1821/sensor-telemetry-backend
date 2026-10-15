const express = require('express');
const jwt = require('jsonwebtoken');
const { safeEqual } = require('../middleware/auth');

module.exports = function authRoutes(auth) {
  const router = express.Router();

  router.post('/login', (req, res) => {
    const { username, password } = req.body || {};
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const userOk = safeEqual(username, auth.appUser);
    const passOk = safeEqual(password, auth.appPassword);
    if (!(userOk && passOk)) {
      return res.status(401).json({ error: 'Wrong username or password' });
    }

    const token = jwt.sign({ sub: username }, auth.jwtSecret, { expiresIn: '12h' });
    res.json({ token, expiresIn: '12h' });
  });

  return router;
};