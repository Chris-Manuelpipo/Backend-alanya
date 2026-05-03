const pool = require('../config/db');

const _INVALID_URL_VALUES = ['NON DEFINI', 'INDEFINI', 'undefined', 'null', ''];
const sanitizeUrl = (url) => {
  if (!url) return null;
  const trimmed = url.trim();
  if (_INVALID_URL_VALUES.includes(trimmed)) return null;
  if (!trimmed.startsWith('http')) return null;
  return trimmed;
};

// ── GET /api/contacts  — liste des contacts préférés ──────────────────
const getPreferredContacts = async (req, res) => {
  try {
    const alanyaID = req.user.alanyaID;

    const [rows] = await pool.execute(
      `SELECT
         pc.idPrefContact,
         pc.created_at,
         u.alanyaID,
         u.nom,
         u.pseudo,
         u.alanyaPhone,
         u.avatar_url,
         u.is_online,
         u.last_seen
       FROM preferredContact pc
       JOIN users u ON pc.idFriend = u.alanyaID
       WHERE pc.alanyaID = ?
       ORDER BY u.nom ASC`,
      [alanyaID]
    );

    const contacts = rows.map(r => ({
      idPrefContact: r.idPrefContact,
      addedAt:       r.created_at,
      alanyaID:      r.alanyaID,
      nom:           r.nom,
      pseudo:        r.pseudo,
      alanyaPhone:   r.alanyaPhone,
      avatar_url:    sanitizeUrl(r.avatar_url),
      is_online:     r.is_online,
      last_seen:     r.last_seen,
    }));

    res.json(contacts);
  } catch (error) {
    console.error('[getPreferredContacts] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── POST /api/contacts/:id  — ajouter un contact préféré ──────────────
const addPreferredContact = async (req, res) => {
  try {
    const alanyaID = req.user.alanyaID;
    const friendID = parseInt(req.params.id, 10);

    if (!friendID || isNaN(friendID)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    if (friendID === alanyaID) {
      return res.status(400).json({ error: 'Cannot add yourself as contact' });
    }

    // Vérifier que l'ami existe
    const [userCheck] = await pool.execute(
      'SELECT alanyaID, nom, pseudo, alanyaPhone, avatar_url, is_online FROM users WHERE alanyaID = ? AND exclus = 0',
      [friendID]
    );
    if (userCheck.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Vérifier que l'utilisateur n'est pas bloqué
    const [blockCheck] = await pool.execute(
      'SELECT idBlock FROM blocked WHERE (alanyaID = ? AND idCallerBlock = ?) OR (alanyaID = ? AND idCallerBlock = ?)',
      [alanyaID, friendID, friendID, alanyaID]
    );
    if (blockCheck.length > 0) {
      return res.status(403).json({ error: 'Cannot add blocked user' });
    }

    // Vérifier si déjà contact préféré
    const [existing] = await pool.execute(
      'SELECT idPrefContact FROM preferredContact WHERE alanyaID = ? AND idFriend = ?',
      [alanyaID, friendID]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'Already a preferred contact' });
    }

    const [result] = await pool.execute(
      'INSERT INTO preferredContact (alanyaID, idFriend, created_at) VALUES (?, ?, NOW())',
      [alanyaID, friendID]
    );

    res.status(201).json({
      idPrefContact: result.insertId,
      alanyaID:      userCheck[0].alanyaID,
      nom:           userCheck[0].nom,
      pseudo:        userCheck[0].pseudo,
      alanyaPhone:   userCheck[0].alanyaPhone,
      avatar_url:    sanitizeUrl(userCheck[0].avatar_url),
      is_online:     userCheck[0].is_online,
    });
  } catch (error) {
    console.error('[addPreferredContact] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── DELETE /api/contacts/:id  — supprimer un contact préféré ─────────
const removePreferredContact = async (req, res) => {
  try {
    const alanyaID = req.user.alanyaID;
    const friendID = parseInt(req.params.id, 10);

    if (!friendID || isNaN(friendID)) {
      return res.status(400).json({ error: 'Invalid user ID' });
    }

    const [result] = await pool.execute(
      'DELETE FROM preferredContact WHERE alanyaID = ? AND idFriend = ?',
      [alanyaID, friendID]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    res.json({ message: 'Contact removed' });
  } catch (error) {
    console.error('[removePreferredContact] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

// ── GET /api/contacts/check/:id  — vérifier si c'est un contact ───────
const checkIsContact = async (req, res) => {
  try {
    const alanyaID = req.user.alanyaID;
    const friendID = parseInt(req.params.id, 10);

    const [rows] = await pool.execute(
      'SELECT idPrefContact FROM preferredContact WHERE alanyaID = ? AND idFriend = ?',
      [alanyaID, friendID]
    );

    res.json({ isContact: rows.length > 0 });
  } catch (error) {
    console.error('[checkIsContact] ERROR:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getPreferredContacts,
  addPreferredContact,
  removePreferredContact,
  checkIsContact,
};