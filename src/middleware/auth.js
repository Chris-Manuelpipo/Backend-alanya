const admin = require('firebase-admin');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

const JWT_SECRET = process.env.JWT_SECRET || 'talky-secret-key-change-in-production';

// Middleware qui accepte Firebase OU custom JWT
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];

    // Essayer d'abord le token custom JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const [rows] = await pool.execute(
        'SELECT alanyaID, alanyaPhone, email FROM users WHERE alanyaID = ?',
        [decoded.alanyaID]
      );

      if (rows.length > 0) {
        req.user = {
          alanyaID: rows[0].alanyaID,
          phone: rows[0].alanyaPhone,
          email: rows[0].email,
          authType: 'custom',
        };
        return next();
      }
    } catch (jwtError) {
      // Token pas JWT → essayer Firebase
    }

    // Essayer Firebase token
    try {
      const decoded = await admin.auth().verifyIdToken(token);
      const phone = decoded.phone_number ?? decoded.talky_phone ?? null;

      if (!phone) {
        return res.status(401).json({ error: 'No phone claim in token' });
      }

      const [rows] = await pool.execute(
        'SELECT alanyaID, alanyaPhone FROM users WHERE alanyaPhone = ?',
        [phone]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'User not found in DB' });
      }

      req.user = {
        uid: decoded.uid,
        alanyaID: rows[0].alanyaID,
        phone: rows[0].alanyaPhone,
        authType: 'firebase',
      };
      return next();
    } catch (fbError) {
      // Les deux ont échoué
      console.error('[Auth] Token verification failed:', fbError.message);
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
  } catch (error) {
    console.error('[Auth] ERROR:', error.code, error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = auth;