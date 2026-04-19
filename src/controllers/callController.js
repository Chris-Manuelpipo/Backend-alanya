const pool = require('../config/db');

const getCalls = async (req, res) => {
  try {
    const alanyaID = req.user.alanyaID;
    const [rows] = await pool.execute(
      `SELECT c.*, 
              u1.nom as caller_nom, u1.pseudo as caller_pseudo, u1.avatar_url as caller_avatar,
              u2.nom as receiver_nom, u2.pseudo as receiver_pseudo, u2.avatar_url as receiver_avatar
       FROM callHistory c
       JOIN users u1 ON c.idCaller = u1.alanyaID
       JOIN users u2 ON c.idReceiver = u2.alanyaID
       WHERE c.idCaller = ? OR c.idReceiver = ?
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [alanyaID, alanyaID]
    );
    res.json(rows);
  } catch (error) {
    throw error;
  }
};

const createCall = async (req, res) => {
  try {
    const { idReceiver, type = 0 } = req.body;
    const idCaller = req.user.alanyaID;

    const [result] = await pool.execute(
      `INSERT INTO callHistory (idCaller, idReceiver, type, status, created_at, start_time) 
       VALUES (?, ?, ?, 0, NOW(), NOW())`,
      [idCaller, idReceiver, type]
    );

    const [rows] = await pool.execute(
      `SELECT c.*, u.nom as receiver_nom, u.pseudo as receiver_pseudo 
       FROM callHistory c JOIN users u ON c.idReceiver = u.alanyaID 
       WHERE c.IDcall = ?`,
      [result.insertId]
    );

    res.json(rows[0]);
  } catch (error) {
    throw error;
  }
};

const endCall = async (req, res) => {
  try {
    const { id } = req.params;
    const { status = 1 } = req.body;
    const alanyaID = req.user.alanyaID;

    // On calcule la durée en secondes depuis start_time (début réel de l'appel
    // = moment de décrochage, posé par defaut à created_at et mis à jour
    // lors de l'answer côté socket). On ne touche SURTOUT PAS à start_time ici.
    await pool.execute(
      `UPDATE callHistory
       SET status = ?,
           duree  = GREATEST(0, TIMESTAMPDIFF(SECOND, start_time, NOW()))
       WHERE IDcall = ? AND (idCaller = ? OR idReceiver = ?)`,
      [status, id, alanyaID, alanyaID]
    );

    res.json({ message: 'Call ended' });
  } catch (error) {
    throw error;
  }
};

module.exports = {
  getCalls,
  createCall,
  endCall,
};