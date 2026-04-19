// src/middleware/authFirebase.js
// Middleware "lâche" : vérifie le token Firebase et expose les claims,
// mais n'exige PAS que l'utilisateur existe déjà dans MySQL.
// Utile pour /api/auth/register et /api/auth/phone-exists.

const admin = require('firebase-admin');

const authFirebase = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await admin.auth().verifyIdToken(token);

    req.firebaseUser = {
      uid: decoded.uid,
      phone: decoded.phone_number ?? null,
      email: decoded.email ?? null,
      name: decoded.name ?? null,
      picture: decoded.picture ?? null,
    };
    next();
  } catch (error) {
    console.error('[AuthFirebase] ERROR:', error.code, error.message);
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authFirebase;
