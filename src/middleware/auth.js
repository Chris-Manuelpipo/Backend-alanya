// src/middleware/auth.js
const admin = require('firebase-admin');
const pool  = require('../config/db');

// Firebase Admin est initialisé une seule fois dans server.js
// Ce middleware utilise l'instance déjà active via admin.auth()

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);

    // Deux sources possibles pour le phone :
    //  - decoded.phone_number : user venu par OTP Firebase (claim natif)
    //  - decoded.talky_phone  : custom claim posé par /auth/register pour
    //    les users venus par Google (sans phone Firebase)
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
    };
    next();
  } catch (error) {
    console.error('[Auth] ERROR:', error.code, error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = auth;
