const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');
const { generateAccessToken, generateRefreshToken, JWT_REFRESH_SECRET } = require('../middleware/authCustom');

const SALT_ROUNDS = 10;

// Génère un alanyaPhone unique à 6 chiffres
const generateAlanyaPhone = async () => {
  let alanyaPhone;
  let attempts = 0;
  while (attempts < 20) {
    alanyaPhone = Math.floor(100000 + Math.random() * 900000).toString();
    const [existing] = await pool.execute(
      'SELECT alanyaID FROM users WHERE alanyaPhone = ?',
      [alanyaPhone]
    );
    if (existing.length === 0) return alanyaPhone;
    attempts++;
  }
  throw new Error('Unable to generate unique phone number');
};

// ── REGISTER ─────────────────────────────────────────────────────────
const register = async (req, res) => {
  try {
    const { email, password, nom, pseudo, idPays, fcm_token, device_ID } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const [existingEmail] = await pool.execute(
      'SELECT alanyaID FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );
    if (existingEmail.length > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const alanyaPhone = await generateAlanyaPhone();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const [result] = await pool.execute(
      `INSERT INTO users
        (nom, pseudo, alanyaPhone, email, password, idPays, avatar_url,
         fcm_token, device_ID, last_seen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        nom        || 'Utilisateur',
        pseudo     || nom || 'Kamite',
        alanyaPhone,
        email.toLowerCase().trim(),
        hashedPassword,
        idPays     || 1,
        'NON DEFINI',
        fcm_token  || 'INDEFINI',
        device_ID  || 'INDEFINI',
      ]
    );

    const tokenPayload  = { alanyaID: result.insertId, email: email.toLowerCase().trim() };
    const accessToken   = generateAccessToken(tokenPayload);
    const refreshToken  = generateRefreshToken(tokenPayload);

    const [rows] = await pool.execute(
      'SELECT alanyaID, nom, pseudo, alanyaPhone, email, avatar_url, is_online, last_seen FROM users WHERE alanyaID = ?',
      [result.insertId]
    );

    res.status(201).json({ user: rows[0], accessToken, refreshToken });
  } catch (error) {
    console.error('[Register] ERROR:', error);
    res.status(500).json({ error: error.message || 'Registration failed' });
  }
};

// ── LOGIN ─────────────────────────────────────────────────────────────
const login = async (req, res) => {
  try {
    const { email, password, fcm_token, device_ID } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const [rows] = await pool.execute(
      'SELECT alanyaID, nom, pseudo, alanyaPhone, email, password, avatar_url, is_online, exclus FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = rows[0];

    if (user.exclus === 1) {
      return res.status(403).json({ error: 'Account banned' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Mettre à jour fcm_token et device_ID si fournis
    if (fcm_token || device_ID) {
      const updates = [];
      const values  = [];
      if (fcm_token) { updates.push('fcm_token = ?'); values.push(fcm_token); }
      if (device_ID) { updates.push('device_ID = ?'); values.push(device_ID); }
      values.push(user.alanyaID);
      await pool.execute(`UPDATE users SET ${updates.join(', ')} WHERE alanyaID = ?`, values);
    }

    const tokenPayload = { alanyaID: user.alanyaID, email: user.email };
    const accessToken  = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    delete user.password;
    delete user.exclus;
    res.json({ user, accessToken, refreshToken });
  } catch (error) {
    console.error('[Login] ERROR:', error);
    res.status(500).json({ error: error.message || 'Login failed' });
  }
};

// ── REFRESH TOKEN ─────────────────────────────────────────────────────
const refreshToken = async (req, res) => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'refreshToken required' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Refresh token expired, please login again', code: 'REFRESH_EXPIRED' });
      }
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    if (decoded.type !== 'refresh') {
      return res.status(401).json({ error: 'Invalid token type' });
    }

    // Vérifier que le user existe toujours et n'est pas banni
    const [rows] = await pool.execute(
      'SELECT alanyaID, email FROM users WHERE alanyaID = ? AND exclus = 0',
      [decoded.alanyaID]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'User not found or banned' });
    }

    const tokenPayload    = { alanyaID: rows[0].alanyaID, email: rows[0].email };
    const newAccessToken  = generateAccessToken(tokenPayload);
    const newRefreshToken = generateRefreshToken(tokenPayload);

    res.json({ accessToken: newAccessToken, refreshToken: newRefreshToken });
  } catch (error) {
    console.error('[RefreshToken] ERROR:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
};

// ── RESET PASSWORD ────────────────────────────────────────────────────
const resetPassword = async (req, res) => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ error: 'Email and newPassword required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const [rows] = await pool.execute(
      'SELECT alanyaID FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      // Réponse volontairement vague pour éviter l'énumération
      return res.json({ message: 'If this email exists, password has been reset' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await pool.execute(
      'UPDATE users SET password = ? WHERE alanyaID = ?',
      [hashedPassword, rows[0].alanyaID]
    );

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('[ResetPassword] ERROR:', error);
    res.status(500).json({ error: error.message || 'Reset password failed' });
  }
};

// ── GET ME ────────────────────────────────────────────────────────────
const getMe = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT alanyaID, nom, pseudo, alanyaPhone, email, idPays, avatar_url, type_compte, is_online, last_seen FROM users WHERE alanyaID = ?',
      [req.user.alanyaID]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(rows[0]);
  } catch (error) {
    console.error('[GetMe] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── UPDATE ME ─────────────────────────────────────────────────────────
const updateMe = async (req, res) => {
  try {
    const { nom, pseudo, avatar_url, fcm_token, device_ID, is_online } = req.body;
    const updates = [];
    const values  = [];

    if (nom)       { updates.push('nom = ?');        values.push(nom); }
    if (pseudo)    { updates.push('pseudo = ?');     values.push(pseudo); }
    if (avatar_url){ updates.push('avatar_url = ?'); values.push(avatar_url); }
    if (fcm_token) { updates.push('fcm_token = ?');  values.push(fcm_token); }
    if (device_ID) { updates.push('device_ID = ?');  values.push(device_ID); }
    if (is_online !== undefined) {
      updates.push('is_online = ?, last_seen = NOW()');
      values.push(is_online ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.user.alanyaID);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE alanyaID = ?`,
      values
    );

    const [rows] = await pool.execute(
      'SELECT alanyaID, nom, pseudo, alanyaPhone, email, avatar_url, is_online FROM users WHERE alanyaID = ?',
      [req.user.alanyaID]
    );

    res.json(rows[0]);
  } catch (error) {
    console.error('[UpdateMe] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  register,
  login,
  refreshToken,
  resetPassword,
  getMe,
  updateMe,
  authCustom: require('../middleware/authCustom').authCustom,
};