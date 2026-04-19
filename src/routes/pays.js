const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT idPays, libelle, prefix, timeZone, decalageHoraire FROM pays ORDER BY libelle');
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

module.exports = router;