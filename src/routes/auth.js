const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const authFirebase = require('../middleware/authFirebase');
const {
  verifyToken,
  getMe,
  updateMe,
  register,
  phoneExists,
} = require('../controllers/authController');

// Public : vérifier si un numéro est déjà pris (anti-doublon)
router.get('/phone-exists/:phone', phoneExists);

// Firebase-only : enregistrer le user en MySQL (idempotent)
// Nécessite juste un token Firebase valide avec phone_number
// (Google seul doit d'abord lier son numéro via OTP côté client)
router.post('/register', authFirebase, register);

// Routes classiques (exigent que le user existe déjà en MySQL)
router.post('/verify', auth, verifyToken);
router.get('/me', auth, getMe);
router.put('/me', auth, updateMe);

module.exports = router;