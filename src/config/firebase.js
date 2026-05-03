// src/config/firebase.js
// Initialise Firebase Admin UNE SEULE FOIS depuis la variable d'env
// FIREBASE_SERVICE_ACCOUNT (JSON stringifié dans .env)

const admin = require('firebase-admin');

if (!admin.apps.length) {
  try {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!raw) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT manquant dans .env');
    }

    const serviceAccount = JSON.parse(raw);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log('[Firebase] Admin SDK initialisé ✓');
  } catch (err) {
    console.error('[Firebase] Échec initialisation:', err.message);
    // On ne crash pas le serveur — les notifs seront silencieuses
  }
}

module.exports = admin;