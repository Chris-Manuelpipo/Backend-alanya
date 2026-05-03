const express = require('express');
const router  = express.Router();
const { authCustom } = require('../middleware/authCustom');
const {
  register,
  login,
  refreshToken,
  resetPassword,
  getMe,
  updateMe,
} = require('../controllers/authCustomController');

// Public
router.post('/register',        register);
router.post('/login',           login);
router.post('/refresh',         refreshToken);     // ← renouvellement silencieux
router.post('/reset-password',  resetPassword);

// Protégées
router.get('/me',  authCustom, getMe);
router.put('/me',  authCustom, updateMe);

module.exports = router;