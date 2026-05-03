const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET         = process.env.JWT_SECRET          || 'talky-secret-key-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET  || 'talky-refresh-secret-change-in-production';

// Access token : 15 minutes (court — sécurité)
const generateAccessToken = (payload) => {
  return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, { expiresIn: '15m' });
};

// Refresh token : 30 jours
const generateRefreshToken = (payload) => {
  return jwt.sign({ ...payload, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: '30d' });
};

// Middleware pour les routes protégées (access token uniquement)
const authCustom = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    if (decoded.type !== 'access') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    const [rows] = await pool.execute(
      'SELECT alanyaID, alanyaPhone, email FROM users WHERE alanyaID = ? AND exclus = 0',
      [decoded.alanyaID]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found or banned' });
    }

    req.user = {
      alanyaID: rows[0].alanyaID,
      phone: rows[0].alanyaPhone,
      email: rows[0].email,
    };
    next();
  } catch (error) {
    console.error('[AuthCustom] ERROR:', error.message);
    return res.status(401).json({ error: 'Authentication failed' });
  }
};

module.exports = { authCustom, generateAccessToken, generateRefreshToken, JWT_SECRET, JWT_REFRESH_SECRET };